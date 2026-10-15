import { type EquipmentSlot, type LockerPiece, type RandomOption, type LockerPieceUsage, lockerPieceUsage, type Workspace } from "@ro-ratorio-branch/core/platform-neutral";
import type { GearFacts, IdsToDescribe } from "../engine-host/host-protocol.ts";

/** Slots the locker filters together. */
export const slotGroups = {
    weapon: ["rightHand", "leftHand"],
    head: ["headTop", "headMid", "headLow"],
    armor: ["armor"],
    shield: ["shield"],
    garment: ["garment"],
    shoes: ["shoes"],
    accessory: ["accessory1", "accessory2"],
    shadow: ["shadowWeapon", "shadowShield", "shadowArmor", "shadowShoes", "shadowAccessory1", "shadowAccessory2"],
} as const satisfies Record<string, readonly EquipmentSlot[]>;

export type SlotGroup = keyof typeof slotGroups;

export const slotGroupNames = Object.keys(slotGroups) as SlotGroup[];

export interface LockerFilter {
    /** Only what this character wears or its trees equip. `null` for every character. */
    readonly characterId: string | null;
    readonly slotGroup: SlotGroup | null;
    /** Only the pieces this gear loadout holds. Left out for every piece. */
    readonly gearLoadoutId?: string | null;
}

export interface LockerRow {
    readonly gearPieceId: string;
    readonly lockerPiece: LockerPiece;
    /** The slots the piece fits. Empty until the engine has said, or when it does not know the item. */
    readonly slots: readonly EquipmentSlot[];
    readonly usage: LockerPieceUsage;
    /** The characters that wear the piece although their job may not. */
    readonly wearersBarredByJob: readonly string[];
}

/** The locker's pieces that pass the filter, in the order they were added. */
export function lockerRowsOf(workspace: Workspace, gearFacts: GearFacts, filter: LockerFilter): LockerRow[] {
    const usageOfPieceId = lockerPieceUsage(workspace);
    const treeIdsOfFilteredCharacter = new Set(
        Object.entries(workspace.trees)
            .filter(([, tree]) => tree.characterId === filter.characterId)
            .map(([treeId]) => treeId),
    );

    const rows: LockerRow[] = [];
    for (const [gearPieceId, lockerPiece] of Object.entries(workspace.gearPieces)) {
        const usage = usageOfPieceId.get(gearPieceId) ?? { characterIds: [], nodes: [], gearLoadoutIds: [] };
        const slots = gearFacts.slotsOfItem[lockerPiece.itemId] ?? [];
        if (
            filter.characterId !== null &&
            !usage.characterIds.includes(filter.characterId) &&
            !usage.nodes.some((node) => treeIdsOfFilteredCharacter.has(node.treeId))
        ) {
            continue;
        }
        if (filter.gearLoadoutId !== undefined && filter.gearLoadoutId !== null && !usage.gearLoadoutIds.includes(filter.gearLoadoutId)) {
            continue;
        }
        if (filter.slotGroup !== null && !slots.some((slot) => (slotGroups[filter.slotGroup ?? "weapon"] as readonly EquipmentSlot[]).includes(slot))) {
            continue;
        }
        const wearingJobIds = gearFacts.wearingJobIdsOfItem[lockerPiece.itemId];
        const wearersBarredByJob =
            wearingJobIds === undefined
                ? []
                : usage.characterIds.filter((characterId) => !wearingJobIds.includes(workspace.characters[characterId]?.jobId ?? -1));
        rows.push({ gearPieceId, lockerPiece, slots, usage, wearersBarredByJob });
    }
    return rows;
}

/** The locker pieces a character of the job could put into the slot. */
export function lockerPiecesForSlot(workspace: Workspace, gearFacts: GearFacts, slot: EquipmentSlot, jobId: number): LockerRow[] {
    return lockerRowsOf(workspace, gearFacts, { characterId: null, slotGroup: null }).filter(
        (row) => row.slots.includes(slot) && (gearFacts.wearingJobIdsOfItem[row.lockerPiece.itemId] ?? []).includes(jobId),
    );
}

