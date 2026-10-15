import type { Character, Equipment, GearPiece } from "../build/build-format.ts";
import { equipmentSlots } from "../character-vocabulary.ts";
import type { Change, Tree } from "../tree/tree-format.ts";
import type { LockerPiece, Workspace, WorkspaceChange } from "./workspace-format.ts";

export class UnknownWorkspaceEntryError extends Error {
    readonly entryKind: "character" | "tree" | "gearPiece" | "gearLoadout" | "statLoadout";
    readonly entryId: string;

    constructor(entryKind: "character" | "tree" | "gearPiece" | "gearLoadout" | "statLoadout", entryId: string) {
        super(`The workspace has no ${entryKind} with ID ${entryId}`);
        this.name = "UnknownWorkspaceEntryError";
        this.entryKind = entryKind;
        this.entryId = entryId;
    }
}

/** A locker piece as it appears in a build: without the locker's own bookkeeping. */
export function gearPieceOf(lockerPiece: LockerPiece): GearPiece {
    const { owned: _owned, ...gearPiece } = lockerPiece;
    return gearPiece;
}

/**
 * The character with the pieces it wears written out in full, as a build file holds it.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character.
 */
export function characterOf(workspace: Workspace, characterId: string): Character {
    const workspaceCharacter = workspace.characters[characterId];
    if (workspaceCharacter === undefined) {
        throw new UnknownWorkspaceEntryError("character", characterId);
    }
    const { name: _name, equipment: pieceIdOfSlot, ...characterFields } = workspaceCharacter;
    const equipment: Equipment = {};
    for (const slot of equipmentSlots) {
        const lockerPiece = workspace.gearPieces[pieceIdOfSlot[slot] ?? ""];
        if (lockerPiece !== undefined) {
            equipment[slot] = gearPieceOf(lockerPiece);
        }
    }
    return { ...characterFields, equipment };
}

/**
 * The tree as a tree file holds it: its character as the root, and every
 * locker piece a node equips written out in full. The result depends on
 * nothing in the workspace, so it can be calculated, exported and shared.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree, or the tree's character is missing.
 */
export function treeOf(workspace: Workspace, treeId: string): Tree {
    const workspaceTree = workspace.trees[treeId];
    if (workspaceTree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    return {
        formatVersion: 1,
        scenario: workspaceTree.scenario,
        root: characterOf(workspace, workspaceTree.characterId),
        nodes: workspaceTree.nodes.map((node) => ({
            ...node,
            changes: node.changes.map((change) => inlineChangeOf(workspace, change)),
        })),
    };
}

function inlineChangeOf(workspace: Workspace, change: WorkspaceChange): Change {
    if (change.kind !== "equipLockerPiece") {
        return change;
    }
    const lockerPiece = workspace.gearPieces[change.gearPieceId];
    return { kind: "setGearPiece", slot: change.slot, gearPiece: lockerPiece === undefined ? null : gearPieceOf(lockerPiece) };
}
