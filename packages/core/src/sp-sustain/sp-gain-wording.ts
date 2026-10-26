/**
 * Reads how an item, card or enchant gives SP back from upstream's wording of
 * its effects. The engine calculates SP costs but not SP gained: upstream only
 * describes those effects in words, so this is where they become numbers.
 */

/** Which attacks set an effect off. */
export type AttackRequirement = "anyAttack" | "physical" | "magical" | "physicalOrMagical";

/** SP that comes back every so many seconds. */
export interface PeriodicSp {
    readonly seconds: number;
    readonly amount: number;
    /** "percentOfMaxSp" for "SP + 1%". */
    readonly unit: "sp" | "percentOfMaxSp";
}

export type SpGainEffect =
    | { readonly kind: "periodic"; readonly recovery: PeriodicSp }
    | { readonly kind: "onHit"; readonly attack: AttackRequirement; readonly amount: number }
    | { readonly kind: "onKill"; readonly attack: AttackRequirement; readonly amount: number }
    /** A share of the damage dealt, drained as SP. `chancePercent` is null where the wording gives no chance ("一定確率で"). */
    | { readonly kind: "drain"; readonly attack: AttackRequirement; readonly chancePercent: number | null; readonly percentOfDamage: number }
    /** A state an attack sets off for some seconds, during which SP comes back or skills cost less. */
    | {
          readonly kind: "proc";
          readonly attack: AttackRequirement;
          readonly chancePercent: number | null;
          readonly durationSeconds: number;
          readonly recovery?: PeriodicSp;
          readonly costDownPercent?: number;
      };

/** What must hold for the effects of a line to count. */
export type SpGainCondition =
    | { readonly kind: "refineAtLeast"; readonly refine: number }
    | { readonly kind: "refineExactly"; readonly refine: number }
    | { readonly kind: "transcendenceAtLeast"; readonly stage: number }
    | { readonly kind: "baseLevelAtLeast"; readonly baseLevel: number }
    /** On regular gear, not shadow gear ("一般装備に装備時"). */
    | { readonly kind: "onRegularGear" }
    /** A base or trait stat as allocated, without bonuses ("純粋なVitが90以上の時"). */
    | { readonly kind: "pureStatAtLeast"; readonly stat: string; readonly value: number }
    | { readonly kind: "pureStatExactly"; readonly stat: string; readonly value: number }
    /** A skill learned to at least a level ("[点穴 -快-]Lv5習得時"), by the skill's name. */
    | { readonly kind: "skillLearned"; readonly skillName: string; readonly level: number }
    /** Worn by one job ("星帝が装備時"), by its name. */
    | { readonly kind: "job"; readonly jobName: string }
    /** The effects count once for every so many refine levels ("精錬値が2上がる度に"). */
    | { readonly kind: "timesRefineSteps"; readonly refinePerStep: number }
    /** The effects count once for every so many base levels ("BaseLvが10上がる度に"). */
    | { readonly kind: "timesBaseLevelSteps"; readonly baseLevelsPerStep: number };

export interface SpGainLine {
    readonly conditions: readonly SpGainCondition[];
    readonly effects: readonly SpGainEffect[];
    /** The line says something about gaining SP that is not read: a condition or a wording this reader does not know. */
    readonly unread: boolean;
}

/** How a line gives SP back, or `null` when it says nothing about gaining SP. */
export function readSpGainLine(line: string): SpGainLine | null {
    let text = canonicalText(line).replace(/^追加で、?/, "");
    if (!mentionsGainingSp(text)) {
        return null;
    }
    const conditions: SpGainCondition[] = [];
    for (let condition = leadingCondition(text); condition !== null; condition = leadingCondition(text)) {
        if (condition.condition === "unknown") {
            return { conditions, effects: [], unread: true };
        }
        conditions.push(condition.condition);
        text = condition.rest;
    }
    const effects: SpGainEffect[] = [];
    for (const reader of effectReaders) {
        text = text.replace(reader.pattern, (match, ...groups: unknown[]) => {
            const textBefore = text.slice(0, Number(groups.at(-2)));
            const effect = reader.read(groups.slice(0, -2) as (string | undefined)[], textBefore);
            if (effect === null) {
                return match;
            }
            effects.push(effect);
            return "";
        });
    }
    return { conditions, effects, unread: mentionsGainingSp(text) };
}

