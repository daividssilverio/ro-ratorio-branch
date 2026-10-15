import { resolveTree } from "../tree/resolve-tree.ts";
import { withCharacterWearing } from "./node-edit.ts";
import { treeOf, UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import type { Workspace, WorkspaceTreeNode } from "./workspace-format.ts";

export type NodeFolded =
    /** `parentNodeId` is what took the node's changes: a node, or `null` for the root. */
    | { readonly state: "folded"; readonly workspace: Workspace; readonly parentNodeId: string | null }
    | { readonly state: "unknownNode" }
    /** A change on the way to the node no longer fits, so there is no build for the root to take. */
    | { readonly state: "stale" };

/**
 * Makes a node the root of its tree: the character takes the node's build
 * (its gear, stats and settings), and the node and the nodes it built on
 * are gone, since the root now is what they led to. Every node that built
 * on one of them builds on the root instead and keeps its changes as they
 * are written, so the rest of the tree is weighed against the new state; a
 * change that no longer fits shows as stale.
 *
 * The locker says what is owned, and this is a plan: no piece in the
 * locker is changed. A slot wears the locker piece that is the node's
 * piece; where the locker has none, the piece is added as not owned.
 * Writing the plan into owned pieces is `commitNodeToLocker()`, or done
 * by hand in the locker.
 *
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function makeNodeTheRoot(workspace: Workspace, treeId: string, nodeId: string): NodeFolded {
    const tree = workspace.trees[treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    const nodeOfId = new Map(tree.nodes.map((node) => [node.id, node]));
    if (!nodeOfId.has(nodeId)) {
        return { state: "unknownNode" };
    }
    const resolution = resolveTree(treeOf(workspace, treeId)).get(nodeId);
    if (resolution?.state !== "resolved") {
        return { state: "stale" };
    }
    const pathNodeIds = new Set<string>();
    for (let node = nodeOfId.get(nodeId); node !== undefined; node = nodeOfId.get(node.parentId ?? "")) {
        pathNodeIds.add(node.id);
    }
    const nodes = tree.nodes
        .filter((node) => !pathNodeIds.has(node.id))
        .map((node): WorkspaceTreeNode => (node.parentId !== null && pathNodeIds.has(node.parentId) ? { ...node, parentId: null } : node));
    const withRootAsNode = withCharacterWearing(workspace, tree.characterId, resolution.character);
    return { state: "folded", workspace: { ...withRootAsNode, trees: { ...withRootAsNode.trees, [treeId]: { ...tree, nodes } } }, parentNodeId: null };
}

/**
 * Makes a node and the node it builds on one step: the node's changes
 * move into its parent after the parent's own, the costs of the two are
 * added, the nodes that built on the node build on the parent instead,
 * and the node is gone. Every other node keeps its changes as they are
 * written, so the nodes beside the folded one now build on what it added.
 *
 * A node directly under the root has no node to fold into: folding it is
 * making it the root.
 *
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function foldNodeIntoParent(workspace: Workspace, treeId: string, nodeId: string): NodeFolded {
    const tree = workspace.trees[treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    const node = tree.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
        return { state: "unknownNode" };
    }
    const parentNodeId = node.parentId;
    if (parentNodeId === null) {
        return makeNodeTheRoot(workspace, treeId, nodeId);
    }
    const nodes = tree.nodes
        .filter((candidate) => candidate.id !== nodeId)
        .map((candidate): WorkspaceTreeNode => {
            if (candidate.id !== parentNodeId) {
                return candidate.parentId === nodeId ? { ...candidate, parentId: parentNodeId } : candidate;
            }
            const zenyCost = candidate.zenyCost === undefined && node.zenyCost === undefined ? undefined : (candidate.zenyCost ?? 0) + (node.zenyCost ?? 0);
            const { zenyCost: _ownCost, ...parentWithoutCost } = candidate;
            return {
                ...parentWithoutCost,
                changes: [...candidate.changes, ...node.changes],
                ...(zenyCost === undefined ? {} : { zenyCost }),
                ...(candidate.favorite === true || node.favorite === true ? { favorite: true } : {}),
            };
        });
    return { state: "folded", workspace: { ...workspace, trees: { ...workspace.trees, [treeId]: { ...tree, nodes } } }, parentNodeId };
}
