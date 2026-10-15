// Builds packages/core/src/text/readings/<kind>.json: how the kanji in
// upstream's names are read, for furigana and for finding a name by its reading.
//
//   mise exec -- pnpm text-index
//
// Upstream has a kana reading for many names. Where it is the whole reading,
// it is laid over the name and each run of kanji takes its stretch. Older
// readings are written without voicing marks and small kana; there a
// tokenizer's reading is used for a run when it agrees with the stretch
// apart from those. Where upstream has only the first few kana, or
// nothing, the tokenizer's reading stands, checked against those kana.
// What could not be confirmed is listed in readings-to-check.txt. A name in
// reading-overrides.json takes its reading from there.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRatorioEngine } from "../../packages/core/src/engine-adapter/load-ratorio-engine-in-node.ts";
import { loadTextSources, type TextKind, textKinds } from "../../packages/core/src/engine-adapter/text-sources.ts";
import { toKatakana } from "../../packages/core/src/search/kana.ts";
import type { ReadingSegment } from "../../packages/core/src/search/forgiving-search.ts";
import { type EnglishGlossary, englishNamesOf } from "../../packages/core/src/text/english-names.ts";
import { alignNameWithReading, alignWordReading, isWrittenInFull, joinPlainSegments, plainKanaOf, readingOf } from "../../packages/core/src/text/align-reading.ts";

interface Token {
    readonly surface_form: string;
    readonly reading?: string;
}
interface Tokenizer {
    tokenize(text: string): Token[];
}

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji") as { builder(options: { dicPath: string }): { build(done: (error: Error | null, tokenizer: Tokenizer) => void): void } };
const dictionaryPath = join(dirname(require.resolve("kuromoji/package.json")), "dict");
const textDirectory = fileURLToPath(new URL("../../packages/core/src/text/", import.meta.url));

const hasKanji = (text: string) => /[一-鿿々〆]/.test(text);
/**
 * Whether a reading starts the way upstream's cut-short reading says. That
 * one writes a long vowel as its vowel or not at all.
 */
function startsLikeSortKey(reading: string, sortKey: string): boolean {
    const readingKana = plainKanaOf(reading);
    const keyKana = plainKanaOf(sortKey);
    let readingPosition = 0;
    for (let keyPosition = 0; keyPosition < keyKana.length; ) {
        const readingCharacter = readingKana[readingPosition];
        const keyCharacter = keyKana[keyPosition];
        if (readingCharacter === undefined) {
            return false;
        }
        if (readingCharacter === keyCharacter || (readingCharacter === "ー" && "アイウエオ".includes(keyCharacter ?? ""))) {
            readingPosition++;
            keyPosition++;
        } else if (readingCharacter === "ー") {
            readingPosition++;
        } else {
            return false;
        }
    }
    return true;
}

/**
 * The reading of a name: its pieces, and whether it still needs a look.
 * `byTokenizer` is the tokenizer's own reading of the name.
 */
const kanaInACutShortReading = 4;

function readingOfName(name: string, sortKey: string | undefined, byTokenizer: ReadingSegment[]): { readonly segments: ReadingSegment[]; readonly isDoubtful: boolean } {
    // Upstream's oldest readings are the first four kana only. Such a short one is the whole reading
    // only if the tokenizer reads the name that way too.
    const mayBeCutShort = sortKey !== undefined && plainKanaOf(sortKey).length <= kanaInACutShortReading && plainKanaOf(readingOf(byTokenizer)).replaceAll("ー", "") !== plainKanaOf(sortKey).replaceAll("ー", "");
    const byUpstream = sortKey === undefined || mayBeCutShort ? undefined : alignNameWithReading(name, sortKey, byTokenizer);
    if (byUpstream === undefined) {
        const leavesKanjiUnread = byTokenizer.some(([text, reading]) => reading === undefined && hasKanji(text));
        return { segments: byTokenizer, isDoubtful: leavesKanjiUnread || (sortKey !== undefined && !startsLikeSortKey(readingOf(byTokenizer), sortKey)) };
    }
    // Upstream writes its older readings without voicing marks and small kana, so a stretch that
    // only upstream vouches for may be missing some, unless the reading is one of those written in full.
    return { segments: byUpstream.segments, isDoubtful: byUpstream.hasUnconfirmedStretches && !isWrittenInFull(sortKey ?? "") };
}

