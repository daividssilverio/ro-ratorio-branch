import { type EquipmentSlot, equipmentSlots, isShadowSlot } from "../character-vocabulary.ts";
import type { Build } from "../build/build-format.ts";
import type { BuildCalculation } from "../build/calculate-build.ts";
import type { EngineCatalog, SkillDamageKind } from "../engine-adapter/engine-catalog.ts";
import type { EngineNames } from "../engine-adapter/engine-names.ts";
import { type AttackRequirement, type PeriodicSp, readSpGainLine, type SpGainCondition, type SpGainEffect } from "./sp-gain-wording.ts";

/** Upstream gives natural SP recovery per tick; one comes every 8 seconds while standing or walking. */
export const secondsPerNaturalRecoveryTick = 8;

/** The chance taken for an effect whose wording gives none ("一定確率で"), where the user has not set one. */
export const assumedChancePercent = 1;

/** An item, or a card or enchant, whose effects give SP back. */
export interface SpEffectSource {
    readonly kind: "item" | "cardOrEnchant";
    readonly id: number;
}

/** One item, card or enchant a character wears, or an item set it completes, with what its effects depend on. */
export interface WornEffects {
    readonly source: SpEffectSource;
    /** Upstream's name of the item, card or enchant, or a set's members' names joined; empty where it is not known. */
    readonly name: string;
    readonly slot: EquipmentSlot;
    /** Of the piece, or of the piece the card or enchant sits in. */
    readonly refine: number;
    readonly transcendence: number;
    readonly onShadowGear: boolean;
    readonly lines: readonly string[];
}

/** What effect conditions ask of the character. */
export interface CharacterFacts {
    readonly baseLevel: number;
    readonly jobName: string;
    /** Base and trait stats as allocated, by their lower-case names (str, vit, wis…). */
    readonly pureStats: Readonly<Record<string, number>>;
    readonly learnedSkillLevel: (skillName: string) => number;
}

export interface SpSustainInput {
    readonly maxSp: number;
    readonly naturalRecoveryPerTick: number;
    readonly naturalRecoveryStopped: boolean;
    readonly spCostPerUse: number;
    readonly usesPerSecond: number;
    readonly damagePerUse: number;
    /** `null` when the attack never kills. */
    readonly secondsToKill: number | null;
    readonly attackKind: SkillDamageKind;
    readonly character: CharacterFacts;
    readonly worn: readonly WornEffects[];
    /** The items, cards and enchants whose state one of the character's timed items says is on ("メロン武器"). */
    readonly onByTimedItems?: readonly SpEffectSource[];
    /** The chance the user set for the effects of an item, card or enchant, in percent; undefined where none is set. */
    readonly chancePercentOf?: (source: SpEffectSource) => number | undefined;
    /** Whether the user counts the state an item, card or enchant sets off as on all the time. */
    readonly isOn?: (source: SpEffectSource) => boolean;
}

/** What a user sets about SP effects: the chance of each, and which states count as on all the time. */
export interface SpSustainSettings {
    readonly chancePercentOf?: (source: SpEffectSource) => number | undefined;
    readonly isOn?: (source: SpEffectSource) => boolean;
}

/** Where the chance of an effect came from: its wording, the user, or `assumedChancePercent`. */
export type ChanceOrigin = "wording" | "yours" | "assumed";

export interface SpGain {
    readonly from:
        | { readonly kind: "naturalRecovery" }
        | { readonly kind: "worn"; readonly source: SpEffectSource; readonly name: string; readonly slot: EquipmentSlot; readonly line: string };
    /** SP per second, on average. SP a cost reduction saves counts as gained. */
    readonly perSecond: number;
    readonly chance?: { readonly percent: number; readonly origin: ChanceOrigin };
    /**
     * For a state an attack sets off: the share of the time it is on, what it
     * gives while it is, and why it counts as on all the time where it does.
     */
    readonly state?: { readonly shareOfTimeOn: number; readonly perSecondWhileOn: number; readonly onBecause: "timedItem" | "yours" | null };
}

