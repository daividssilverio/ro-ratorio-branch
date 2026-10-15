/**
 * Reading the text of a market listing: its lines, the item line, the
 * number on an effect line, and what an effect line is about. Nothing here
 * knows the engine; matching against what an item offers is done with it.
 */

/** A text as names are compared by: full and half width alike, no case, no spaces. */
export function nameKeyOf(text: string): string {
    return text.normalize("NFKC").toLowerCase().replaceAll(/\s+/g, "");
}

/** The lines of a pasted listing that say something. */
export function linesOfListing(text: string): string[] {
    return text
        .split(/\r?\n|<br\s*\/?>/i)
        .map((line) => line.trim())
        .filter((line) => line !== "");
}

export interface ItemLine {
    /** The refine a "+7" in front of the name gives. */
    readonly refine: number | null;
    /** The name without the refine and without its card slot count. */
    readonly name: string;
    /** The "[3]" behind the name, when it has one. */
    readonly socketCount: number | null;
}

/** Reads "+7 錆びたアーム[3]" into its refine, name and card slot count. */
export function readItemLine(line: string): ItemLine {
    const normalized = line.normalize("NFKC").trim();
    const refine = /^\+\s*(\d+)\s*/.exec(normalized);
    const withoutRefine = refine === null ? normalized : normalized.slice(refine[0].length);
    const socketCount = /\s*\[(\d)\]\s*$/.exec(withoutRefine);
    return {
        refine: refine === null ? null : Number(refine[1]),
        name: (socketCount === null ? withoutRefine : withoutRefine.slice(0, socketCount.index)).trim(),
        socketCount: socketCount === null ? null : Number(socketCount[1]),
    };
}

/** The stage a "超越段階　★1" line gives, or `null` for a line that is not one. */
export function transcendenceOfLine(line: string): number | null {
    const stage = /^超越(?:段階)?\s*[★☆]?\s*(\d+)\s*$/.exec(line.normalize("NFKC").trim());
    return stage === null ? null : Number(stage[1]);
}

/** The number an effect line ends in, or carries before a word such as 減少 or 無視. `null` for a line without one. */
export function valueOfEffectLine(line: string): number | null {
    const normalized = line.normalize("NFKC");
    const numbers = normalized.match(/\d+(?:\.\d+)?(?=\s*%?\s*(?:[^\d%]*)$)/g);
    const last = numbers?.at(-1);
    return last === undefined ? null : Number(last);
}

/** Wordings of the same thing, brought to one before the features are read. */
const sameThing: readonly (readonly [RegExp, string])[] = [
    // A note that the effect leaves players out says nothing the effect is about.
    [/\(プレイヤーには[^)]*\)/g, ""],
    [/魔法防御力?/g, "mdef"],
    [/物理防御力?|防御力/g, "def"],
    [/攻撃速度/g, "aspd"],
    [/絶対に(?:壊れ|損傷し|破損し)ない|破壊不可/g, "unbreakable"],
    // Natural regeneration, however it is worded; the amount a heal restores is another thing.
    [/(hp|sp)自然回復(?:力|量)?|(hp|sp)回復力/g, "$1$2regen"],
    [/(?:hp|sp)回復量/g, "回復量"],
    [/魚貝|魚類/g, "魚"],
    [/竜族/g, "竜"],
    [/全ての基本ステータス|全基本ステ(?:ータス)?|全てのステータス/g, "allstats"],
    [/ボス(?:属性)?/g, "boss"],
    [/一般(?:属性)?/g, "normal"],
    [/人間形?プレイヤー|プレイヤー\(人間\)/g, "playerhuman"],
    [/ドラム(?:形|族)?(?:プレイヤー)?/g, "playerdoram"],
];

/** Latin words that name the same stat. */
const latinSynonyms: Readonly<Record<string, string>> = { critical: "cri" };

/**
 * What an effect is about, read off its wording: the stat or the kind of
 * damage, whom it is against, whether it is a share. Two wordings of one
 * effect ("物理攻撃時、小型モンスターに与えるダメージ" in the game,
 * "小型のモンスターに与える物理ダメージ" in the calculator) give the same
 * features; the number itself is not one. Sorted, each once.
 */
export function effectFeaturesOf(wording: string): string[] {
    let text = nameKeyOf(wording);
    for (const [pattern, replacement] of sameThing) {
        text = text.replaceAll(pattern, replacement);
    }
    const features = new Set<string>();
    const take = (pattern: RegExp, featureOf: (match: RegExpExecArray) => string) => {
        text = text.replaceAll(pattern, (...groups) => {
            features.add(featureOf(groups as unknown as RegExpExecArray));
            return " ";
        });
    };
    // An element is named with 属性 behind it; taken first, so that 不死属性 is not read as the undead race.
    take(/(無|水|地|火|風|毒|聖|闇|念|不死)属性(攻撃)?/g, (match) => `${match[2] === undefined ? "element" : "elementattack"}:${match[1]}`);
    take(/(無形|不死|動物|植物|昆虫|魚|悪魔|人間|天使|竜)(?:形|族)?/g, (match) => `race:${match[1]}`);
    take(/(小|中|大)型/g, (match) => `size:${match[1]}`);
    take(/プレイヤー/g, () => "player");
    take(/回復量/g, () => "回復量");
    take(/完全回避|詠唱|ディレイ|クリティカル|遠距離|近接|ヒール|付与|無視|固定/g, (match) => (match[0] === "クリティカル" ? "cri" : match[0]));
    // A stat is written in Latin letters (STR, MaxHP, Matk, H.Plus, P.Atk), each a feature of its own, whole words only so that Atk is not Matk.
    take(/[a-z](?:[a-z.]*[a-z])?/g, (match) => latinSynonyms[match[0]] ?? match[0]);
    take(/物理|魔法/g, (match) => match[0]);
    take(/受ける|耐性/g, () => "taken");
    take(/与える/g, () => "dealt");
    take(/%/g, () => "%");
    return [...features].sort();
}

/** How much two texts share, from 0 to 1, by the characters they are made of whatever their order. */
export function characterSimilarity(oneText: string, otherText: string): number {
    const lettersOf = (text: string) => Array.from(nameKeyOf(text).replaceAll(/[\d+\-%。、,.:]/g, ""));
    const oneLetters = lettersOf(oneText);
    const remaining = lettersOf(otherText);
    const otherLength = remaining.length;
    let shared = 0;
    for (const letter of oneLetters) {
        const position = remaining.indexOf(letter);
        if (position >= 0) {
            remaining.splice(position, 1);
            shared++;
        }
    }
    return oneLetters.length + otherLength === 0 ? 0 : (2 * shared) / (oneLetters.length + otherLength);
}
