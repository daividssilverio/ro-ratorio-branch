import type { CompletedItemSetEffects } from "../build/calculate-build.ts";
import { type PositionalBuffPanel, positionalBuffPanels } from "../panels/panel-definitions.ts";
import type { Character, GearPiece } from "../build/build-format.ts";
import { type EquipmentSlot, equipmentSlots } from "../character-vocabulary.ts";
import type { ReadyNodeEvaluation } from "./evaluate-tree.ts";

export interface GearSlotDiff {
    readonly slot: EquipmentSlot;
    /** `undefined` when the slot was empty. */
    readonly before: GearPiece | undefined;
    /** `undefined` when the slot is now empty. */
    readonly after: GearPiece | undefined;
}

/** A named number that differs. A name missing on one side counts as 0 there. */
export interface NumberDiff {
    readonly name: string;
    readonly before: number;
    readonly after: number;
}

export type CharacterSection =
    | "level"
    | "baseStats"
    | "traitStats"
    | "learnedSkills"
    | "selfBuffs"
    | "supportBuffs"
    | PositionalBuffPanel
    | "customization"
    | "timedItems"
    | "autoSpells"
    | "consumablesAndWeapon";

export interface CharacterInputDiff extends NumberDiff {
    readonly section: CharacterSection;
}

/**
 * What differs between two calculated characters, cheapest layer first:
 * what was put in (gear, then other inputs), what the engine derived from it
 * (stats, then bonuses), and what it does to the fight.
 */
export interface EvaluationDiff {
    readonly gear: readonly GearSlotDiff[];
    /** The item sets one side completes and the other does not; what they add is in `bonuses` already. */
    readonly itemSets: { readonly lost: readonly CompletedItemSetEffects[]; readonly gained: readonly CompletedItemSetEffects[] };
    readonly otherInputs: readonly CharacterInputDiff[];
    readonly stats: readonly NumberDiff[];
    readonly bonuses: readonly NumberDiff[];
    readonly damage: {
        readonly averageDamagePerAttack: { readonly before: number; readonly after: number };
        readonly averageDamagePerSecond: { readonly before: number; readonly after: number };
        /** `null` on a side where the attack cannot kill the target. */
        readonly secondsToKill: { readonly before: number | null; readonly after: number | null };
    };
}

export function diffEvaluations(before: ReadyNodeEvaluation, after: ReadyNodeEvaluation): EvaluationDiff {
    return {
        gear: equipmentSlots.flatMap((slot): GearSlotDiff[] => {
            const pieceBefore = before.character.equipment[slot];
            const pieceAfter = after.character.equipment[slot];
            return isSameGearPiece(pieceBefore, pieceAfter) ? [] : [{ slot, before: pieceBefore, after: pieceAfter }];
        }),
        itemSets: {
            lost: before.itemSets.filter((itemSet) => !after.itemSets.some((other) => isSameItemSet(itemSet, other))),
            gained: after.itemSets.filter((itemSet) => !before.itemSets.some((other) => isSameItemSet(itemSet, other))),
        },
        otherInputs: diffCharacterInputs(before.character, after.character),
        stats: diffNamedNumbers(before.statSnapshot.stats, after.statSnapshot.stats),
        bonuses: diffNamedNumbers(before.statSnapshot.bonuses, after.statSnapshot.bonuses),
        damage: {
            averageDamagePerAttack: {
                before: before.battleSummary.averageDamagePerAttack,
                after: after.battleSummary.averageDamagePerAttack,
            },
            averageDamagePerSecond: {
                before: before.battleSummary.averageDamagePerSecond,
                after: after.battleSummary.averageDamagePerSecond,
            },
            secondsToKill: {
                before: before.battleSummary.averageTimeToKill?.seconds ?? null,
                after: after.battleSummary.averageTimeToKill?.seconds ?? null,
            },
        },
    };
}

/** Random options as one comparable text, position by position. */
function randomOptionsKeyOf(gearPiece: GearPiece): string {
    return (gearPiece.randomOptions ?? []).map((randomOption) => (randomOption === null ? "" : `${randomOption.optionId}:${randomOption.value}`)).join(",");
}

