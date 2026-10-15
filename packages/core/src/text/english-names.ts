/** Japanese words of game names and the English they are known by. */
export type EnglishGlossary = Readonly<Record<string, string>>;

/** A stretch of a name and its English; "" where it has none. The stretches together are the name. */
export type EnglishPart = readonly [nameText: string, english: string];

/** What is known of a name in English. */
export interface EnglishName {
    /** The whole name. Missing when only some of its words are known. */
    readonly name?: string;
    /** Set for a name someone checked; a name put together from the glossary or from an identifier is not. */
    readonly isConfirmed?: true;
    /** The name word by word, so that an English word finds its part of the Japanese name. */
    readonly parts?: readonly EnglishPart[];
    /** Identifiers the game itself uses for it, to search by. */
    readonly aliases?: readonly string[];
}

const isKatakana = (character: string | undefined) => character !== undefined && /[ァ-ヺー]/.test(character);
const isJapanese = (character: string | undefined) => character !== undefined && /[ぁ-ゖァ-ヺー一-鿿々〆]/.test(character);

const joiningParticle = "の";

/** A katakana word this short is too easily a piece of a longer word, so it only counts when it stands alone. */
const shortestKatakanaWordInsideARun = 3;

interface Cover {
    readonly coveredLength: number;
    readonly wordCount: number;
    /** The glossary word that starts here, when the best cover takes one. */
    readonly word?: string;
}

/**
 * Cuts a name at the glossary words in it, taking the cover that leaves the
 * least of the name untranslated and, among those, the one with the fewest
 * words. `coversWholeName` says that nothing Japanese is left over.
 */
export function englishPartsOf(name: string, glossary: EnglishGlossary): { readonly parts: EnglishPart[]; readonly coversWholeName: boolean } {
    const wordsByFirstCharacter = new Map<string, string[]>();
    for (const word of Object.keys(glossary)) {
        const first = word[0] ?? "";
        wordsByFirstCharacter.set(first, [...(wordsByFirstCharacter.get(first) ?? []), word]);
    }
    const standsWhereItMay = (word: string, start: number) =>
        word.length >= shortestKatakanaWordInsideARun || !Array.from(word).every(isKatakana) || (!isKatakana(name[start - 1]) && !isKatakana(name[start + word.length]));

    const best: Cover[] = Array.from({ length: name.length + 1 }, () => ({ coveredLength: 0, wordCount: 0 }));
    for (let position = name.length - 1; position >= 0; position--) {
        let cover: Cover = { coveredLength: best[position + 1]?.coveredLength ?? 0, wordCount: best[position + 1]?.wordCount ?? 0 };
        for (const word of wordsByFirstCharacter.get(name[position] ?? "") ?? []) {
            if (!name.startsWith(word, position) || !standsWhereItMay(word, position)) {
                continue;
            }
            const after = best[position + word.length] ?? { coveredLength: 0, wordCount: 0 };
            const candidate: Cover = { coveredLength: after.coveredLength + word.length, wordCount: after.wordCount + 1, word };
            if (candidate.coveredLength > cover.coveredLength || (candidate.coveredLength === cover.coveredLength && candidate.wordCount < cover.wordCount)) {
                cover = candidate;
            }
        }
        best[position] = cover;
    }

    const parts: EnglishPart[] = [];
    let untranslated = "";
    let coversWholeName = true;
    for (let position = 0; position < name.length; ) {
        const word = best[position]?.word;
        if (word === undefined) {
            // 深淵の騎士: の between two known words joins them and needs no English of its own.
            const joinsTwoWords = name[position] === joiningParticle && untranslated === "" && parts.length > 0 && best[position + 1]?.word !== undefined;
            coversWholeName &&= joinsTwoWords || !isJapanese(name[position]);
            untranslated += name[position];
            position++;
            continue;
        }
        if (untranslated !== "") {
            parts.push([untranslated, ""]);
            untranslated = "";
        }
        parts.push([word, glossary[word] ?? ""]);
        position += word.length;
    }
    if (untranslated !== "") {
        parts.push([untranslated, ""]);
    }
    return { parts, coversWholeName };
}

/** The parts of a name written out as one English name. What has no English (digits, brackets, Latin letters) stays as it is. */
export function composeEnglishName(parts: readonly EnglishPart[]): string {
    return parts
        .map(([nameText, english]) => (english !== "" ? english : nameText === joiningParticle ? "" : nameText.replaceAll("（", "(").replaceAll("）", ")").replaceAll(/[・　]/g, " ")))
        .join(" ")
        .replaceAll(/(\S)([([])/g, "$1 $2")
        .replaceAll(/\s+/g, " ")
        .replaceAll(/([([]) /g, "$1")
        .replaceAll(/ ([)\]])/g, "$1")
        .trim();
}

/** The English name of a name the glossary covers, or `undefined`, and its parts either way. */
export function englishNameOf(name: string, glossary: EnglishGlossary): { readonly name: string | undefined; readonly parts: EnglishPart[] } {
    const { parts, coversWholeName } = englishPartsOf(name, glossary);
    return { name: coversWholeName && parts.some(([, english]) => english !== "") ? composeEnglishName(parts) : undefined, parts };
}

/** An identifier such as `ARMS_CANNON` as words: "Arms Cannon". */
export function englishNameFromCode(code: string): string {
    return code
        .split("_")
        .filter((word) => word !== "")
        .map((word) => (word[0] ?? "").toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

/** A name as the text index knows it: what upstream calls it and the identifiers it has for it. */
export interface NameToTranslate {
    readonly id: number;
    readonly name: string;
    readonly code?: string;
    readonly gameCode?: string;
}

/**
 * What is known in English of every name of a kind, by ID. A checked name
 * wins; then the identifier upstream has for it (skills and jobs); then the
 * glossary. A name with nothing known is left out.
 */
export function englishNamesOf(names: readonly NameToTranslate[], glossary: EnglishGlossary, checkedNames: Readonly<Record<string, string>>): Record<string, EnglishName> {
    const englishNames: Record<string, EnglishName> = {};
    for (const { id, name, code, gameCode } of names) {
        const byGlossary = englishNameOf(name, glossary);
        const hasTranslatedParts = byGlossary.parts.some(([, english]) => english !== "");
        const checkedName = checkedNames[String(id)];
        const englishName = checkedName ?? (code === undefined ? byGlossary.name : englishNameFromCode(code));
        const known: EnglishName = {
            ...(englishName === undefined ? {} : { name: englishName }),
            ...(checkedName === undefined ? {} : { isConfirmed: true as const }),
            ...(hasTranslatedParts ? { parts: byGlossary.parts } : {}),
            ...(gameCode === undefined ? {} : { aliases: [gameCode] }),
        };
        if (Object.keys(known).length > 0) {
            englishNames[String(id)] = known;
        }
    }
    return englishNames;
}
