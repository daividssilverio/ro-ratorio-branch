import type { TreeEvaluation } from "./evaluate-tree.ts";
import type { Tree, TreeNode } from "./tree-format.ts";

/** One node on a path, measured against the node before it. */
export interface PathStep {
    readonly nodeId: string;
    readonly label: string;
    readonly damagePerSecondBefore: number;
    readonly damagePerSecondAfter: number;
    /** `undefined` when the step is unpriced. */
    readonly zenyCost: number | undefined;
}

/** The nodes from the root down to the given node, the node itself last. */
export function pathToNode(tree: Tree, nodeId: string): TreeNode[] {
    const nodeOfId = new Map(tree.nodes.map((node) => [node.id, node]));
    const path: TreeNode[] = [];
    for (let node = nodeOfId.get(nodeId); node !== undefined; node = nodeOfId.get(node.parentId ?? "")) {
        path.unshift(node);
    }
    return path;
}

/**
 * What each step on the way to a node adds, measured against the step before
 * it. The gains are in path order and must be read that way: bonuses multiply,
 * so the same step is worth a different amount elsewhere on the path, and the
 * steps are not shares of the total.
 *
 * Returns `undefined` when the root or a node on the path has no numbers.
 */
export function breakDownPath(tree: Tree, evaluation: TreeEvaluation, nodeId: string): PathStep[] | undefined {
    if (evaluation.root.state !== "ready") {
        return undefined;
    }
    let damagePerSecondBefore = evaluation.root.battleSummary.averageDamagePerSecond;
    const steps: PathStep[] = [];
    for (const node of pathToNode(tree, nodeId)) {
        const nodeEvaluation = evaluation.nodes.get(node.id);
        if (nodeEvaluation?.state !== "ready") {
            return undefined;
        }
        const damagePerSecondAfter = nodeEvaluation.battleSummary.averageDamagePerSecond;
        steps.push({
            nodeId: node.id,
            label: node.label,
            damagePerSecondBefore,
            damagePerSecondAfter,
            zenyCost: node.zenyCost,
        });
        damagePerSecondBefore = damagePerSecondAfter;
    }
    return steps;
}