function isSameGearPiece(first: GearPiece | undefined, second: GearPiece | undefined): boolean {
    if (first === undefined || second === undefined) {
        return first === second;
    }
    const socketsOf = (gearPiece: GearPiece) => gearPiece.sockets ?? [];
    return (
        first.itemId === second.itemId &&
        (first.refine ?? 0) === (second.refine ?? 0) &&
        (first.transcendence ?? 0) === (second.transcendence ?? 0) &&
        socketsOf(first).length === socketsOf(second).length &&
        socketsOf(first).every((cardOrEnchantId, socketIndex) => cardOrEnchantId === socketsOf(second)[socketIndex]) &&
        randomOptionsKeyOf(first) === randomOptionsKeyOf(second)
    );
}

function diffCharacterInputs(before: Character, after: Character): CharacterInputDiff[] {
    const inSection = (section: CharacterSection, numberDiffs: NumberDiff[]) =>
        numberDiffs.map((numberDiff) => ({ section, ...numberDiff }));
    return [
        ...inSection(
            "level",
            diffNamedNumbers(
                { baseLevel: before.baseLevel, jobLevel: before.jobLevel },
                { baseLevel: after.baseLevel, jobLevel: after.jobLevel },
            ),
        ),
        ...inSection("baseStats", diffNamedNumbers(before.baseStats, after.baseStats)),
        ...inSection("traitStats", diffNamedNumbers(before.traitStats ?? {}, after.traitStats ?? {})),
        ...inSection("learnedSkills", diffNamedNumbers(before.learnedSkills ?? {}, after.learnedSkills ?? {})),
        ...inSection("selfBuffs", diffNamedNumbers(before.selfBuffs ?? {}, after.selfBuffs ?? {})),
        ...inSection("supportBuffs", diffNamedNumbers(before.supportBuffs ?? {}, after.supportBuffs ?? {})),
        ...positionalBuffPanels.flatMap((panel) => inSection(panel, diffNamedNumbers(before[panel] ?? {}, after[panel] ?? {}))),
        ...inSection("customization", diffNamedNumbers(customizationByName(before), customizationByName(after))),
        ...inSection("timedItems", diffNamedNumbers(countOfEach(before.timedItems ?? []), countOfEach(after.timedItems ?? []))),
        ...inSection("autoSpells", diffNamedNumbers(chanceOfEachAutoSpell(before), chanceOfEachAutoSpell(after))),
        ...inSection(
            "consumablesAndWeapon",
            diffNamedNumbers(
                { speedPotion: before.speedPotion ?? 0, weaponElement: before.weaponElement ?? 0, arrowId: before.arrowId ?? 0 },
                { speedPotion: after.speedPotion ?? 0, weaponElement: after.weaponElement ?? 0, arrowId: after.arrowId ?? 0 },
            ),
        ),
    ];
}

/** Every customisation value under "part.NAME". */
function customizationByName(character: Character): Record<string, number> {
    return Object.fromEntries(
        Object.entries(character.customization ?? {}).flatMap(([section, valueOfName]) => Object.entries(valueOfName ?? {}).map(([name, value]): [string, number] => [`${section}.${name}`, value])),
    );
}

/** How often each ID is in the list, by ID. */
function countOfEach(ids: readonly number[]): Record<string, number> {
    const countOfId: Record<string, number> = {};
    for (const id of ids) {
        countOfId[String(id)] = (countOfId[String(id)] ?? 0) + 1;
    }
    return countOfId;
}

/** The chance of each set auto-spell in per mille, by auto-spell ID; added up where one is set twice. */
function chanceOfEachAutoSpell(character: Character): Record<string, number> {
    const chanceOfId: Record<string, number> = {};
    for (const { autoSpellId, chancePerMille } of character.autoSpells ?? []) {
        chanceOfId[String(autoSpellId)] = (chanceOfId[String(autoSpellId)] ?? 0) + chancePerMille;
    }
    return chanceOfId;
}

function diffNamedNumbers(
    before: Readonly<Record<string, number>>,
    after: Readonly<Record<string, number>>,
): NumberDiff[] {
    const names = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...names].flatMap((name): NumberDiff[] => {
        const valueBefore = before[name] ?? 0;
        const valueAfter = after[name] ?? 0;
        return valueBefore === valueAfter ? [] : [{ name, before: valueBefore, after: valueAfter }];
    });
}

function isSameItemSet(one: CompletedItemSetEffects, other: CompletedItemSetEffects): boolean {
    return one.set.kind === other.set.kind && one.set.id === other.set.id;
}
