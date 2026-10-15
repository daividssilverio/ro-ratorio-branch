import { type Character, type EquipmentSlot, equipmentSlots, type LockerPiece, type Workspace } from "@ro-ratorio-branch/core/platform-neutral";

/** A character of the job at the given base level with every base stat at 1 and nothing equipped: the point every build starts from. */
export function blankCharacter(jobId: number, baseLevel = 1): Character {
    return { jobId, baseLevel, jobLevel: 1, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment: {} };
}

export interface EquipmentRow {
    readonly slot: EquipmentSlot;
    /** `null` for an empty slot, or one that points at a piece the locker no longer has. */
    readonly gearPieceId: string | null;
    readonly lockerPiece: LockerPiece | null;
}

/**
 * What a character wears, one row per slot in slot order, empty slots
 * included. The left hand has a row only for a job that wields two weapons,
 * or while something is worn there.
 */
export function equipmentRowsOf(workspace: Workspace, characterId: string, wieldsTwoWeapons: boolean): EquipmentRow[] {
    const equipment = workspace.characters[characterId]?.equipment ?? {};
    return equipmentSlots
        .filter((slot) => slot !== "leftHand" || wieldsTwoWeapons || equipment.leftHand !== undefined)
        .map((slot) => {
            const gearPieceId = equipment[slot];
            const lockerPiece = gearPieceId === undefined ? undefined : workspace.gearPieces[gearPieceId];
            return lockerPiece === undefined || gearPieceId === undefined ? { slot, gearPieceId: null, lockerPiece: null } : { slot, gearPieceId, lockerPiece };
        });
}
