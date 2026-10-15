import type { Character } from "../build/build-format.ts";
import { applyChange, type StaleReason } from "./apply-change.ts";
import type { Tree, TreeNode } from "./tree-format.ts";

/** A change that no longer fits, and the node that holds it. */
export interface StaleChange {
    readonly nodeId: string;
    readonly changeIndex: number;
    readonly reason: StaleReason;
}

export type NodeResolution =
    | { readonly state: "resolved"; readonly character: Character }
    | { readonly state: "stale"; readonly staleChanges: readonly StaleChange[] };

/**
 * Works out each node's character: the root with every change on the node's
 * path applied. A node is stale when one of those changes no longer fits; its
 * descendants are stale with it, and report the same changes.
 */
export function resolveTree(tree: Tree): ReadonlyMap<string, NodeResolution> {
    const nodeOfId = new Map(tree.nodes.map((node) => [node.id, node]));
    const resolutionOfNodeId = new Map<string, NodeResolution>();

    function resolve(node: TreeNode): NodeResolution {
        const knownResolution = resolutionOfNodeId.get(node.id);
        if (knownResolution !== undefined) {
            return knownResolution;
        }
        const parentNode = node.parentId === null ? undefined : nodeOfId.get(node.parentId);
        const parentResolution: NodeResolution =
            parentNode === undefined ? { state: "resolved", character: tree.root } : resolve(parentNode);
        const resolution = resolveOnTopOf(parentResolution, node);
        resolutionOfNodeId.set(node.id, resolution);
        return resolution;
    }

    for (const node of tree.nodes) {
        resolve(node);
    }
    return resolutionOfNodeId;
}

function resolveOnTopOf(parentResolution: NodeResolution, node: TreeNode): NodeResolution {
    if (parentResolution.state === "stale") {
        return parentResolution;
    }
    let character = parentResolution.character;
    const staleChanges: StaleChange[] = [];
    node.changes.forEach((change, changeIndex) => {
        const application = applyChange(character, change);
        if (application.applied) {
            character = application.character;
        } else {
            staleChanges.push({ nodeId: node.id, changeIndex, reason: application.staleReason });
        }
    });
    return staleChanges.length > 0 ? { state: "stale", staleChanges } : { state: "resolved", character };
}