/** Full-width letters and digits made half-width, spaces taken out, and the ways of saying "N SP back" made one. */
function canonicalText(line: string): string {
    return line
        .normalize("NFKC")
        .replaceAll(/\s+/g, "")
        .replaceAll(/(\d+)のSPを回復(?:する)?/g, "SP+$1")
        .replaceAll(/SPを(\d+)回復(?:する)?/g, "SP+$1")
        .replaceAll(/SP\+?(\d+)回復(?:する)?/g, "SP+$1");
}

/** Clauses about something else: coming back to life, the rate of natural recovery, healing, potions, effects switched off. */
const clauseAboutSomethingElse = /復活時|回復力|回復量|回復剤|ヒール|ポーション|発動しない|減少/;

function mentionsGainingSp(text: string): boolean {
    if (text.includes("復活")) {
        return false;
    }
    const clauses = text.split("、").filter((clause) => !clauseAboutSomethingElse.test(clause));
    const aboutSp = clauses.some((clause) => /(?<!Max|M|最大|消費)SP\+\d|SPとして吸収|SPが回復|回復するSP|SPを回復|HP・SP|HPとSP/.test(clause));
    return aboutSp && /回復|吸収|毎に|ごとに|倒した|命中|攻撃時|攻撃する度|攻撃ごと|確率/.test(clauses.join("、"));
}

function leadingCondition(text: string): { condition: SpGainCondition | "unknown"; rest: string } | null {
    const known: [RegExp, (value: number) => SpGainCondition][] = [
        [/^精錬値が(\d+)以上の時、(?:追加で、?)?/, (refine) => ({ kind: "refineAtLeast", refine })],
        [/^精錬値が(\d+)の時、(?:追加で、?)?/, (refine) => ({ kind: "refineExactly", refine })],
        [/^超越段階が(\d+)以上の時、(?:追加で、?)?/, (stage) => ({ kind: "transcendenceAtLeast", stage })],
        [/^BaseLvが?(\d+)以上の時、(?:追加で、?)?/, (baseLevel) => ({ kind: "baseLevelAtLeast", baseLevel })],
        [/^一般装備に装備時、(?:追加で、?)?()/, () => ({ kind: "onRegularGear" })],
        [/^精錬値が(\d+)上がる(?:度|毎|ごと)に、?(?:追加で、?)?/, (refinePerStep) => ({ kind: "timesRefineSteps", refinePerStep })],
        [/^BaseLvが(\d+)上がる(?:度|毎|ごと)に、?(?:追加で、?)?/, (baseLevelsPerStep) => ({ kind: "timesBaseLevelSteps", baseLevelsPerStep })],
    ];
    for (const [pattern, conditionOf] of known) {
        const match = pattern.exec(text);
        if (match !== null) {
            return { condition: conditionOf(Number(match[1])), rest: text.slice(match[0].length) };
        }
    }
    const pureStat = /^純粋な(Str|Agi|Vit|Int|Dex|Luk|Pow|Sta|Wis|Spl|Con|Crt)が(\d+)(以上)?の時、(?:追加で、?)?/i.exec(text);
    if (pureStat !== null) {
        const [, stat = "", value, atLeast] = pureStat;
        return {
            condition: { kind: atLeast === undefined ? "pureStatExactly" : "pureStatAtLeast", stat: stat.toLowerCase(), value: Number(value) },
            rest: text.slice(pureStat[0].length),
        };
    }
    const skillLearned = /^\[([^\]]+)\]Lv(\d+)習得時、(?:追加で、?)?/.exec(text);
    if (skillLearned !== null) {
        return { condition: { kind: "skillLearned", skillName: skillLearned[1] ?? "", level: Number(skillLearned[2]) }, rest: text.slice(skillLearned[0].length) };
    }
    const job = /^([^、系]{1,16}?)が装備時、(?:追加で、?)?/.exec(text);
    if (job !== null && !job[1]?.includes("キャラクター")) {
        return { condition: { kind: "job", jobName: job[1] ?? "" }, rest: text.slice(job[0].length) };
    }
    const unknown = /^[^、]*?(?:の時|習得時|装備時|場合|につき|度に)、/.exec(text);
    return unknown === null ? null : { condition: "unknown", rest: text.slice(unknown[0].length) };
}