/** An effect about gaining SP that is not counted, because its wording or its condition is not read. */
export interface UncountedSpEffect {
    readonly source: SpEffectSource;
    readonly name: string;
    readonly slot: EquipmentSlot;
    readonly line: string;
}

/** A worn effect that gives SP back, its conditions holding: `times` is how many times it counts. */
export interface CountedSpEffect {
    readonly source: SpEffectSource;
    readonly name: string;
    readonly slot: EquipmentSlot;
    readonly line: string;
    readonly effect: SpGainEffect;
    readonly times: number;
    /** One of the character's timed items says the state this effect sets off is on. */
    readonly isOnByTimedItem: boolean;
}

/**
 * Everything how SP holds up depends on but the chances a user sets: what a
 * calculation gives, with each worn effect read and its conditions checked.
 * Plain data, so that it travels with a calculation and the chances can be
 * applied wherever it is shown.
 */
export interface SpSustainBasis {
    readonly maxSp: number;
    readonly spCostPerUse: number;
    readonly usesPerSecond: number;
    readonly damagePerUse: number;
    /** `null` when the attack never kills. */
    readonly secondsToKill: number | null;
    readonly attackKind: SkillDamageKind;
    /** 0 while natural recovery is stopped. */
    readonly naturalRecoveryPerSecond: number;
    readonly effects: readonly CountedSpEffect[];
    readonly uncounted: readonly UncountedSpEffect[];
}

export interface SpSustain {
    readonly maxSp: number;
    readonly spCostPerUse: number;
    readonly usesPerSecond: number;
    readonly spentPerSecond: number;
    readonly gains: readonly SpGain[];
    readonly gainedPerSecond: number;
    /** Gained less spent: below 0 while SP runs down. */
    readonly netPerSecond: number;
    /** How long a full SP bar lasts using the attack again and again; `null` when SP comes back at least as fast as it goes. */
    readonly fullBar: { readonly seconds: number; readonly uses: number } | null;
    readonly uncounted: readonly UncountedSpEffect[];
}

/** How a character's SP holds up using one attack again and again. */
export function spSustainOf(input: SpSustainInput): SpSustain {
    return spSustainFrom(spSustainBasisOf(input), { ...(input.chancePercentOf === undefined ? {} : { chancePercentOf: input.chancePercentOf }), ...(input.isOn === undefined ? {} : { isOn: input.isOn }) });
}

/** The worn effects read and their conditions checked: everything but the chances. */
export function spSustainBasisOf(input: Omit<SpSustainInput, "chancePercentOf" | "isOn">): SpSustainBasis {
    const onByTimedItems = new Set((input.onByTimedItems ?? []).map(sourceKeyOf));
    const effects: CountedSpEffect[] = [];
    const uncounted: UncountedSpEffect[] = [];
    for (const worn of input.worn) {
        for (const line of linesJoinedWhereTheyGoOn(worn.lines)) {
            const reading = readSpGainLine(line);
            if (reading === null) {
                continue;
            }
            if (reading.unread) {
                uncounted.push({ source: worn.source, name: worn.name, slot: worn.slot, line });
            }
            const times = timesConditionsHold(reading.conditions, worn, input.character);
            for (const effect of times > 0 ? reading.effects : []) {
                effects.push({ source: worn.source, name: worn.name, slot: worn.slot, line, effect, times, isOnByTimedItem: onByTimedItems.has(sourceKeyOf(worn.source)) });
            }
        }
    }
    return {
        maxSp: input.maxSp,
        spCostPerUse: input.spCostPerUse,
        usesPerSecond: input.usesPerSecond,
        damagePerUse: input.damagePerUse,
        secondsToKill: input.secondsToKill,
        attackKind: input.attackKind,
        naturalRecoveryPerSecond: input.naturalRecoveryStopped ? 0 : input.naturalRecoveryPerTick / secondsPerNaturalRecoveryTick,
        effects,
        uncounted,
    };
}

/**
 * How SP holds up, with what the user set: chances (where none is set, the
 * wording's or `assumedChancePercent`), and states counted as on all the time.
 */
