import type { BattleSummary } from "../engine-adapter/battle-summary.ts";
import { diffEvaluations, type EvaluationDiff } from "../tree/diff-evaluations.ts";
import type { TreeEvaluation } from "../tree/evaluate-tree.ts";
import { parseTree } from "../tree/parse-tree.ts";
import { type RankedNode, type RankingMetric, rankNodes } from "../tree/rank-nodes.ts";
import type { Tree, TreeNode } from "../tree/tree-format.ts";

/**
 * The tree with the node added, or put in place of the node that has its
 * ID. The result is checked like a tree file.
 *
 * @throws {InvalidTreeError} when the node breaks the schema or its parent is missing or circular.
 */
export function withNode(tree: Tree, node: TreeNode): Tree {
    const isReplacement = tree.nodes.some((existingNode) => existingNode.id === node.id);
    const nodes = isReplacement ? tree.nodes.map((existingNode) => (existingNode.id === node.id ? node : existingNode)) : [...tree.nodes, node];
    return parseTree({ ...tree, nodes });
}

/** One side of a comparison: the root for `null`, a node otherwise. */
export interface ComparedSide {
    readonly nodeId: string | null;
    readonly label: string | null;
    readonly battleSummary: BattleSummary;
}

export type NodePairComparison =
    | { readonly state: "compared"; readonly from: ComparedSide; readonly to: ComparedSide; readonly diff: EvaluationDiff }
    | { readonly state: "unknownNode"; readonly nodeId: string }
    /** The node has no numbers: a change of it no longer applies, or the engine cannot calculate its build. */
    | { readonly state: "notComparable"; readonly nodeId: string | null; readonly reason: "stale" | "notCalculable" };

/** What differs between two builds of a tree, each the root (`null`) or a node. */
export function compareNodePair(tree: Tree, evaluation: TreeEvaluation, fromNodeId: string | null, toNodeId: string | null): NodePairComparison {
    const sides = [fromNodeId, toNodeId].map((nodeId) => {
        const nodeEvaluation = nodeId === null ? evaluation.root : evaluation.nodes.get(nodeId);
        const label = nodeId === null ? null : (tree.nodes.find((node) => node.id === nodeId)?.label ?? null);
        return { nodeId, label, nodeEvaluation };
    });
    for (const { nodeId, nodeEvaluation } of sides) {
        if (nodeEvaluation === undefined) {
            return { state: "unknownNode", nodeId: nodeId ?? "" };
        }
        if (nodeEvaluation.state !== "ready") {
            return { state: "notComparable", nodeId, reason: nodeEvaluation.state };
        }
    }
    const [from, to] = sides;
    if (from?.nodeEvaluation?.state !== "ready" || to?.nodeEvaluation?.state !== "ready") {
        throw new Error("Both sides were checked to have numbers");
    }
    return {
        state: "compared",
        from: { nodeId: from.nodeId, label: from.label, battleSummary: from.nodeEvaluation.battleSummary },
        to: { nodeId: to.nodeId, label: to.label, battleSummary: to.nodeEvaluation.battleSummary },
        diff: diffEvaluations(from.nodeEvaluation, to.nodeEvaluation),
    };
}

/** The nodes nothing builds on, best first for the metric: the finished upgrade paths of the tree. */
export function rankLeaves(tree: Tree, evaluation: TreeEvaluation, metric: RankingMetric): RankedNode[] {
    return rankNodes(tree, evaluation, metric).filter((rankedNode) => rankedNode.isLeaf);
}