/** "物理攻撃命中時" and its kin, as a requirement; anything else (melee only, a race only) is no match. */
const attackEvent = "(物理・魔法|物理|魔法)?攻撃(?:命中)?時";
const chance = "(一定確率|低確率|(\\d+(?:\\.\\d+)?)%の確率)";
const periodicAmount = "(\\d+)秒(?:毎|ごと)に、?(?:HP\\+\\d+%?[,、]?)?SP\\+(\\d+)(%)?";
/**
 * Only at the start of the text or of a clause, so that "人間形モンスターに攻撃命中時" is not read as any attack,
 * and not right after a duration ("「…」使用時、60秒間、"), which belongs to something this reader does not know.
 */
const clauseStart = "(?<=^|、)(?<!秒間、)";

function attackRequirementOf(word: string | undefined): AttackRequirement {
    switch (word) {
        case "物理":
            return "physical";
        case "魔法":
            return "magical";
        case "物理・魔法":
            return "physicalOrMagical";
        default:
            return "anyAttack";
    }
}

function chanceOf(chanceWords: string | undefined, statedPercent: string | undefined): number | null {
    return chanceWords !== undefined && statedPercent !== undefined ? Number(statedPercent) : null;
}

function periodicOf(seconds: string | undefined, amount: string | undefined, percent: string | undefined): PeriodicSp {
    return { seconds: Number(seconds), amount: Number(amount), unit: percent === "%" ? "percentOfMaxSp" : "sp" };
}

const effectReaders: { pattern: RegExp; read: (groups: (string | undefined)[], textBefore: string) => SpGainEffect | null }[] = [
    {
        pattern: new RegExp(`${clauseStart}${attackEvent}、${chance}で(\\d+)秒間、(.*)$`, "g"),
        read([attack, chanceWords, statedPercent, duration, during]) {
            const recovery = new RegExp(`(?<=^|、)${periodicAmount}`).exec(during ?? "");
            const costDown = /スキル使用時の消費SP-(\d+)%/.exec(during ?? "");
            if (recovery === null && costDown === null) {
                return null;
            }
            return {
                kind: "proc",
                attack: attackRequirementOf(attack),
                chancePercent: chanceOf(chanceWords, statedPercent),
                durationSeconds: Number(duration),
                ...(recovery === null ? {} : { recovery: periodicOf(recovery[1], recovery[2], recovery[3]) }),
                ...(costDown === null ? {} : { costDownPercent: Number(costDown[1]) }),
            };
        },
    },
    {
        pattern: new RegExp(`${clauseStart}(?:${attackEvent}、)?${chance}で(?:敵|相手)に与えたダメージの(\\d+(?:\\.\\d+)?)%を(?:HP[、・])?SPとして吸収(?:する)?`, "g"),
        read([attack, chanceWords, statedPercent, percentOfDamage], textBefore) {
            // "…HPとして吸収、一定確率で…SPとして吸収" names its attack once, before the HP part.
            const namedEarlier = [...textBefore.matchAll(new RegExp(attackEvent, "g"))].at(-1);
            return {
                kind: "drain",
                attack: attackRequirementOf(attack ?? namedEarlier?.[1]),
                chancePercent: chanceOf(chanceWords, statedPercent),
                percentOfDamage: Number(percentOfDamage),
            };
        },
    },
    {
        pattern: new RegExp(`${clauseStart}${periodicAmount}`, "g"),
        read: ([seconds, amount, percent]) => ({ kind: "periodic", recovery: periodicOf(seconds, amount, percent) }),
    },
    {
        pattern: new RegExp(`${clauseStart}(?:${attackEvent}|敵攻撃時|攻撃(?:する度|ごと)に)、?(?:毎回)?(?:HP\\+\\d+%?[,、])?SP\\+(\\d+)(?!%)`, "g"),
        read: ([attack, amount]) => ({ kind: "onHit", attack: attackRequirementOf(attack), amount: Number(amount) }),
    },
    {
        pattern: new RegExp(`${clauseStart}(?:(物理・魔法|物理|魔法)攻撃で)?(?:モンスター|敵)を倒した(?:時|とき)[、に]?(?:HP\\+\\d+[,、])?SP\\+(\\d+)(?!%)`, "g"),
        read: ([attack, amount]) => ({ kind: "onKill", attack: attackRequirementOf(attack), amount: Number(amount) }),
    },
];
