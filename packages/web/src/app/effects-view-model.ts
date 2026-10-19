import { type Character, type EquipmentSlot, equipmentSlots, type GearPiece } from "@ro-ratorio-branch/core/platform-neutral";
import type { Descriptions, GearDescription } from "../engine-host/host-protocol.ts";
import { effectTextLines } from "./compare-view-model.ts";
import { cardOrEnchantNameIn, itemNameIn, randomOptionTextIn } from "./labels.ts";

/** How something stands against the build the node builds on. Always `same` without one. */
export type EffectChange = "same" | "added" | "changed" | "lost";

const changeOrder: readonly EffectChange[] = ["added", "changed", "lost", "same"];

export interface BonusRow {
    /** The bonus's `ITEM_SP_` name without the prefix. */
    readonly name: string;
    /** Now; for a lost bonus, what it was. */
    readonly value: number;
    /** What it was on the parent; `null` without a parent or for an added bonus. */
    readonly before: number | null;
    readonly change: EffectChange;
}

/**
 * Every bonus of a build, against its parent's when there is one: what came,
 * what changed and what went first. Within each group the bonuses keep the
 * order they come in, which is upstream's, so related effects stay together.
 */
export function bonusRowsOf(current: Readonly<Record<string, number>>, parent: Readonly<Record<string, number>> | null): BonusRow[] {
    const names = [...new Set([...Object.keys(current), ...Object.keys(parent ?? {})])];
    const rows = names.map((name): BonusRow => {
        const now = current[name];
        const was = parent?.[name];
        if (parent === null) {
            return { name, value: now ?? 0, before: null, change: "same" };
        }
        if (now === undefined) {
            return { name, value: was ?? 0, before: was ?? null, change: "lost" };
        }
        if (was === undefined) {
            return { name, value: now, before: null, change: "added" };
        }
        return { name, value: now, before: was, change: now === was ? "same" : "changed" };
    });
    return rows
        .map((row, index) => ({ row, index }))
        .sort((first, second) => changeOrder.indexOf(first.row.change) - changeOrder.indexOf(second.row.change) || first.index - second.index)
        .map(({ row }) => row);
}

export type EffectSourceKind = "item" | "cardOrEnchant" | "randomOption";

/** Something worn that does something: an item, a card or enchant in it, or a random option on it. */
export interface EffectSource {
    readonly kind: EffectSourceKind;
    readonly slot: EquipmentSlot;
    readonly name: string;
    readonly lines: readonly string[];
    readonly change: Exclude<EffectChange, "changed">;
    /** Tells sources of the same kind and ID apart. */
    readonly key: string;
}

interface WornSource {
    readonly kind: EffectSourceKind;
    readonly slot: EquipmentSlot;
    /** What makes two sources the same thing: the kind and the ID, and the value for an option. */
    readonly identity: string;
    readonly name: string;
    readonly lines: readonly string[];
}

function wornSourcesOf(character: Character, descriptions: Descriptions): WornSource[] {
    return equipmentSlots.flatMap((slot): WornSource[] => {
        const piece = character.equipment[slot];
        return piece === undefined ? [] : sourcesOfPiece(piece, slot, descriptions);
    });
}

/** What one piece does: the item, then its cards and enchants, then its random options. */
export function pieceEffectSourcesOf(piece: Pick<GearPiece, "itemId" | "sockets" | "randomOptions">, slot: EquipmentSlot, descriptions: Descriptions): EffectSource[] {
    return sourcesOfPiece(piece, slot, descriptions).map((source, index) => ({ ...withoutIdentity(source), change: "same", key: `${source.identity}#${index}` }));
}

function sourcesOfPiece(piece: Pick<GearPiece, "itemId" | "sockets" | "randomOptions">, slot: EquipmentSlot, descriptions: Descriptions): WornSource[] {
    return [
        { kind: "item", slot, identity: `item:${piece.itemId}`, name: itemNameIn(descriptions, piece.itemId), lines: effectLinesOf(descriptions.items[piece.itemId]) },
        ...(piece.sockets ?? []).flatMap((cardOrEnchantId): WornSource[] =>
            cardOrEnchantId === null
                ? []
                : [
                      {
                          kind: "cardOrEnchant",
                          slot,
                          identity: `cardOrEnchant:${cardOrEnchantId}`,
                          name: cardOrEnchantNameIn(descriptions, cardOrEnchantId),
                          lines: effectLinesOf(descriptions.cardsOrEnchants[cardOrEnchantId]),
                      },
                  ],
        ),
        ...(piece.randomOptions ?? []).flatMap((randomOption): WornSource[] => {
            if (randomOption === null) {
                return [];
            }
            const text = randomOptionTextIn(descriptions, randomOption);
            return [{ kind: "randomOption", slot, identity: `randomOption:${randomOption.optionId}:${randomOption.value}`, name: text, lines: [] }];
        }),
    ];
}

/**
 * What everything worn does, slot by slot. Against the parent's build, a
 * source it did not wear is added and one it wore that is gone is lost (at
 * the end); the same card twice counts twice.
 */
export function effectSourcesOf(character: Character, parentCharacter: Character | null, descriptions: Descriptions): EffectSource[] {
    const worn = wornSourcesOf(character, descriptions);
    if (parentCharacter === null) {
        return worn.map((source, index) => ({ ...withoutIdentity(source), change: "same", key: `${source.identity}#${index}` }));
    }
    const unmatchedOnParent = wornSourcesOf(parentCharacter, descriptions);
    const sources = worn.map((source, index): EffectSource => {
        const matchAt = unmatchedOnParent.findIndex((candidate) => candidate.identity === source.identity);
        if (matchAt >= 0) {
            unmatchedOnParent.splice(matchAt, 1);
        }
        return { ...withoutIdentity(source), change: matchAt >= 0 ? "same" : "added", key: `${source.identity}#${index}` };
    });
    const lost = unmatchedOnParent.map((source, index): EffectSource => ({ ...withoutIdentity(source), change: "lost", key: `lost:${source.identity}#${index}` }));
    return [...sources, ...lost];
}

/** Everything a piece or card does, one effect per line; upstream's note alone where the full list is missing. */
export function effectLinesOf(description: GearDescription | undefined): readonly string[] {
    if (description === undefined) {
        return [];
    }
    return description.effects?.length ? description.effects : effectTextLines(description.effectText);
}

function withoutIdentity({ identity: _identity, ...source }: WornSource): Omit<WornSource, "identity"> {
    return source;
}
