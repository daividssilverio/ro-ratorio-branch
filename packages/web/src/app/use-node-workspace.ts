import { type InexpressibleDifference, type NodeEdit, rankingMetrics, startNodeEdit, storeNodeEdit, type TreeComparison, type TreeEvaluation, treeOf } from "@ro-ratorio-branch/core/platform-neutral";
import { useMemo } from "react";
import type { TreeWorkspace } from "./use-tree-workspace.ts";

const noRankings = Object.fromEntries(rankingMetrics.map((metric) => [metric, []])) as unknown as TreeComparison["rankings"];

/**
 * A node of the open tree as the build editor sees a workspace: the
 * character is the node's build, the result is the node's, and a change
 * is written into the node (or, for the scenario, into the tree). The
 * view is made again from what is stored after every change, so it holds
 * no state of its own. `null` for no node, and for a node that cannot be
 * laid out: one the tree does not have, or one whose changes no longer fit.
 */
export function useNodeWorkspace(stored: TreeWorkspace, nodeId: string | null, onInexpressible: (differences: readonly InexpressibleDifference[]) => void): TreeWorkspace | null {
    const edit: NodeEdit | undefined = useMemo(
        () => (nodeId === null ? undefined : startNodeEdit(stored.workspace, stored.activeTreeId, nodeId)),
        [stored.workspace, stored.activeTreeId, nodeId],
    );
    const tree = useMemo(() => (edit === undefined ? null : { ...treeOf(edit.workspace, edit.treeId), nodes: [] }), [edit]);
    if (edit === undefined || tree === null) {
        return null;
    }
    const result = stored.comparison?.nodes.find((nodeComparison) => nodeComparison.id === nodeId);
    const comparison: TreeComparison | null =
        result === undefined || result.state === "stale"
            ? null
            : { root: result.state === "ready" ? { state: "ready", battleSummary: result.battleSummary } : { state: "notCalculable", issues: result.issues }, nodes: [], rankings: noRankings };

    // The editor shows the node's build as its root, so the node's calculation stands as the root's too.
    const nodeEvaluation = nodeId === null ? undefined : stored.evaluation?.nodes.get(nodeId);
    const evaluation: TreeEvaluation | null = nodeEvaluation === undefined || nodeEvaluation.state === "stale" ? null : { root: nodeEvaluation, nodes: new Map() };

    function storeEdited(editedWorkspace: TreeWorkspace["workspace"]) {
        if (edit === undefined) {
            return;
        }
        const storedEdit = storeNodeEdit(stored.workspace, edit, editedWorkspace);
        stored.updateWorkspace(storedEdit.workspace);
        onInexpressible(storedEdit.inexpressible);
    }

    return { ...stored, workspace: edit.workspace, tree, comparison, evaluation, updateWorkspace: storeEdited, takeWorkspace: storeEdited };
}
