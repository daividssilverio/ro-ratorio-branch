import type { Scenario } from "../build/build-format.ts";
import type { EquipmentSlot } from "../character-vocabulary.ts";
import { firstUnusedId } from "./add-to-workspace.ts";
import { UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import type { LockerPiece, Workspace, WorkspaceCharacter } from "./workspace-format.ts";

/** Who wears a locker piece, which tree nodes equip it and which loadouts hold it. */
export interface LockerPieceUsage {
    readonly characterIds: readonly string[];
    readonly nodes: readonly { readonly treeId: string; readonly nodeId: string }[];
    readonly gearLoadoutIds: readonly string[];
}

/** The usage of every piece in the locker, also of those nothing uses. */
export function lockerPieceUsage(workspace: Workspace): ReadonlyMap<string, LockerPieceUsage> {
    const usageOfPieceId = new Map<string, { characterIds: string[]; nodes: { treeId: string; nodeId: string }[]; gearLoadoutIds: string[] }>(
        Object.keys(workspace.gearPieces).map((gearPieceId) => [gearPieceId, { characterIds: [], nodes: [], gearLoadoutIds: [] }]),
    );
    for (const [loadoutId, loadout] of Object.entries(workspace.gearLoadouts ?? {})) {
        for (const gearPieceId of Object.values(loadout.equipment)) {
            usageOfPieceId.get(gearPieceId)?.gearLoadoutIds.push(loadoutId);
        }
    }
    for (const [characterId, character] of Object.entries(workspace.characters)) {
        for (const gearPieceId of Object.values(character.equipment)) {
            usageOfPieceId.get(gearPieceId)?.characterIds.push(characterId);
        }
    }
    for (const [treeId, tree] of Object.entries(workspace.trees)) {
        for (const node of tree.nodes) {
            for (const change of node.changes) {
                if (change.kind === "equipLockerPiece") {
                    usageOfPieceId.get(change.gearPieceId)?.nodes.push({ treeId, nodeId: node.id });
                }
            }
        }
    }
    return usageOfPieceId;
}

export interface AddedLockerPiece {
    readonly workspace: Workspace;
    readonly gearPieceId: string;
}

/** Puts a new piece into the locker under an unused ID that starts with the prefix. */
export function addLockerPiece(workspace: Workspace, lockerPiece: LockerPiece, idPrefix: string): AddedLockerPiece {
    const gearPieceId = firstUnusedId(workspace.gearPieces, idPrefix);
    return { workspace: { ...workspace, gearPieces: { ...workspace.gearPieces, [gearPieceId]: lockerPiece } }, gearPieceId };
}

/**
 * Replaces a locker piece. Every character and node that uses it sees the change.
 * @throws {UnknownWorkspaceEntryError} when the locker has no such piece.
 */
export function replaceLockerPiece(workspace: Workspace, gearPieceId: string, lockerPiece: LockerPiece): Workspace {
    if (!Object.hasOwn(workspace.gearPieces, gearPieceId)) {
        throw new UnknownWorkspaceEntryError("gearPiece", gearPieceId);
    }
    return { ...workspace, gearPieces: { ...workspace.gearPieces, [gearPieceId]: lockerPiece } };
}

export type LockerPieceRemoval =
    | { readonly removed: true; readonly workspace: Workspace }
    | { readonly removed: false; readonly usage: LockerPieceUsage };

/**
 * Takes a piece out of the locker, unless a character wears it, a node
 * equips it or a loadout holds it: removing it then would leave them
 * pointing at nothing.
 * @throws {UnknownWorkspaceEntryError} when the locker has no such piece.
 */
export function removeLockerPiece(workspace: Workspace, gearPieceId: string): LockerPieceRemoval {
    const usage = lockerPieceUsage(workspace).get(gearPieceId);
    if (usage === undefined) {
        throw new UnknownWorkspaceEntryError("gearPiece", gearPieceId);
    }
    if (usage.characterIds.length > 0 || usage.nodes.length > 0 || usage.gearLoadoutIds.length > 0) {
        return { removed: false, usage };
    }
    const { [gearPieceId]: _removedPiece, ...remainingGearPieces } = workspace.gearPieces;
    return { removed: true, workspace: { ...workspace, gearPieces: remainingGearPieces } };
}

/** A left-hand weapon and a shield take the same hand. */
const slotThatGivesWayTo: Readonly<Partial<Record<EquipmentSlot, EquipmentSlot>>> = { leftHand: "shield", shield: "leftHand" };

/**
 * Puts a locker piece into a character's slot, or empties the slot for `null`.
 * Wearing a left-hand weapon takes the shield off, and wearing a shield the left-hand weapon.
 * @throws {UnknownWorkspaceEntryError} when the character or the piece is not in the workspace.
 */

export function wearLockerPiece(workspace: Workspace, characterId: string, slot: EquipmentSlot, gearPieceId: string | null): Workspace {
    const character = workspace.characters[characterId];
    if (character === undefined) {
        throw new UnknownWorkspaceEntryError("character", characterId);
    }
    if (gearPieceId !== null && !Object.hasOwn(workspace.gearPieces, gearPieceId)) {
        throw new UnknownWorkspaceEntryError("gearPiece", gearPieceId);
    }
    const slotsToEmpty = [slot, gearPieceId === null ? undefined : slotThatGivesWayTo[slot]];
    const otherSlots: WorkspaceCharacter["equipment"] = Object.fromEntries(Object.entries(character.equipment).filter(([wornSlot]) => !slotsToEmpty.includes(wornSlot as EquipmentSlot)));
    const equipment = gearPieceId === null ? otherSlots : { ...otherSlots, [slot]: gearPieceId };
    return { ...workspace, characters: { ...workspace.characters, [characterId]: { ...character, equipment } } };
}

/** @throws {UnknownWorkspaceEntryError} when the workspace has no such character. */
export function replaceCharacter(workspace: Workspace, characterId: string, character: WorkspaceCharacter): Workspace {
    if (!Object.hasOwn(workspace.characters, characterId)) {
        throw new UnknownWorkspaceEntryError("character", characterId);
    }
    return { ...workspace, characters: { ...workspace.characters, [characterId]: character } };
}

export interface CharacterRemoval {
    readonly workspace: Workspace;
    /** The trees the character was the root of, which went with it. */
    readonly removedTreeIds: readonly string[];
}

/**
 * The workspace without a character and the trees it is the root of. The
 * locker keeps every piece the character wore, and loadouts stay.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character.
 */
export function removeCharacter(workspace: Workspace, characterId: string): CharacterRemoval {
    if (!Object.hasOwn(workspace.characters, characterId)) {
        throw new UnknownWorkspaceEntryError("character", characterId);
    }
    const { [characterId]: _removedCharacter, ...characters } = workspace.characters;
    const treeEntries = Object.entries(workspace.trees);
    const removedTreeIds = treeEntries.filter(([, tree]) => tree.characterId === characterId).map(([treeId]) => treeId);
    const trees = Object.fromEntries(treeEntries.filter(([, tree]) => tree.characterId !== characterId));
    return { workspace: { ...workspace, characters, trees }, removedTreeIds };
}

/** @throws {UnknownWorkspaceEntryError} when the workspace has no such tree. */
export function replaceTreeScenario(workspace: Workspace, treeId: string, scenario: Scenario): Workspace {
    const tree = workspace.trees[treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    return { ...workspace, trees: { ...workspace.trees, [treeId]: { ...tree, scenario } } };
}

/**
 * The workspace without a node of a tree and without the nodes that build on it.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function removeTreeNode(workspace: Workspace, treeId: string, nodeId: string): Workspace {
    const tree = workspace.trees[treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    const removedNodeIds = new Set([nodeId]);
    // A node may come before its parent in the list, so the sweep repeats until it finds nothing more.
    for (let foundMore = true; foundMore; ) {
        foundMore = false;
        for (const node of tree.nodes) {
            if (node.parentId !== null && removedNodeIds.has(node.parentId) && !removedNodeIds.has(node.id)) {
                removedNodeIds.add(node.id);
                foundMore = true;
            }
        }
    }
    return { ...workspace, trees: { ...workspace.trees, [treeId]: { ...tree, nodes: tree.nodes.filter((node) => !removedNodeIds.has(node.id)) } } };
}

/** How many nodes build on a node, directly or through others: what goes with it when it is removed. */
export function descendantCountOf(workspace: Workspace, treeId: string, nodeId: string): number {
    const nodeCount = workspace.trees[treeId]?.nodes.length ?? 0;
    const hasNode = workspace.trees[treeId]?.nodes.some((node) => node.id === nodeId) ?? false;
    return hasNode ? nodeCount - (removeTreeNode(workspace, treeId, nodeId).trees[treeId]?.nodes.length ?? 0) - 1 : 0;
}