/** Every ID in the workspace's locker and characters that the app shows a name for or checks. */
export function idsInWorkspace(workspace: Workspace): IdsToDescribe {
    const itemIds = new Set<number>();
    const cardOrEnchantIds = new Set<number>();
    const randomOptionIds = new Set<number>();
    for (const lockerPiece of Object.values(workspace.gearPieces)) {
        itemIds.add(lockerPiece.itemId);
        for (const randomOption of lockerPiece.randomOptions ?? []) {
            if (randomOption !== null) {
                randomOptionIds.add(randomOption.optionId);
            }
        }
        for (const cardOrEnchantId of lockerPiece.sockets ?? []) {
            if (cardOrEnchantId !== null) {
                cardOrEnchantIds.add(cardOrEnchantId);
            }
        }
    }
    return {
        jobIds: [...new Set(Object.values(workspace.characters).map((character) => character.jobId))],
        skillIds: [...new Set(Object.values(workspace.trees).map((tree) => tree.scenario.skillId))],
        monsterIds: [...new Set(Object.values(workspace.trees).map((tree) => tree.scenario.targetMonsterId))],
        itemIds: [...itemIds],
        cardOrEnchantIds: [...cardOrEnchantIds],
        randomOptionIds: [...randomOptionIds],
    };
}

/** The piece with one field set, or dropped when the value is the format's default. */
export function withPieceField<Field extends "refine" | "transcendence" | "zenyCost" | "note" | "element">(
    lockerPiece: LockerPiece,
    field: Field,
    value: LockerPiece[Field] | undefined,
): LockerPiece {
    const { [field]: _previousValue, ...pieceWithoutField } = lockerPiece;
    const isDefault = value === undefined || value === 0 || value === "";
    return (isDefault ? pieceWithoutField : { ...pieceWithoutField, [field]: value }) as LockerPiece;
}

/**
 * What a socket of a piece is, given what its item takes there: nothing
 * (`closed`), something (`open`), or `misfilled` when it holds a card or
 * enchant the item does not take there. `unknown` until the choices are in.
 */
export type SocketState = "unknown" | "closed" | "open" | "misfilled";

export function socketStateOf(choices: readonly { readonly id: number }[] | undefined, cardOrEnchantId: number | null): SocketState {
    if (choices === undefined) {
        return "unknown";
    }
    if (cardOrEnchantId !== null && !choices.some((choice) => choice.id === cardOrEnchantId)) {
        return "misfilled";
    }
    return choices.length === 0 ? "closed" : "open";
}

/** The piece with a random option at one position, or that position emptied for `null`. 0 is the first position. */
export function withRandomOptionAt(lockerPiece: LockerPiece, positionIndex: number, randomOption: RandomOption | null): LockerPiece {
    const randomOptions: (RandomOption | null)[] = [...(lockerPiece.randomOptions ?? [])];
    while (randomOptions.length <= positionIndex) {
        randomOptions.push(null);
    }
    randomOptions[positionIndex] = randomOption;
    while (randomOptions.at(-1) === null) {
        randomOptions.pop();
    }
    const { randomOptions: _previousOptions, ...pieceWithoutOptions } = lockerPiece;
    return randomOptions.length === 0 ? pieceWithoutOptions : { ...pieceWithoutOptions, randomOptions };
}

/** The piece with a card or enchant in one socket, or the socket emptied for `null`. */
export function withSocket(lockerPiece: LockerPiece, socketIndex: number, cardOrEnchantId: number | null, socketCount: number): LockerPiece {
    const sockets: (number | null)[] = Array.from({ length: socketCount }, (_, index) => lockerPiece.sockets?.[index] ?? null);
    sockets[socketIndex] = cardOrEnchantId;
    while (sockets.at(-1) === null) {
        sockets.pop();
    }
    const { sockets: _previousSockets, ...pieceWithoutSockets } = lockerPiece;
    return sockets.length === 0 ? pieceWithoutSockets : { ...pieceWithoutSockets, sockets };
}
