import type { ReadingSegment } from "../search/forgiving-search.ts";
import { toKatakana } from "../search/kana.ts";

const isKanaOnly = (text: string) => /^[ぁ-ゖァ-ヺー]*$/.test(text);
const hasKanji = (text: string) => /[一-鿿々〆ヶ]/.test(text);

const katakanaStart = 0x30a1;
const katakanaEnd = 0x30f6;
const toHiragana = (text: string) =>
    Array.from(text, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= katakanaStart && codePoint <= katakanaEnd ? String.fromCodePoint(codePoint - 0x60) : character;
    }).join("");

/**
 * One word and its reading cut so that only the kanji carry a reading:
 * 讃え read タタエ becomes 讃(たた) and え. Kana at either end of the word
 * that the reading repeats is split off; kana in the middle stays with the
 * kanji around it.
 */
export function alignWordReading(surface: string, reading: string): ReadingSegment[] {
    if (!hasKanji(surface) || reading === "" || toKatakana(surface) === toKatakana(reading)) {
        return [[surface]];
    }
    const surfaceKatakana = Array.from(toKatakana(surface));
    const readingKatakana = Array.from(toKatakana(reading));
    const surfaceCharacters = Array.from(surface);

    let leading = 0;
    while (leading < surfaceCharacters.length && isKanaOnly(surfaceCharacters[leading] ?? "") && surfaceKatakana[leading] === readingKatakana[leading]) {
        leading++;
    }
    let trailing = 0;
    while (
        trailing < surfaceCharacters.length - leading &&
        isKanaOnly(surfaceCharacters[surfaceCharacters.length - 1 - trailing] ?? "") &&
        surfaceKatakana[surfaceKatakana.length - 1 - trailing] === readingKatakana[readingKatakana.length - 1 - trailing]
    ) {
        trailing++;
    }
    const middle = surfaceCharacters.slice(leading, surfaceCharacters.length - trailing).join("");
    const middleReading = readingKatakana.slice(leading, readingKatakana.length - trailing).join("");
    const segments: ReadingSegment[] = [];
    if (leading > 0) segments.push([surfaceCharacters.slice(0, leading).join("")]);
    if (middle !== "") segments.push(middleReading === "" ? [middle] : [middle, toHiragana(middleReading)]);
    if (trailing > 0) segments.push([surfaceCharacters.slice(surfaceCharacters.length - trailing).join("")]);
    return segments;
}

/** Neighbouring pieces without a reading joined into one. */
export function joinPlainSegments(segments: readonly ReadingSegment[]): ReadingSegment[] {
    const joined: ReadingSegment[] = [];
    for (const segment of segments) {
        const last = joined.at(-1);
        if (segment[1] === undefined && last !== undefined && last[1] === undefined) {
            joined[joined.length - 1] = [last[0] + segment[0]];
        } else {
            joined.push(segment);
        }
    }
    return joined;
}

/** The whole reading of segmented text, in katakana. */
export function readingOf(segments: readonly ReadingSegment[]): string {
    return toKatakana(segments.map(([text, reading]) => reading ?? text).join(""));
}

const largeKanaOfSmall: Readonly<Record<string, string>> = { ァ: "ア", ィ: "イ", ゥ: "ウ", ェ: "エ", ォ: "オ", ッ: "ツ", ャ: "ヤ", ュ: "ユ", ョ: "ヨ", ヮ: "ワ" };

/** One kana without its voicing mark and at full size, which is how upstream writes its older readings. */
const plainKana = (kana: string) => {
    const unvoiced = toKatakana(kana).normalize("NFD").replaceAll(/[\u3099\u309A]/g, "").normalize("NFC");
    return largeKanaOfSmall[unvoiced] ?? unvoiced;
};

/** Kana the way upstream writes its older readings: katakana without voicing marks, small kana as large ones. Anything else is dropped. */
export function plainKanaOf(text: string): string {
    return Array.from(toKatakana(text), plainKana)
        .join("")
        .replaceAll(/[^\u30A1-\u30FAー]/g, "");
}

/** Whether a reading was written with voicing marks or small kana, so that it can be shown as it is. */
export function isWrittenInFull(reading: string): boolean {
    const katakana = toKatakana(reading);
    return /[\u3099\u309A]/.test(katakana.normalize("NFD")) || /[ァィゥェォッャュョヮ]/.test(katakana);
}


/** The pieces a name falls into for reading it: runs of kanji, runs of kana, and whatever else lies between. */
export function readingPiecesOf(name: string): string[] {
    return name.match(/[\u4E00-\u9FFF々〆]+|[\u3041-\u3096\u30A1-\u30FAー]+|[^\u4E00-\u9FFF々〆\u3041-\u3096\u30A1-\u30FAー]+/g) ?? [];
}

