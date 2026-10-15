import type { Character } from "../build/build-format.ts";
import { canonicalJson } from "../calculation/remember-outcomes.ts";
import { equipmentSlots } from "../character-vocabulary.ts";
import { changesBetween, type InexpressibleDifference } from "../tree/changes-between.ts";
import { resolveTree } from "../tree/resolve-tree.ts";
import { firstUnusedId } from "./add-to-workspace.ts";
import { addLockerPiece } from "./edit-workspace.ts";
import { characterOf, gearPieceOf, treeOf, UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import type { Workspace, WorkspaceChange, WorkspaceCharacter, WorkspaceTreeNode } from "./workspace-format.ts";

/**
 * A node of a tree laid out for the build editor: a copy of the workspace
 * in which the tree's character is the node's build. The editor changes
 * the copy; `storeNodeEdit()` then writes what the copy differs by from
 * the node's parent into the node. The copy itself is never stored, so it
 * can be made again from the stored workspace after every change.
 */
export interface NodeEdit {
    readonly treeId: string;
    readonly nodeId: string;
    /** The build the node's changes are counted from: its parent's, or the root's. */
    readonly parentCharacter: Character;
    readonly workspace: Workspace;
}

/**
 * Lays a node out for editing. `undefined` for a node the tree does not
 * have or whose changes no longer fit: such a node has no build to show.
 *
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function startNodeEdit(workspace: Workspace, treeId: string, nodeId: string): NodeEdit | undefined {
    const tree = treeOf(workspace, treeId);
    const node = tree.nodes.find((candidate) => candidate.id === nodeId);
    const resolutionOfNodeId = resolveTree(tree);
    const resolution = resolutionOfNodeId.get(nodeId);
    if (node === undefined || resolution?.state !== "resolved") {
        return undefined;
    }
    const parentResolution = node.parentId === null ? undefined : resolutionOfNodeId.get(node.parentId);
    const parentCharacter = parentResolution?.state === "resolved" ? parentResolution.character : tree.root;
    const characterId = workspace.trees[treeId]?.characterId ?? "";
    return { treeId, nodeId, parentCharacter, workspace: withCharacterWearing(workspace, characterId, resolution.character) };
}

/**
 * The workspace with one of its characters turned into the given build.
 * A slot keeps the locker piece it holds when that is the piece of the
 * build; otherwise it takes a locker piece that is, or a new one that is
 * not owned. No piece that is in the locker is changed.
 */
export function withCharacterWearing(workspace: Workspace, characterId: string, build: Character): Workspace {
    const workspaceCharacter = workspace.characters[characterId];
    if (workspaceCharacter === undefined) {
        throw new UnknownWorkspaceEntryError("character", characterId);
    }
    let nextWorkspace = workspace;
    const equipment: WorkspaceCharacter["equipment"] = {};
    for (const slot of equipmentSlots) {
        const piece = build.equipment[slot];
        if (piece === undefined) {
            continue;
        }
        const pieceKey = canonicalJson(piece);
        const isThePiece = (gearPieceId: string | undefined) => {
            const lockerPiece = gearPieceId === undefined ? undefined : nextWorkspace.gearPieces[gearPieceId];
            return lockerPiece !== undefined && canonicalJson(gearPieceOf(lockerPiece)) === pieceKey;
        };
        const heldPieceId = workspaceCharacter.equipment[slot];
        const samePieceId = isThePiece(heldPieceId) ? heldPieceId : Object.keys(nextWorkspace.gearPieces).find(isThePiece);
        if (samePieceId !== undefined) {
            equipment[slot] = samePieceId;
        } else {
            const added = addLockerPiece(nextWorkspace, { ...piece, owned: false }, slot);
            nextWorkspace = added.workspace;
            equipment[slot] = added.gearPieceId;
        }
    }
    const { equipment: _buildEquipment, ...buildFields } = build;
    const character: WorkspaceCharacter = { ...buildFields, name: workspaceCharacter.name, equipment };
    return { ...nextWorkspace, characters: { ...nextWorkspace.characters, [characterId]: character } };
}

export interface NodeEditStored {
    readonly workspace: Workspace;
    /** What the editor changed that a node cannot hold; the node is as it was in those respects. */
    readonly inexpressible: readonly InexpressibleDifference[];
}

/**
 * Writes an edited copy back into the stored workspace: the node takes
 * the changes that turn its parent's build into the copy's, and the tree
 * takes the copy's scenario, which every node shares. The locker and the
 * characters of the stored workspace stay as they are. A workspace whose
 * node is gone meanwhile comes back unchanged.
 *
 * @throws {UnknownWorkspaceEntryError} when the stored workspace has no such tree.
 */
export function storeNodeEdit(workspace: Workspace, edit: NodeEdit, editedWorkspace: Workspace): NodeEditStored {
    const tree = workspace.trees[edit.treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", edit.treeId);
    }
    if (!tree.nodes.some((node) => node.id === edit.nodeId)) {
        return { workspace, inexpressible: [] };
    }
    const editedCharacter = characterOf(editedWorkspace, tree.characterId);
    const { changes, inexpressible } = changesBetween(edit.parentCharacter, editedCharacter);
    const scenario = editedWorkspace.trees[edit.treeId]?.scenario ?? tree.scenario;

    // A node whose build the copy did not change keeps its changes as they are written.
    const storedBuild = resolveTree(treeOf(workspace, edit.treeId)).get(edit.nodeId);
    const isBuildUnchanged = storedBuild?.state === "resolved" && canonicalJson(storedBuild.character) === canonicalJson(editedCharacter);

    // A slot that wears a piece of the stored locker, unchanged, points at it instead of holding a copy of it.
    const wornPieceIdOfSlot = editedWorkspace.characters[tree.characterId]?.equipment ?? {};
    const linkedChanges = changes.map((change): WorkspaceChange => {
        const wornPieceId = change.kind === "setGearPiece" && change.gearPiece !== null ? wornPieceIdOfSlot[change.slot] : undefined;
        const lockerPiece = wornPieceId === undefined ? undefined : workspace.gearPieces[wornPieceId];
        if (change.kind !== "setGearPiece" || wornPieceId === undefined || lockerPiece === undefined || canonicalJson(gearPieceOf(lockerPiece)) !== canonicalJson(change.gearPiece)) {
            return change;
        }
        return { kind: "equipLockerPiece", slot: change.slot, gearPieceId: wornPieceId };
    });
    const nodes = isBuildUnchanged ? tree.nodes : tree.nodes.map((node) => (node.id === edit.nodeId ? { ...node, changes: linkedChanges } : node));
    return { workspace: { ...workspace, trees: { ...workspace.trees, [edit.treeId]: { ...tree, scenario, nodes } } }, inexpressible };
}

export interface AddedNode {
    readonly workspace: Workspace;
    readonly nodeId: string;
}

/**
 * Adds a node that changes nothing yet under the root (`null`) or under a
 * node of a tree: the place where a variation is then built. `undefined`
 * when the tree has no such parent.
 *
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function addEmptyTreeNode(workspace: Workspace, treeId: string, parentNodeId: string | null, label: string): AddedNode | undefined {
    const tree = workspace.trees[treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    if (parentNodeId !== null && !tree.nodes.some((node) => node.id === parentNodeId)) {
        return undefined;
    }
    const nodeId = firstUnusedId(Object.fromEntries(tree.nodes.map((node) => [node.id, node])), "branch");
    const node: WorkspaceTreeNode = { id: nodeId, parentId: parentNodeId, label, changes: [] };
    return { workspace: { ...workspace, trees: { ...workspace.trees, [treeId]: { ...tree, nodes: [...tree.nodes, node] } } }, nodeId };
}