export function spSustainFrom(basis: SpSustainBasis, settings: SpSustainSettings = {}): SpSustain {
    const gains: SpGain[] = basis.naturalRecoveryPerSecond > 0 ? [{ from: { kind: "naturalRecovery" }, perSecond: basis.naturalRecoveryPerSecond }] : [];
    for (const { source, name, slot, line, effect, times, isOnByTimedItem } of basis.effects) {
        const onBecause = isOnByTimedItem ? "timedItem" : settings.isOn?.(source) === true ? "yours" : null;
        const gain = gainOf(effect, times, basis, settings.chancePercentOf?.(source), onBecause);
        if (gain !== null && gain.perSecond > 0) {
            gains.push({ from: { kind: "worn", source, name, slot, line }, ...gain });
        }
    }
    const spentPerSecond = basis.spCostPerUse * basis.usesPerSecond;
    const gainedPerSecond = gains.reduce((sum, gain) => sum + gain.perSecond, 0);
    const netPerSecond = gainedPerSecond - spentPerSecond;
    const secondsOfAFullBar = netPerSecond < 0 ? basis.maxSp / -netPerSecond : null;
    return {
        maxSp: basis.maxSp,
        spCostPerUse: basis.spCostPerUse,
        usesPerSecond: basis.usesPerSecond,
        spentPerSecond,
        gains,
        gainedPerSecond,
        netPerSecond,
        fullBar: secondsOfAFullBar === null ? null : { seconds: secondsOfAFullBar, uses: secondsOfAFullBar * basis.usesPerSecond },
        uncounted: basis.uncounted,
    };
}

/** Upstream breaks some effects over two lines ("精錬値が8以上の時、物理攻撃命中時、" then what it does); a line ending in "、" goes on in the next. */
function linesJoinedWhereTheyGoOn(lines: readonly string[]): string[] {
    const joined: string[] = [];
    let goingOn = "";
    for (const line of lines) {
        const whole = goingOn + line;
        goingOn = /、\s*$/.test(whole) ? whole : "";
        if (goingOn === "") {
            joined.push(whole);
        }
    }
    return goingOn === "" ? joined : [...joined, goingOn];
}

/** How many times the effects of a line count: 0 when a condition fails, more than 1 for "for every so many refine levels". */
function timesConditionsHold(conditions: readonly SpGainCondition[], worn: WornEffects, character: CharacterFacts): number {
    let times = 1;
    for (const condition of conditions) {
        switch (condition.kind) {
            case "refineAtLeast":
                times *= worn.refine >= condition.refine ? 1 : 0;
                break;
            case "refineExactly":
                times *= worn.refine === condition.refine ? 1 : 0;
                break;
            case "transcendenceAtLeast":
                times *= worn.transcendence >= condition.stage ? 1 : 0;
                break;
            case "baseLevelAtLeast":
                times *= character.baseLevel >= condition.baseLevel ? 1 : 0;
                break;
            case "onRegularGear":
                times *= worn.onShadowGear ? 0 : 1;
                break;
            case "pureStatAtLeast":
                times *= (character.pureStats[condition.stat] ?? 0) >= condition.value ? 1 : 0;
                break;
            case "pureStatExactly":
                times *= (character.pureStats[condition.stat] ?? 0) === condition.value ? 1 : 0;
                break;
            case "skillLearned":
                times *= character.learnedSkillLevel(condition.skillName) >= condition.level ? 1 : 0;
                break;
            case "job":
                times *= character.jobName === condition.jobName ? 1 : 0;
                break;
            case "timesRefineSteps":
                times *= Math.floor(worn.refine / condition.refinePerStep);
                break;
            case "timesBaseLevelSteps":
                times *= Math.floor(character.baseLevel / condition.baseLevelsPerStep);
                break;
        }
    }
    return times;
}

