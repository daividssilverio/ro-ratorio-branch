import type { EquipmentSlot } from "../character-vocabulary.ts";
import type { Build, GearPiece } from "./build-format.ts";
import { slotTakesRefine, slotTakesTranscendence } from "./convert-build.ts";

/**
 * The build wearing another item in a slot. The item takes the refine and
 * transcendence of the piece it replaces, so that comparing items compares
 * like with like, and comes without cards: sockets differ from item to item.
 */
export function buildWearingItem(build: Build, slot: EquipmentSlot, itemId: number): Build {
    const replaced = build.character.equipment[slot];
    const piece: GearPiece = {
        itemId,
        ...(replaced?.refine !== undefined && slotTakesRefine(slot) ? { refine: replaced.refine } : {}),
        ...(replaced?.transcendence !== undefined && slotTakesTranscendence(slot) ? { transcendence: replaced.transcendence } : {}),
    };
    return { ...build, character: { ...build.character, equipment: { ...build.character.equipment, [slot]: piece } } };
}

/**
 * The build with a card or enchant in one socket of the piece worn in a slot,
 * or with that socket emptied for `null`. `null` when nothing is worn there.
 */
export function buildWithSocketFilled(build: Build, slot: EquipmentSlot, socketIndex: number, cardOrEnchantId: number | null): Build | null {
    const piece = build.character.equipment[slot];
    if (piece === undefined) {
        return null;
    }
    const sockets: (number | null)[] = Array.from({ length: Math.max(socketIndex + 1, piece.sockets?.length ?? 0) }, (_unused, index) => piece.sockets?.[index] ?? null);
    sockets[socketIndex] = cardOrEnchantId;
    return { ...build, character: { ...build.character, equipment: { ...build.character.equipment, [slot]: { ...piece, sockets } } } };
}
