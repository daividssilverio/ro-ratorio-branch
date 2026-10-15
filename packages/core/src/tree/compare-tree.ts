import type { BuildConversionIssue } from "../build/convert-build.ts";
import type { BattleSummary } from "../engine-adapter/battle-summary.ts";
import { diffEvaluations, type EvaluationDiff } from "./diff-evaluations.ts";
import { type BuildCalculator, evaluateTree, type NodeEvaluation, type TreeEvaluation } from "./evaluate-tree.ts";
import { type RankedNode, type RankingMetric, rankingMetrics, rankNodes } from "./rank-nodes.ts";
import type { StaleChange } from "./resolve-tree.ts";
import type { Tree, TreeNode } from "./tree-format.ts";

interface NodeIdentity {
    readonly id: string;
    readonly label: string;
    readonly parentId: string | null;
}

export type NodeComparison =
    | (NodeIdentity &
          Omit<RankedNode, "nodeId" | "label" | "damagePerSecond" | "secondsToKill"> & {
              readonly state: "ready";
              readonly battleSummary: BattleSummary;
              /** What differs from the parent (the root for a top-level node). `null` when the parent has no numbers. */
              readonly diffFromParent: EvaluationDiff | null;
          })
    | (NodeIdentity & { readonly state: "stale"; readonly staleChanges: readonly StaleChange[] })
    | (NodeIdentity & { readonly state: "notCalculable"; readonly issues: readonly BuildConversionIssue[] });

/** A whole tree, calculated and ranked: what `rocalc compare` prints. */
export interface TreeComparison {
    readonly root:
        | { readonly state: "ready"; readonly battleSummary: BattleSummary }
        | { readonly state: "notCalculable"; readonly issues: readonly BuildConversionIssue[] };
    /** In the order of the tree file. */
    readonly nodes: readonly NodeComparison[];
    /** Node IDs, best first, for each metric. Only nodes with numbers appear. */
    readonly rankings: Readonly<Record<RankingMetric, readonly string[]>>;
}

export async function compareTree(tree: Tree, calculate: BuildCalculator): Promise<TreeComparison> {
    return describeEvaluation(tree, await evaluateTree(tree, calculate));
}

export function describeEvaluation(tree: Tree, evaluation: TreeEvaluation): TreeComparison {
    const rankedNodeOfId = new Map(
        rankNodes(tree, evaluation, "damagePerSecondGain").map((rankedNode) => [rankedNode.nodeId, rankedNode]),
    );
    const rankingOf = (metric: RankingMetric) => rankNodes(tree, evaluation, metric).map((rankedNode) => rankedNode.nodeId);

    return {
        root:
            evaluation.root.state === "ready"
                ? { state: "ready", battleSummary: evaluation.root.battleSummary }
                : { state: "notCalculable", issues: evaluation.root.issues },
        nodes: tree.nodes.map((node) => describeNode(node, evaluation, rankedNodeOfId.get(node.id))),
        rankings: Object.fromEntries(rankingMetrics.map((metric) => [metric, rankingOf(metric)])) as Record<
            RankingMetric,
            string[]
        >,
    };
}

function describeNode(node: TreeNode, evaluation: TreeEvaluation, rankedNode: RankedNode | undefined): NodeComparison {
    const identity = { id: node.id, label: node.label, parentId: node.parentId };
    const nodeEvaluation = evaluation.nodes.get(node.id);
    if (nodeEvaluation === undefined || nodeEvaluation.state === "stale") {
        return { ...identity, state: "stale", staleChanges: nodeEvaluation?.staleChanges ?? [] };
    }
    if (nodeEvaluation.state === "notCalculable" || rankedNode === undefined) {
        return {
            ...identity,
            state: "notCalculable",
            issues: nodeEvaluation.state === "notCalculable" ? nodeEvaluation.issues : [],
        };
    }
    const parentEvaluation: NodeEvaluation | undefined =
        node.parentId === null ? evaluation.root : evaluation.nodes.get(node.parentId);
    return {
        ...identity,
        state: "ready",
        battleSummary: nodeEvaluation.battleSummary,
        isLeaf: rankedNode.isLeaf,
        damagePerSecondGain: rankedNode.damagePerSecondGain,
        cumulativeZenyCost: rankedNode.cumulativeZenyCost,
        valueForMoney: rankedNode.valueForMoney,
        diffFromParent: parentEvaluation?.state === "ready" ? diffEvaluations(parentEvaluation, nodeEvaluation) : null,
    };
}
