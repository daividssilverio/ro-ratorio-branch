import type { EquipmentSlot, EvaluationDiff, GearPiece, GearSlotDiff, RandomOption } from "@ro-ratorio-branch/core/platform-neutral";

/** One line of the gear section of the compare sheet. A slot can give several. */
export type GearDiffRow =
    | {
          readonly kind: "equipped" | "unequipped" | "swapped";
          readonly slot: EquipmentSlot;
          readonly before: GearPiece | undefined;
          readonly after: GearPiece | undefined;
      }
    | {
          readonly kind: "refined" | "transcended";
          readonly slot: EquipmentSlot;
          readonly itemId: number;
          readonly before: number;
          readonly after: number;
      }
    | {
          readonly kind: "socketFilled" | "socketSwapped" | "socketEmptied";
          readonly slot: EquipmentSlot;
          /** 1 is the first socket. */
          readonly socket: number;
          readonly before: number | null;
          readonly after: number | null;
      }
    | {
          readonly kind: "randomOptionsChanged";
          readonly slot: EquipmentSlot;
          /** Without the empty positions. */
          readonly optionsBefore: readonly RandomOption[];
          readonly optionsAfter: readonly RandomOption[];
      };

const rolledOptionsOf = (gearPiece: GearPiece): RandomOption[] => (gearPiece.randomOptions ?? []).filter((randomOption) => randomOption !== null);

/** Random options as one comparable text. Positions only decide what can be rolled, so they are left out. */
const randomOptionsKeyOf = (gearPiece: GearPiece) =>
    rolledOptionsOf(gearPiece)
        .map(({ optionId, value }) => `${optionId}:${value}`)
        .sort()
        .join(",");

/**
 * Splits what happened to one slot into the changes a player thinks in: a
 * different item is one swap; the same item gives a line per refine,
 * transcendence and socket that moved.
 */
export function gearDiffRowsOf({ slot, before, after }: GearSlotDiff): GearDiffRow[] {
    if (before === undefined || after === undefined || before.itemId !== after.itemId) {
        const kind = before === undefined ? "equipped" : after === undefined ? "unequipped" : "swapped";
        return [{ kind, slot, before, after }];
    }
    const rows: GearDiffRow[] = [];
    if ((before.refine ?? 0) !== (after.refine ?? 0)) {
        rows.push({ kind: "refined", slot, itemId: after.itemId, before: before.refine ?? 0, after: after.refine ?? 0 });
    }
    if ((before.transcendence ?? 0) !== (after.transcendence ?? 0)) {
        rows.push({
            kind: "transcended",
            slot,
            itemId: after.itemId,
            before: before.transcendence ?? 0,
            after: after.transcendence ?? 0,
        });
    }
    const socketCount = Math.max(before.sockets?.length ?? 0, after.sockets?.length ?? 0);
    for (let socketIndex = 0; socketIndex < socketCount; socketIndex++) {
        const socketBefore = before.sockets?.[socketIndex] ?? null;
        const socketAfter = after.sockets?.[socketIndex] ?? null;
        if (socketBefore !== socketAfter) {
            const kind = socketBefore === null ? "socketFilled" : socketAfter === null ? "socketEmptied" : "socketSwapped";
            rows.push({ kind, slot, socket: socketIndex + 1, before: socketBefore, after: socketAfter });
        }
    }
    if (randomOptionsKeyOf(before) !== randomOptionsKeyOf(after)) {
        rows.push({ kind: "randomOptionsChanged", slot, optionsBefore: rolledOptionsOf(before), optionsAfter: rolledOptionsOf(after) });
    }
    return rows;
}

/** The items and cards that are new on the "after" side, whose effect text explains the difference. */
export function newlyEquippedIn(diff: EvaluationDiff): { itemIds: number[]; cardOrEnchantIds: number[] } {
    const itemIds = new Set<number>();
    const cardOrEnchantIds = new Set<number>();
    for (const row of diff.gear.flatMap(gearDiffRowsOf)) {
        if (row.kind === "equipped" || row.kind === "swapped") {
            if (row.after !== undefined) {
                itemIds.add(row.after.itemId);
                for (const cardOrEnchantId of row.after.sockets ?? []) {
                    if (cardOrEnchantId !== null) {
                        cardOrEnchantIds.add(cardOrEnchantId);
                    }
                }
            }
        } else if ((row.kind === "socketFilled" || row.kind === "socketSwapped") && row.after !== null) {
            cardOrEnchantIds.add(row.after);
        }
    }
    return { itemIds: [...itemIds], cardOrEnchantIds: [...cardOrEnchantIds] };
}

/** Upstream writes line breaks in effect text as `<BR>`. */
export function effectTextLines(effectText: string): string[] {
    return effectText
        .split(/<br\s*\/?>/i)
        .map((line) => line.trim())
        .filter((line) => line !== "");
}