function gainOf(effect: SpGainEffect, times: number, input: SpSustainBasis, yourChance: number | undefined, onBecause: "timedItem" | "yours" | null): Omit<SpGain, "from"> | null {
    switch (effect.kind) {
        case "periodic":
            return { perSecond: times * perSecondOf(effect.recovery, input.maxSp) };
        case "onHit":
            return setsOff(effect.attack, input.attackKind) ? { perSecond: times * effect.amount * input.usesPerSecond } : null;
        case "onKill":
            return setsOff(effect.attack, input.attackKind) && input.secondsToKill !== null && input.secondsToKill > 0
                ? { perSecond: (times * effect.amount) / input.secondsToKill }
                : null;
        case "drain": {
            if (!setsOff(effect.attack, input.attackKind)) {
                return null;
            }
            const chance = chanceOf(effect.chancePercent, yourChance);
            const drained = Math.min(input.maxSp, Math.floor((input.damagePerUse * effect.percentOfDamage) / 100));
            return { perSecond: times * (chance.percent / 100) * drained * input.usesPerSecond, chance };
        }
        case "proc": {
            if (!setsOff(effect.attack, input.attackKind)) {
                return null;
            }
            const chance = chanceOf(effect.chancePercent, yourChance);
            // The share of the time the state is on: at least one use set it off within its duration; all of it where it counts as on.
            const usesWithinDuration = input.usesPerSecond * effect.durationSeconds;
            const shareOfTimeOn = onBecause === null ? 1 - (1 - chance.percent / 100) ** usesWithinDuration : 1;
            const recovered = effect.recovery === undefined ? 0 : times * perSecondOf(effect.recovery, input.maxSp);
            const saved = (Math.min(100, effect.costDownPercent ?? 0) / 100) * input.spCostPerUse * input.usesPerSecond;
            return { perSecond: shareOfTimeOn * (recovered + saved), chance, state: { shareOfTimeOn, perSecondWhileOn: recovered + saved, onBecause } };
        }
    }
}

function perSecondOf(recovery: PeriodicSp, maxSp: number): number {
    const amount = recovery.unit === "percentOfMaxSp" ? Math.floor((maxSp * recovery.amount) / 100) : recovery.amount;
    return amount / recovery.seconds;
}

function setsOff(requirement: AttackRequirement, attackKind: SkillDamageKind): boolean {
    switch (requirement) {
        case "anyAttack":
            return attackKind !== "neither";
        case "physicalOrMagical":
            return attackKind === "physical" || attackKind === "magical";
        default:
            return requirement === attackKind;
    }
}

function chanceOf(stated: number | null, yours: number | undefined): { readonly percent: number; readonly origin: ChanceOrigin } {
    if (yours !== undefined) {
        return { percent: yours, origin: "yours" };
    }
    return stated === null ? { percent: assumedChancePercent, origin: "assumed" } : { percent: stated, origin: "wording" };
}

/**
 * What a calculated build's SP sustain rests on, using its scenario's attack
 * again and again; `null` when the attack never kills, so it has no pace to measure.
 */
export function spSustainBasisOfCalculation(
    build: Build,
    calculation: Pick<BuildCalculation, "battleSummary" | "statSnapshot" | "spCostPerUse" | "itemSets">,
    catalog: Pick<EngineCatalog, "effectsOfItem" | "effectsOfCardOrEnchant" | "damageKindOfSkill" | "sourcesOfTimedItem">,
    names: Pick<EngineNames, "jobName" | "skillName" | "describeItem" | "describeCardOrEnchant">,
): SpSustainBasis | null {
    const timeToKill = calculation.battleSummary.averageTimeToKill;
    if (timeToKill === null || timeToKill.seconds <= 0) {
        return null;
    }
    const { character, scenario } = build;
    const { stats } = calculation.statSnapshot;
    const skillLevels = { ...character.selfBuffs, ...character.learnedSkills };
    return spSustainBasisOf({
        maxSp: stats["MAXSP"] ?? 0,
        naturalRecoveryPerTick: stats["SPR"] ?? 0,
        naturalRecoveryStopped: (stats["SPR_STOP"] ?? 0) !== 0,
        spCostPerUse: calculation.spCostPerUse,
        usesPerSecond: timeToKill.attacks / timeToKill.seconds,
        damagePerUse: calculation.battleSummary.averageDamagePerAttack,
        secondsToKill: timeToKill.seconds,
        attackKind: catalog.damageKindOfSkill(scenario.skillId),
        character: {
            baseLevel: character.baseLevel,
            jobName: nameKeyOf(names.jobName(character.jobId) ?? ""),
            pureStats: { ...character.baseStats, ...character.traitStats },
            learnedSkillLevel: (skillName) =>
                Math.max(0, ...Object.entries(skillLevels).filter(([skillId]) => nameKeyOf(names.skillName(Number(skillId)) ?? "") === skillName).map(([, level]) => level)),
        },
        worn: [...wornEffectsOf(build, catalog, names), ...itemSetEffectsOf(build, calculation.itemSets, names)],
        onByTimedItems: (character.timedItems ?? []).flatMap((timedItemId) => catalog.sourcesOfTimedItem(timedItemId)),
    });
}

