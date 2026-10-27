import {
    type ChanceOrigin,
    type EquipmentSlot,
    type NodeEvaluation,
    type SpEffectSource,
    type SpSustain,
    spSustainFrom,
    type SpSustainSettings,
} from "@ro-ratorio-branch/core/platform-neutral";
import { formatInteger } from "./format.ts";

/** One source of SP coming back, as the SP card lists it: natural recovery, or a worn item, card or enchant. */
export interface SpGainRow {
    readonly key: string;
    /** Upstream's name of the item, card or enchant; `null` for natural recovery. */
    readonly name: string | null;
    readonly slot: EquipmentSlot | null;
    /** The effect as upstream words it; `null` for natural recovery. */
    readonly line: string | null;
    readonly perSecond: number;
    /** For an effect that happens by chance: the chance taken, where it came from, and whose chance a user sets. */
    readonly chance: { readonly percent: number; readonly origin: ChanceOrigin; readonly source: SpEffectSource } | null;
    /** For a state an attack sets off: how much of the time it is on, what it gives while on, and why it counts as on all the time. */
    readonly state: { readonly shareOfTimeOn: number; readonly perSecondWhileOn: number; readonly onBecause: "timedItem" | "yours" | null; readonly source: SpEffectSource } | null;
}

export interface UncountedRow {
    readonly key: string;
    readonly name: string;
    readonly slot: EquipmentSlot;
    readonly line: string;
}

export interface SpSustainView {
    readonly spCostPerUse: number;
    readonly usesPerSecond: number;
    readonly spentPerSecond: number;
    readonly gainedPerSecond: number;
    readonly netPerSecond: number;
    /** `null` when SP comes back at least as fast as it goes. */
    readonly fullBar: { readonly seconds: number; readonly uses: number } | null;
    /** The largest first, natural recovery among them. */
    readonly gainRows: readonly SpGainRow[];
    readonly uncountedRows: readonly UncountedRow[];
}

export function spSustainViewOf(sustain: SpSustain): SpSustainView {
    const gainRows = sustain.gains.map((gain, index): SpGainRow => {
        if (gain.from.kind === "naturalRecovery") {
            return { key: "natural", name: null, slot: null, line: null, perSecond: gain.perSecond, chance: null, state: null };
        }
        return {
            key: `${index}-${gain.from.source.kind}-${gain.from.source.id}`,
            name: gain.from.name,
            slot: gain.from.slot,
            line: gain.from.line,
            perSecond: gain.perSecond,
            chance: gain.chance === undefined ? null : { ...gain.chance, source: gain.from.source },
            state: gain.state === undefined ? null : { ...gain.state, source: gain.from.source },
        };
    });
    return {
        spCostPerUse: sustain.spCostPerUse,
        usesPerSecond: sustain.usesPerSecond,
        spentPerSecond: sustain.spentPerSecond,
        gainedPerSecond: sustain.gainedPerSecond,
        netPerSecond: sustain.netPerSecond,
        fullBar: sustain.fullBar,
        gainRows: [...gainRows].sort((one, other) => other.perSecond - one.perSecond),
        uncountedRows: sustain.uncounted.map((uncounted, index) => ({
            key: `${index}-${uncounted.source.kind}-${uncounted.source.id}`,
            name: uncounted.name,
            slot: uncounted.slot,
            line: uncounted.line,
        })),
    };
}

/** A share of the time, as a whole percent: `18%`. */
export function formatShareOfTime(share: number): string {
    return `${Math.round(share * 100)}%`;
}

/** SP a second, to one decimal, with the minus sign the app writes: `38.0`, `−166.5`. */
export function formatSpPerSecond(perSecond: number): string {
    return perSecond.toFixed(1).replace("-", "−");
}

/** How long a full bar lasts, to one decimal of a second: `25.1`. */
export function formatBarSeconds(seconds: number): string {
    return seconds.toFixed(1);
}

/** What a tree row shows of a build's SP: how long a full bar lasts, and SP spent and gained a second. */
export interface SpRowTexts {
    /** `25.1 s`, `∞` when SP never runs out, `—` when the attack never kills. */
    readonly bar: string;
    /** SP a second, whole: `172`; `—` when the attack never kills. */
    readonly spent: string;
    readonly gained: string;
}

/** A node's or the root's SP as a tree row shows it, with what the user set; `null` while the build is not calculated. */
export function spRowTextsOf(evaluation: NodeEvaluation | undefined, settings: SpSustainSettings): SpRowTexts | null {
    if (evaluation?.state !== "ready") {
        return null;
    }
    if (evaluation.spSustainBasis === null) {
        return { bar: "—", spent: "—", gained: "—" };
    }
    const { fullBar, spentPerSecond, gainedPerSecond } = spSustainFrom(evaluation.spSustainBasis, settings);
    return {
        bar: fullBar === null ? "∞" : `${formatBarSeconds(fullBar.seconds)} s`,
        spent: formatInteger(spentPerSecond),
        gained: formatInteger(gainedPerSecond),
    };
}