const longVowel = "[アイウエオー]?";
/** How a Latin letter is read out, in plain kana, as a pattern. */
const patternOfLetter: Readonly<Record<string, string>> = {
    a: `エ${longVowel}`,
    b: `ヒ${longVowel}`,
    c: `シ${longVowel}`,
    d: `テイ${longVowel}`,
    e: `イ${longVowel}`,
    f: "エフ",
    g: `シ${longVowel}`,
    h: "エ(?:イチ|ツチ)",
    i: "アイ",
    j: `シエ${longVowel}`,
    k: `ケ${longVowel}`,
    l: "エル",
    m: "エム",
    n: "エヌ",
    o: `オ${longVowel}`,
    p: `ヒ${longVowel}`,
    q: `キユ${longVowel}`,
    r: `ア${longVowel}ル`,
    s: "エス",
    t: `テイ${longVowel}`,
    u: `ユ${longVowel}`,
    v: "(?:フイ|ウイ)",
    w: `タフリユ${longVowel}`,
    x: "エツクス",
    y: "ワイ",
    z: "セツト",
};

/** One thing of a name that takes a stretch of its reading. */
type ReadingUnit =
    /** A kana of the name, which the reading repeats. */
    | { readonly kind: "kana"; readonly kana: string }
    /** A word of kanji, with the reading expected of it, if any: in plain kana for comparing, and as it was written. */
    | { readonly kind: "kanji"; readonly expected: string; readonly expectedAsWritten: string }
    /** Letters and digits, with how they would be read out letter by letter, if they are all letters. */
    | { readonly kind: "letters"; readonly spelledOut: RegExp | null };

/**
 * The name cut into pieces, each run of kanji with the stretch of the
 * given reading that falls on it. The kana of the name pin the reading
 * down: 魂のリング read タマシイノリンク gives 魂(たましい). `undefined` when
 * the reading does not fit the name, as with a reading that is cut short.
 *
 * Where the kana leave it open how the reading divides, the division is
 * taken that agrees with the most of what is known besides: `alreadyRead`,
 * the name as someone else read it word by word, and the way Latin letters
 * are read out.
 *
 * The reading may be written without voicing marks and small kana. A word
 * that `alreadyRead` reads the same way apart from those comes back as
 * `alreadyRead` writes it; any other stretch comes back as the reading
 * writes it, and `hasUnconfirmedStretches` says there was one.
 */