/** A name as effect wordings are read: half-width, without spaces. */
function nameKeyOf(name: string): string {
    return name.normalize("NFKC").replaceAll(/\s+/g, "");
}

function wornEffectsOf(
    build: Build,
    catalog: Pick<EngineCatalog, "effectsOfItem" | "effectsOfCardOrEnchant">,
    names: Pick<EngineNames, "describeItem" | "describeCardOrEnchant">,
): WornEffects[] {
    return equipmentSlots.flatMap((slot) => {
        const piece = build.character.equipment[slot];
        if (piece === undefined) {
            return [];
        }
        const placement = { slot, refine: piece.refine ?? 0, transcendence: piece.transcendence ?? 0, onShadowGear: isShadowSlot(slot) };
        const sockets = (piece.sockets ?? []).filter((socket): socket is number => socket !== null);
        return [
            { ...placement, source: { kind: "item", id: piece.itemId }, name: names.describeItem(piece.itemId)?.name ?? "", lines: catalog.effectsOfItem(piece.itemId) },
            ...sockets.map((cardOrEnchantId): WornEffects => ({
                ...placement,
                source: { kind: "cardOrEnchant", id: cardOrEnchantId },
                name: names.describeCardOrEnchant(cardOrEnchantId)?.name ?? "",
                lines: catalog.effectsOfCardOrEnchant(cardOrEnchantId),
            })),
        ];
    });
}

/**
 * What the item sets a build completes do, each placed on its first worn
 * member: its slot, and the refine a set's "精錬値が…" reads. A set with no
 * worn member (a pet's alone) is left out.
 */
function itemSetEffectsOf(build: Build, itemSets: BuildCalculation["itemSets"], names: Pick<EngineNames, "describeItem" | "describeCardOrEnchant">): WornEffects[] {
    const { equipment } = build.character;
    return itemSets.flatMap(({ set, members, effects }) => {
        const slotOfMember = (member: (typeof members)[number]) =>
            equipmentSlots.find((slot) => {
                const piece = equipment[slot];
                return member.kind === "item" ? piece?.itemId === member.id : member.kind === "cardOrEnchant" && (piece?.sockets ?? []).includes(member.id);
            });
        const slot = members.map(slotOfMember).find((found) => found !== undefined);
        const piece = slot === undefined ? undefined : equipment[slot];
        if (slot === undefined || piece === undefined) {
            return [];
        }
        const memberNames = members.flatMap((member) => {
            const name = member.kind === "item" ? names.describeItem(member.id)?.name : member.kind === "cardOrEnchant" ? names.describeCardOrEnchant(member.id)?.name : undefined;
            return name === undefined ? [] : [name];
        });
        return [
            {
                source: set,
                name: memberNames.join(" + "),
                slot,
                refine: piece.refine ?? 0,
                transcendence: piece.transcendence ?? 0,
                onShadowGear: isShadowSlot(slot),
                lines: effects,
            },
        ];
    });
}

function sourceKeyOf(source: SpEffectSource): string {
    return `${source.kind}:${source.id}`;
}
