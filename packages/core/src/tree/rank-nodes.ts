import type { TreeEvaluation } from "./evaluate-tree.ts";
import { pathToNode } from "./path-breakdown.ts";
import type { Tree } from "./tree-format.ts";

/** What a node's damage gain costs. A path with an unpriced step has no price at all. */
export type ValueForMoney =
    | { readonly kind: "unpriced" }
    | { readonly kind: "free"; readonly damagePerSecondGain: number }
    | { readonly kind: "priced"; readonly damagePerSecondGainPerMillionZeny: number };

export interface RankedNode {
    readonly nodeId: string;
    readonly label: string;
    /** `true` when no other node builds on this one. */
    readonly isLeaf: boolean;
    readonly damagePerSecond: number;
    /** Against the root. Negative when the node is worse than the root. */
    readonly damagePerSecondGain: number;
    /** `null` when the attack cannot kill the target. */
    readonly secondsToKill: number | null;
    /** The sum of the step costs from the root. `null` when a step on the path is unpriced. */
    readonly cumulativeZenyCost: number | null;
    readonly valueForMoney: ValueForMoney;
}

export const rankingMetrics = ["damagePerSecondGain", "secondsToKill", "cumulativeZenyCost", "valueForMoney"] as const;

export type RankingMetric = (typeof rankingMetrics)[number];

const zenyPerMillion = 1_000_000;

/**
 * The nodes that have numbers, best first for the given metric. Stale nodes
 * and nodes the engine cannot calculate are left out. Nodes without a value
 * for the metric (no kill, no price) come last.
 */
export function rankNodes(tree: Tree, evaluation: TreeEvaluation, metric: RankingMetric): RankedNode[] {
    if (evaluation.root.state !== "ready") {
        return [];
    }
    const rootDamagePerSecond = evaluation.root.battleSummary.averageDamagePerSecond;
    const parentNodeIds = new Set(tree.nodes.map((node) => node.parentId));

    const rankedNodes = tree.nodes.flatMap((node): RankedNode[] => {
        const nodeEvaluation = evaluation.nodes.get(node.id);
        if (nodeEvaluation?.state !== "ready") {
            return [];
        }
        const damagePerSecond = nodeEvaluation.battleSummary.averageDamagePerSecond;
        const damagePerSecondGain = damagePerSecond - rootDamagePerSecond;
        const cumulativeZenyCost = sumOfStepCosts(pathToNode(tree, node.id).map((step) => step.zenyCost));
        return [
            {
                nodeId: node.id,
                label: node.label,
                isLeaf: !parentNodeIds.has(node.id),
                damagePerSecond,
                damagePerSecondGain,
                secondsToKill: nodeEvaluation.battleSummary.averageTimeToKill?.seconds ?? null,
                cumulativeZenyCost,
                valueForMoney: valueForMoneyOf(damagePerSecondGain, cumulativeZenyCost),
            },
        ];
    });

    return rankedNodes.sort(comparatorOf[metric]);
}

function sumOfStepCosts(stepCosts: readonly (number | undefined)[]): number | null {
    let cumulativeZenyCost = 0;
    for (const stepCost of stepCosts) {
        if (stepCost === undefined) {
            return null;
        }
        cumulativeZenyCost += stepCost;
    }
    return cumulativeZenyCost;
}

function valueForMoneyOf(damagePerSecondGain: number, cumulativeZenyCost: number | null): ValueForMoney {
    if (cumulativeZenyCost === null) {
        return { kind: "unpriced" };
    }
    if (cumulativeZenyCost === 0) {
        return { kind: "free", damagePerSecondGain };
    }
    return {
        kind: "priced",
        damagePerSecondGainPerMillionZeny: damagePerSecondGain / (cumulativeZenyCost / zenyPerMillion),
    };
}

type NodeComparator = (first: RankedNode, second: RankedNode) => number;

const higherGainFirst: NodeComparator = (first, second) => second.damagePerSecondGain - first.damagePerSecondGain;

/** Smaller first; a node without the value goes after every node that has it. */
function smallerFirstMissingLast(valueOf: (node: RankedNode) => number | null): NodeComparator {
    return (first, second) => {
        const firstValue = valueOf(first);
        const secondValue = valueOf(second);
        if (firstValue === null || secondValue === null) {
            return Number(firstValue === null) - Number(secondValue === null);
        }
        return firstValue - secondValue;
    };
}

const valueForMoneyTier = { free: 0, priced: 1, unpriced: 2 } as const;

const comparatorOf: Record<RankingMetric, NodeComparator> = {
    damagePerSecondGain: higherGainFirst,
    secondsToKill: smallerFirstMissingLast((node) => node.secondsToKill),
    cumulativeZenyCost: smallerFirstMissingLast((node) => node.cumulativeZenyCost),
    valueForMoney(first, second) {
        const tierDifference = valueForMoneyTier[first.valueForMoney.kind] - valueForMoneyTier[second.valueForMoney.kind];
        if (tierDifference !== 0) {
            return tierDifference;
        }
        if (first.valueForMoney.kind === "priced" && second.valueForMoney.kind === "priced") {
            return (
                second.valueForMoney.damagePerSecondGainPerMillionZeny -
                first.valueForMoney.damagePerSecondGainPerMillionZeny
            );
        }
        return higherGainFirst(first, second);
    },
};