export function alignNameWithReading(name: string, reading: string, alreadyRead: readonly ReadingSegment[] = []): { readonly segments: ReadingSegment[]; readonly hasUnconfirmedStretches: boolean } | undefined {
    const readingCharacters = Array.from(toKatakana(reading)).filter((character) => /[\u30A1-\u30FAー]/.test(character));
    const plainReading = readingCharacters.map(plainKana);
    const pieces = readingPiecesOf(name);
    const wordsOfPiece = wordsByPiece(name, alreadyRead);

    const units: ReadingUnit[] = [];
    const unitCountOfPiece: number[] = [];
    pieces.forEach((piece, index) => {
        const unitsBefore = units.length;
        if (hasKanji(piece)) {
            const words = wordsOfPiece[index] ?? [];
            units.push(
                ...(words.length === 0
                    ? [{ kind: "kanji" as const, expected: "", expectedAsWritten: "" }]
                    : words.map((wordReading) => ({ kind: "kanji" as const, expected: plainKanaOf(wordReading), expectedAsWritten: wordReading }))),
            );
        } else if (isKanaOnly(piece)) {
            units.push(...Array.from(piece, (kana) => ({ kind: "kana" as const, kana: plainKana(kana) })));
        } else if (/[\p{L}\p{N}]/u.test(piece)) {
            const letters = Array.from(piece.normalize("NFKC").toLowerCase()).filter((character) => /[\p{L}\p{N}]/u.test(character));
            const isAllLetters = letters.every((letter) => patternOfLetter[letter] !== undefined);
            units.push({ kind: "letters", spelledOut: isAllLetters ? new RegExp(letters.map((letter) => patternOfLetter[letter]).join(""), "uy") : null });
        }
        unitCountOfPiece.push(units.length - unitsBefore);
    });

    // bestFrom[unit][position]: the most agreements the units from `unit` on can reach when they
    // start at `position` of the reading, with the stretch the first of them takes; -1 if they cannot fit.
    const unreachable = -1;
    interface Best {
        readonly agreements: number;
        readonly length: number;
        /** Whether the first unit takes its stretch because that is what was expected of it. */
        readonly agrees: boolean;
    }
    const memo = new Map<number, Best>();
    const readingLength = plainReading.length;
    function bestFrom(unitIndex: number, position: number): Best {
        if (unitIndex === units.length) {
            return { agreements: position === readingLength ? 0 : unreachable, length: 0, agrees: false };
        }
        const memoKey = unitIndex * (readingLength + 1) + position;
        const known = memo.get(memoKey);
        if (known !== undefined) {
            return known;
        }
        const unit = units[unitIndex] as ReadingUnit;
        let best: Best = { agreements: unreachable, length: 0, agrees: false };
        const consider = (length: number, agreement: number) => {
            const rest = bestFrom(unitIndex + 1, position + length);
            if (rest.agreements !== unreachable && rest.agreements + agreement > best.agreements) {
                best = { agreements: rest.agreements + agreement, length, agrees: agreement > 0 };
            }
        };
        if (unit.kind === "kana") {
            if (unit.kana === "ー") {
                // A long vowel mark may be written as its vowel, as itself, or not at all.
                if ("アイウエオー".includes(plainReading[position] ?? "\u0000")) consider(1, 0);
                consider(0, 0);
            } else if (plainReading[position] === unit.kana) {
                consider(1, 0);
            }
        } else if (unit.kind === "kanji") {
            const expectedLength = Array.from(unit.expected).length;
            if (expectedLength > 0 && plainReading.slice(position, position + expectedLength).join("") === unit.expected) consider(expectedLength, 1);
            for (let length = 1; position + length <= readingLength; length++) consider(length, 0);
        } else {
            if (unit.spelledOut !== null) {
                unit.spelledOut.lastIndex = 0;
                const spelled = unit.spelledOut.exec(plainReading.slice(position).join(""));
                if (spelled !== null) consider(Array.from(spelled[0]).length, 1);
            }
            for (let length = 0; position + length <= readingLength; length++) consider(length, 0);
        }
        memo.set(memoKey, best);
        return best;
    }

    if (bestFrom(0, 0).agreements === unreachable) {
        return undefined;
    }
    const segments: ReadingSegment[] = [];
    let hasUnconfirmedStretches = false;
    let unitIndex = 0;
    let position = 0;
    pieces.forEach((piece, index) => {
        let readingOfPiece = "";
        for (let count = 0; count < (unitCountOfPiece[index] ?? 0); count++) {
            const unit = units[unitIndex] as ReadingUnit;
            const taken = bestFrom(unitIndex, position);
            if (unit.kind === "kanji" && taken.agrees) {
                readingOfPiece += unit.expectedAsWritten;
            } else {
                readingOfPiece += readingCharacters.slice(position, position + taken.length).join("");
                hasUnconfirmedStretches ||= unit.kind === "kanji";
            }
            position += taken.length;
            unitIndex++;
        }
        segments.push(hasKanji(piece) ? [piece, toHiragana(readingOfPiece)] : [piece]);
    });
    return { segments: joinPlainSegments(segments), hasUnconfirmedStretches };
}

/**
 * For each piece of the name, the readings of the words that already-read
 * text divides it into, when its words fill the piece exactly. Empty for a
 * piece they do not, and for one that is not kanji.
 */
function wordsByPiece(name: string, alreadyRead: readonly ReadingSegment[]): string[][] {
    const words: { readonly start: number; readonly end: number; readonly reading: string }[] = [];
    let position = 0;
    for (const [text, reading] of alreadyRead) {
        words.push({ start: position, end: position + text.length, reading: reading ?? text });
        position += text.length;
    }
    let pieceStart = 0;
    return readingPiecesOf(name).map((piece) => {
        const pieceEnd = pieceStart + piece.length;
        const inside = words.filter((word) => word.start < pieceEnd && word.end > pieceStart);
        const fillsExactly = inside.length > 0 && inside[0]?.start === pieceStart && inside.at(-1)?.end === pieceEnd;
        pieceStart = pieceEnd;
        return hasKanji(piece) && fillsExactly ? inside.map((word) => word.reading) : [];
    });
}

/**
 * What already-read text says about each piece of the name, by position
 * among `readingPiecesOf(name)`: the reading of a run of kanji, where the
 * words of the text fill exactly that run.
 */
export function readingsByPiece(name: string, alreadyRead: readonly ReadingSegment[]): (string | undefined)[] {
    return wordsByPiece(name, alreadyRead).map((words) => (words.length === 0 ? undefined : words.join("")));
}
