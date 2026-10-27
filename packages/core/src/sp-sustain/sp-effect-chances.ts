import { type Static, Type } from "typebox";
import { Value } from "typebox/value";
import { RatorioId, RatorioIdKey, strictObject } from "../build/build-format.ts";
import type { SpEffectSource, SpSustainSettings } from "./sp-sustain.ts";

const ChancePercent = Type.Number({ minimum: 0, maximum: 100, description: "Percent: 5 is a 5% chance." });

/**
 * The chance a user takes for the effects of an item, card or enchant that
 * happen by chance, where upstream's wording gives none ("一定確率で"). An
 * effect without one is taken at `assumedChancePercent`.
 */
export const SpEffectChancesSchema = Type.Object(
    {
        items: Type.Optional(Type.Record(RatorioIdKey, ChancePercent, { ...strictObject, description: "By ratorio item ID." })),
        cardsOrEnchants: Type.Optional(Type.Record(RatorioIdKey, ChancePercent, { ...strictObject, description: "By ratorio card or enchant ID." })),
    },
    { ...strictObject, description: "Chances taken for the SP effects that happen by chance, where the item's wording gives none." },
);

export type SpEffectChances = Static<typeof SpEffectChancesSchema>;

/**
 * The items, cards and enchants whose state a user counts as on all the time,
 * to see how SP holds up while it is ("発動中"), rather than on average.
 */
export const ActiveSpEffectsSchema = Type.Object(
    {
        items: Type.Optional(Type.Array(RatorioId("ratorio item ID."), { uniqueItems: true })),
        cardsOrEnchants: Type.Optional(Type.Array(RatorioId("ratorio card or enchant ID."), { uniqueItems: true })),
    },
    { ...strictObject, description: "States of SP effects counted as on all the time, rather than on average." },
);

export type ActiveSpEffects = Static<typeof ActiveSpEffectsSchema>;

/** The chance set for a source, or `undefined` where none is set. */
export function chancePercentLookup(chances: SpEffectChances | undefined): (source: SpEffectSource) => number | undefined {
    return (source) => (source.kind === "item" ? chances?.items : chances?.cardsOrEnchants)?.[String(source.id)];
}

export function isSpEffectChances(candidate: unknown): candidate is SpEffectChances {
    return Value.Check(SpEffectChancesSchema, candidate);
}

export function isActiveSpEffects(candidate: unknown): candidate is ActiveSpEffects {
    return Value.Check(ActiveSpEffectsSchema, candidate);
}

/** What a user set about SP effects, as `spSustainFrom()` takes it. */
export function spSustainSettingsOf(chances: SpEffectChances | undefined, active: ActiveSpEffects | undefined): SpSustainSettings {
    return {
        chancePercentOf: chancePercentLookup(chances),
        isOn: (source) => ((source.kind === "item" ? active?.items : active?.cardsOrEnchants) ?? []).includes(source.id),
    };
}
