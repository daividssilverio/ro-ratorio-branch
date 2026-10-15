import { baseStatNames, type EquipmentSlot, equipmentSlots, traitStatNames } from "../character-vocabulary.ts";
import { firstUnusedId } from "./add-to-workspace.ts";
import { UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import type { GearLoadout, StatLoadout, Workspace, WorkspaceChange, WorkspaceCharacter, WorkspaceTreeNode } from "./workspace-format.ts";

export interface SavedLoadout {
    readonly workspace: Workspace;
    readonly loadoutId: string;
}

const noTraitStats = { pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 };

function characterIn(workspace: Workspace, characterId: string): WorkspaceCharacter {
    const character = workspace.characters[characterId];
    if (character === undefined) {
        throw new UnknownWorkspaceEntryError("character", characterId);
    }
    return character;
}

function gearLoadoutIn(workspace: Workspace, loadoutId: string): GearLoadout {
    const loadout = workspace.gearLoadouts?.[loadoutId];
    if (loadout === undefined) {
        throw new UnknownWorkspaceEntryError("gearLoadout", loadoutId);
    }
    return loadout;
}

function statLoadoutIn(workspace: Workspace, loadoutId: string): StatLoadout {
    const loadout = workspace.statLoadouts?.[loadoutId];
    if (loadout === undefined) {
        throw new UnknownWorkspaceEntryError("statLoadout", loadoutId);
    }
    return loadout;
}

/**
 * Keeps what a character wears now as a named gear loadout.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character.
 */
export function saveGearLoadout(workspace: Workspace, characterId: string, name: string): SavedLoadout {
    const { equipment } = characterIn(workspace, characterId);
    const loadoutId = firstUnusedId(workspace.gearLoadouts ?? {}, "gear-loadout");
    return { workspace: { ...workspace, gearLoadouts: { ...workspace.gearLoadouts, [loadoutId]: { name, equipment: { ...equipment } } } }, loadoutId };
}

/**
 * Puts a gear loadout's pieces on a character. Slots the loadout does not list keep what they hold.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character or loadout.
 */
export function applyGearLoadout(workspace: Workspace, characterId: string, loadoutId: string): Workspace {
    const character = characterIn(workspace, characterId);
    const equipment = { ...character.equipment, ...gearLoadoutIn(workspace, loadoutId).equipment };
    return { ...workspace, characters: { ...workspace.characters, [characterId]: { ...character, equipment } } };
}

/**
 * The changes that put a gear loadout on a character, one per slot where it
 * differs from what the character wears: what a tree node needs to try the
 * loadout as a branch.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character or loadout.
 */
export function gearLoadoutChanges(workspace: Workspace, characterId: string, loadoutId: string): WorkspaceChange[] {
    const { equipment: wornPieceIdOfSlot } = characterIn(workspace, characterId);
    const loadoutPieceIdOfSlot = gearLoadoutIn(workspace, loadoutId).equipment;
    return equipmentSlots.flatMap((slot: EquipmentSlot): WorkspaceChange[] => {
        const gearPieceId = loadoutPieceIdOfSlot[slot];
        return gearPieceId === undefined || gearPieceId === wornPieceIdOfSlot[slot] ? [] : [{ kind: "equipLockerPiece", slot, gearPieceId }];
    });
}

/**
 * Gives a gear loadout another name.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such loadout.
 */
export function renameGearLoadout(workspace: Workspace, loadoutId: string, name: string): Workspace {
    return withLoadouts(workspace, "gearLoadouts", { ...workspace.gearLoadouts, [loadoutId]: { ...gearLoadoutIn(workspace, loadoutId), name } });
}

/**
 * Gives a stat loadout another name.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such loadout.
 */
export function renameStatLoadout(workspace: Workspace, loadoutId: string, name: string): Workspace {
    return withLoadouts(workspace, "statLoadouts", { ...workspace.statLoadouts, [loadoutId]: { ...statLoadoutIn(workspace, loadoutId), name } });
}

/** Takes a gear loadout out of the workspace. Its pieces stay in the locker. */
export function removeGearLoadout(workspace: Workspace, loadoutId: string): Workspace {
    const { [loadoutId]: _removedLoadout, ...remainingLoadouts } = workspace.gearLoadouts ?? {};
    return withLoadouts(workspace, "gearLoadouts", remainingLoadouts);
}

/**
 * Keeps a character's base and trait stats as a named stat loadout.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character.
 */
export function saveStatLoadout(workspace: Workspace, characterId: string, name: string): SavedLoadout {
    const character = characterIn(workspace, characterId);
    const loadoutId = firstUnusedId(workspace.statLoadouts ?? {}, "stat-loadout");
    const loadout: StatLoadout = { name, baseStats: { ...character.baseStats } };
    if (character.traitStats !== undefined) {
        loadout.traitStats = { ...character.traitStats };
    }
    return { workspace: { ...workspace, statLoadouts: { ...workspace.statLoadouts, [loadoutId]: loadout } }, loadoutId };
}

/**
 * Gives a character the stats of a stat loadout. A loadout without trait stats sets them all to 0.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character or loadout.
 */
export function applyStatLoadout(workspace: Workspace, characterId: string, loadoutId: string): Workspace {
    const { traitStats: _previousTraitStats, ...characterWithoutTraitStats } = characterIn(workspace, characterId);
    const loadout = statLoadoutIn(workspace, loadoutId);
    const character: WorkspaceCharacter = { ...characterWithoutTraitStats, baseStats: { ...loadout.baseStats } };
    if (loadout.traitStats !== undefined) {
        character.traitStats = { ...loadout.traitStats };
    }
    return { ...workspace, characters: { ...workspace.characters, [characterId]: character } };
}

/**
 * The changes that give a character a stat loadout's stats, one per stat that differs.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such character or loadout.
 */
export function statLoadoutChanges(workspace: Workspace, characterId: string, loadoutId: string): WorkspaceChange[] {
    const character = characterIn(workspace, characterId);
    const loadout = statLoadoutIn(workspace, loadoutId);
    const traitStatsNow = character.traitStats ?? noTraitStats;
    const traitStatsThen = loadout.traitStats ?? noTraitStats;
    return [
        ...baseStatNames.flatMap((stat): WorkspaceChange[] =>
            loadout.baseStats[stat] === character.baseStats[stat] ? [] : [{ kind: "setBaseStat", stat, value: loadout.baseStats[stat] }],
        ),
        ...traitStatNames.flatMap((stat): WorkspaceChange[] =>
            traitStatsThen[stat] === traitStatsNow[stat] ? [] : [{ kind: "setTraitStat", stat, value: traitStatsThen[stat] }],
        ),
    ];
}

/** Takes a stat loadout out of the workspace. */
export function removeStatLoadout(workspace: Workspace, loadoutId: string): Workspace {
    const { [loadoutId]: _removedLoadout, ...remainingLoadouts } = workspace.statLoadouts ?? {};
    return withLoadouts(workspace, "statLoadouts", remainingLoadouts);
}

function withLoadouts<Field extends "gearLoadouts" | "statLoadouts">(workspace: Workspace, field: Field, loadouts: NonNullable<Workspace[Field]>): Workspace {
    const { [field]: _previousLoadouts, ...workspaceWithoutField } = workspace;
    return (Object.keys(loadouts).length === 0 ? workspaceWithoutField : { ...workspaceWithoutField, [field]: loadouts }) as Workspace;
}

export interface AddedBranch {
    readonly workspace: Workspace;
    readonly nodeId: string;
}

/**
 * Adds a node directly under a tree's root that holds the given changes.
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function addBranchToTree(workspace: Workspace, treeId: string, label: string, changes: readonly WorkspaceChange[]): AddedBranch {
    const tree = workspace.trees[treeId];
    if (tree === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }
    const nodeId = firstUnusedId(Object.fromEntries(tree.nodes.map((node) => [node.id, node])), "branch");
    const node: WorkspaceTreeNode = { id: nodeId, parentId: null, label, changes: [...changes] };
    return { workspace: { ...workspace, trees: { ...workspace.trees, [treeId]: { ...tree, nodes: [...tree.nodes, node] } } }, nodeId };
}
