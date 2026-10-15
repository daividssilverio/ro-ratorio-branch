import type { Character, Scenario } from "../build/build-format.ts";
import { equipmentSlots } from "../character-vocabulary.ts";
import type { Tree } from "../tree/tree-format.ts";
import { type LockerPiece, type Workspace, type WorkspaceCharacter, workspaceFormatVersion } from "./workspace-format.ts";

export function emptyWorkspace(): Workspace {
    return { formatVersion: workspaceFormatVersion, gearPieces: {}, characters: {}, trees: {} };
}

export interface AddedCharacter {
    readonly workspace: Workspace;
    readonly characterId: string;
}

export interface AddedTree extends AddedCharacter {
    readonly treeId: string;
}

/**
 * Adds a character, putting each piece it wears into the locker as an owned
 * piece. Nothing already in the workspace is changed or reused.
 */
export function addCharacterToWorkspace(workspace: Workspace, character: Character, name: string): AddedCharacter {
    const gearPieces: Record<string, LockerPiece> = { ...workspace.gearPieces };
    const equipment: WorkspaceCharacter["equipment"] = {};
    for (const slot of equipmentSlots) {
        const gearPiece = character.equipment[slot];
        if (gearPiece !== undefined) {
            const gearPieceId = firstUnusedId(gearPieces, slot);
            gearPieces[gearPieceId] = { ...gearPiece, owned: true };
            equipment[slot] = gearPieceId;
        }
    }
    const { equipment: _inlineEquipment, ...characterFields } = character;
    const characterId = firstUnusedId(workspace.characters, "character");
    return {
        workspace: {
            ...workspace,
            gearPieces,
            characters: { ...workspace.characters, [characterId]: { name, ...characterFields, equipment } },
        },
        characterId,
    };
}

/**
 * Adds a tree file's content: its root becomes a character with its gear in
 * the locker, its nodes are kept as they are. Resolving the added tree again
 * gives back the tree that was added.
 */
export function addTreeToWorkspace(workspace: Workspace, tree: Tree, name: string): AddedTree {
    const added = addCharacterToWorkspace(workspace, tree.root, name);
    const treeId = firstUnusedId(added.workspace.trees, "tree");
    return {
        ...added,
        workspace: {
            ...added.workspace,
            trees: {
                ...added.workspace.trees,
                [treeId]: { name, characterId: added.characterId, scenario: tree.scenario, nodes: tree.nodes },
            },
        },
        treeId,
    };
}

/** Adds an empty tree for a character that is already in the workspace. */
export function addEmptyTreeToWorkspace(workspace: Workspace, characterId: string, scenario: Scenario, name: string): AddedTree {
    const treeId = firstUnusedId(workspace.trees, "tree");
    return {
        workspace: { ...workspace, trees: { ...workspace.trees, [treeId]: { name, characterId, scenario, nodes: [] } } },
        characterId,
        treeId,
    };
}

/** `prefix-1`, or the first `prefix-n` that is not a key of the given entries yet. */
export function firstUnusedId(entries: Readonly<Record<string, unknown>>, prefix: string): string {
    for (let suffix = 1; ; suffix++) {
        const candidateId = `${prefix}-${suffix}`;
        if (!Object.hasOwn(entries, candidateId)) {
            return candidateId;
        }
    }
}