function loadTokenizer(): Promise<Tokenizer> {
    return new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath: dictionaryPath }).build((error, tokenizer) => (error === null ? resolve(tokenizer) : reject(error)));
    });
}

type ReadingsOfKind = Record<string, ReadingSegment[]>;
type Overrides = Partial<Record<TextKind, Record<string, ReadingSegment[]>>>;

await loadRatorioEngine();
const sources = await loadTextSources();
const tokenizer = await loadTokenizer();
const overrides = JSON.parse(readFileSync(join(textDirectory, "reading-overrides.json"), "utf8")) as Overrides;

const readings = {} as Record<TextKind, ReadingsOfKind>;
const doubtful: string[] = [];
for (const kind of textKinds) {
    const readingsOfKind: ReadingsOfKind = {};
    for (const { id, name, sortKey } of sources[kind]) {
        if (!hasKanji(name)) {
            continue;
        }
        const overridden = overrides[kind]?.[String(id)];
        if (overridden !== undefined) {
            if (overridden.map(([text]) => text).join("") !== name) {
                throw new Error(`reading-overrides.json: the pieces of ${kind} ${id} do not make up its name ${name}`);
            }
            readingsOfKind[String(id)] = overridden;
            continue;
        }
        const byTokenizer = joinPlainSegments(tokenizer.tokenize(name).flatMap((token) => alignWordReading(token.surface_form, token.reading ?? "")));
        const { segments, isDoubtful } = readingOfName(name, sortKey, byTokenizer);
        readingsOfKind[String(id)] = segments;
        if (isDoubtful) {
            doubtful.push(`${kind} ${id} ${name}: ${segments.map(([text, reading]) => (reading === undefined ? text : `${text}(${reading})`)).join("")}${sortKey === undefined ? "" : `  upstream key ${sortKey}`}`);
        }
    }
    readings[kind] = readingsOfKind;
}

// One file per kind, so that a screen loads only the readings of what it lists.
mkdirSync(join(textDirectory, "readings"), { recursive: true });
for (const kind of textKinds) {
    const lines = Object.entries(readings[kind]).map(([id, segments]) => `    ${JSON.stringify(id)}: ${JSON.stringify(segments)}`);
    writeFileSync(join(textDirectory, "readings", `${kind}.json`), `{\n${lines.join(",\n")}\n}\n`);
}
writeFileSync(join(textDirectory, "readings-to-check.txt"), `${doubtful.join("\n")}\n`);

// English: what the glossary and upstream's identifiers give, with checked names on top.
const glossary = JSON.parse(readFileSync(join(textDirectory, "english-glossary.json"), "utf8")) as EnglishGlossary;
const checkedNames = JSON.parse(readFileSync(join(textDirectory, "english-overrides.json"), "utf8")) as Partial<Record<TextKind, Record<string, string>>>;
mkdirSync(join(textDirectory, "english"), { recursive: true });
const englishCounts: string[] = [];
for (const kind of textKinds) {
    const englishNames = englishNamesOf(sources[kind], glossary, checkedNames[kind] ?? {});
    const lines = Object.entries(englishNames).map(([id, englishName]) => `    ${JSON.stringify(id)}: ${JSON.stringify(englishName)}`);
    writeFileSync(join(textDirectory, "english", `${kind}.json`), `{\n${lines.join(",\n")}\n}\n`);
    const named = Object.values(englishNames).filter((englishName) => englishName.name !== undefined).length;
    englishCounts.push(`${kind} ${named} named and ${Object.keys(englishNames).length - named} in part of ${sources[kind].length}`);
}
console.log(`English written: ${englishCounts.join(", ")}.`);

const counts = textKinds.map((kind) => `${kind} ${Object.keys(readings[kind]).length}`).join(", ");
console.log(`Readings written: ${counts}. ${doubtful.length} to check, listed in readings-to-check.txt.`);
