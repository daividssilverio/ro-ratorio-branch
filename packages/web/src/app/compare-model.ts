import {
    breakDownPath,
    diffEvaluations,
    type EvaluationDiff,
    type NodeComparison,
    type NumberDiff,
    type PathStep,
    type ReadyNodeEvaluation,
    type TreeNode,
} from "@ro-ratorio-branch/core/platform-neutral";
import { type GearDiffRow, gearDiffRowsOf, newlyEquippedIn } from "./compare-view-model.ts";
import { rootLabel } from "./labels.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";

/** What the looked-at node is measured against. */
export type Baseline = "root" | "parent";

export interface ComparisonSide {
    readonly label: string;
    readonly evaluation: ReadyNodeEvaluation;
}

/** Everything the Compare views show for one pair. */
export interface Comparison {
    readonly node: TreeNode;
    /** `undefined` for a node directly under the root, which has only the root to be measured against. */
    readonly parentNode: TreeNode | undefined;
    readonly sideA: ComparisonSide;
    readonly sideB: ComparisonSide;
    readonly diff: EvaluationDiff;
    readonly gearRows: readonly GearDiffRow[];
    /** Derived stats and bonuses that differ, without upstream's display-only duplicates. */
    readonly derivedNumbers: readonly NumberDiff[];
    readonly newlyEquipped: { readonly itemIds: readonly number[]; readonly cardOrEnchantIds: readonly number[] };
    /** The steps from the root to the looked-at node, whichever side it is on. */
    readonly pathSteps: readonly PathStep[];
    readonly nodeComparison: Extract<NodeComparison, { state: "ready" }> | undefined;
}

/** `null` while the tree is still calculating, or when the node or its baseline has no numbers. */
export function comparisonOf(workspace: TreeWorkspace, nodeId: string, baseline: Baseline, isSwapped: boolean): Comparison | null {
    const { tree, evaluation, comparison } = workspace;
    const node = tree.nodes.find((candidate) => candidate.id === nodeId);
    const nodeEvaluation = evaluation?.nodes.get(nodeId);
    const parentNode = node?.parentId == null ? undefined : tree.nodes.find((candidate) => candidate.id === node.parentId);
    const usesParent = baseline === "parent" && parentNode !== undefined;
    const baselineEvaluation = usesParent ? evaluation?.nodes.get(parentNode.id) : evaluation?.root;
    if (evaluation === null || node === undefined || nodeEvaluation?.state !== "ready" || baselineEvaluation?.state !== "ready") {
        return null;
    }

    const baselineSide = { label: usesParent ? parentNode.label : rootLabel, evaluation: baselineEvaluation };
    const nodeSide = { label: node.label, evaluation: nodeEvaluation };
    const [sideA, sideB] = isSwapped ? [nodeSide, baselineSide] : [baselineSide, nodeSide];
    const diff = diffEvaluations(sideA.evaluation, sideB.evaluation);
    const nodeComparison = comparison?.nodes.find((candidate) => candidate.id === nodeId);

    return {
        node,
        parentNode,
        sideA,
        sideB,
        diff,
        gearRows: diff.gear.flatMap(gearDiffRowsOf),
        derivedNumbers: [...diff.stats.filter((stat) => !stat.name.startsWith("DISP_")), ...diff.bonuses],
        newlyEquipped: newlyEquippedIn(diff),
        pathSteps: breakDownPath(tree, evaluation, nodeId) ?? [],
        nodeComparison: nodeComparison?.state === "ready" ? nodeComparison : undefined,
    };
}
