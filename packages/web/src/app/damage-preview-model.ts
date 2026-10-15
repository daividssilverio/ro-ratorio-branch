import { type Build, type BuildOutcome, type EquipmentSlot, type GearPiece, slotTakesRefine, slotTakesTranscendence } from "@ro-ratorio-branch/core/platform-neutral";

/** What a choice in a picker would do to the damage, before it is chosen. */
export type DamagePreview =
    | { readonly state: "calculating" }
    /** The damage per second with the choice, against the damage per second without it. */
    | { readonly state: "ready"; readonly damagePerSecond: number; readonly baselineDamagePerSecond: number }
    /** The build with the choice cannot be calculated, or the one without it deals no damage to compare with. */
    | { readonly state: "unavailable" };

export function damagePreviewOf(baseline: BuildOutcome, withChoice: BuildOutcome): DamagePreview {
    if (baseline.state !== "ready" || withChoice.state !== "ready" || baseline.battleSummary.averageDamagePerSecond === 0) {
        return { state: "unavailable" };
    }
    return { state: "ready", damagePerSecond: withChoice.battleSummary.averageDamagePerSecond, baselineDamagePerSecond: baseline.battleSummary.averageDamagePerSecond };
}

/**
 * The build wearing another item in a slot. The item takes the refine and
 * transcendence of the piece it replaces, so that the preview compares
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

/** The build with a card or enchant in one socket of the piece worn in a slot. `null` when nothing is worn there. */
export function buildWithSocketFilled(build: Build, slot: EquipmentSlot, socketIndex: number, cardOrEnchantId: number): Build | null {
    const piece = build.character.equipment[slot];
    if (piece === undefined) {
        return null;
    }
    const sockets: (number | null)[] = Array.from({ length: Math.max(socketIndex + 1, piece.sockets?.length ?? 0) }, (_unused, index) => piece.sockets?.[index] ?? null);
    sockets[socketIndex] = cardOrEnchantId;
    return { ...build, character: { ...build.character, equipment: { ...build.character.equipment, [slot]: { ...piece, sockets } } } };
}

/**
 * Rows ordered by what they would do to the damage, best first, once every
 * one of them has a preview: rows moving while their numbers arrive would
 * be hard to read. Rows without a number keep their order, after the others.
 */
export function orderedByPreview<Row>(rows: readonly Row[], previewOf: (row: Row) => DamagePreview | undefined): Row[] {
    const previews = rows.map(previewOf);
    if (previews.some((preview) => preview === undefined || preview.state === "calculating")) {
        return [...rows];
    }
    const damageOf = (index: number) => {
        const preview = previews[index];
        return preview?.state === "ready" ? preview.damagePerSecond : Number.NEGATIVE_INFINITY;
    };
    return rows
        .map((row, index) => ({ row, index }))
        .sort((one, other) => damageOf(other.index) - damageOf(one.index) || one.index - other.index)
        .map(({ row }) => row);
}
