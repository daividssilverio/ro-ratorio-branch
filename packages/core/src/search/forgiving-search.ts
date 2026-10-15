import { type ApproximateMatch, findApproximately } from "./approximate.ts";
import { canonicalizeRomaji, foldText, romanizeKana, toKatakana } from "./kana.ts";

/** A piece of a name and, where it is not kana already, how it is read. */
export type ReadingSegment = readonly [text: string, reading?: string];

/** One thing a search box lists. */
export interface SearchableEntry {
    readonly id: number;
    readonly name: string;
    /** The name cut into pieces with their readings, for a name that has kanji. The pieces together are the name. */
    readonly reading?: readonly ReadingSegment[];
    readonly english?: string;
    /**
     * The English name piece by piece, each with the part of the name it
     * translates, for an English name that was put together that way. The
     * name parts together are the name. Lets an English word mark its part
     * of the Japanese name.
     */
    readonly englishParts?: readonly (readonly [nameText: string, english: string])[];
    /** Other things people call it, such as "AC" for Arms Cannon. */
    readonly aliases?: readonly string[];
}

/** How well a query matched, best first. */
export const matchKinds = ["exact", "startsWith", "substring", "typo"] as const;
export type MatchKind = (typeof matchKinds)[number];

/** What a term was matched against. */
export type MatchedText = "name" | "reading" | "romaji" | "english" | "alias" | "id";

export interface TermMatch {
    readonly term: string;
    readonly kind: MatchKind;
    /** Typing mistakes allowed for; 0 unless `kind` is "typo". */
    readonly edits: number;
    readonly matchedText: MatchedText;
    /** The part of the name the term matched, when it matched something of the name. */
    readonly nameRange?: readonly [start: number, end: number];
    /** What the term matched, as it is written: the part of the name, of the English name, or the alias. */
    readonly matchedAs: string;
}

export interface SearchHit<Entry extends SearchableEntry = SearchableEntry> {
    readonly entry: Entry;
    /** The worst of its terms' kinds: a hit is only as good as its weakest term. */
    readonly kind: MatchKind;
    readonly edits: number;
    readonly terms: readonly TermMatch[];
    /** The parts of the name to mark, in order and not overlapping. */
    readonly highlights: readonly (readonly [start: number, end: number])[];
}

export interface SearchResult<Entry extends SearchableEntry = SearchableEntry> {
    /** Best first. Every entry in its given order for an empty query. */
    readonly hits: readonly SearchHit<Entry>[];
    /** The words of the query, as they were told apart. */
    readonly terms: readonly string[];
}

interface MappedKey {
    readonly key: string;
    /** For each character of the key, the part of the name it stands for. Missing for a key that is not the name. */
    readonly nameRanges?: readonly (readonly [number, number])[];
    readonly matchedText: MatchedText;
    /** The text to show for a match on a key that is not the name. */
    readonly written?: string;
}

export interface PreparedEntry<Entry extends SearchableEntry = SearchableEntry> {
    readonly entry: Entry;
    readonly keys: readonly MappedKey[];
}

const keyPriority: readonly MatchedText[] = ["id", "name", "reading", "romaji", "english", "alias"];

/** How many typing mistakes a term of this length is forgiven: none when very short, one, or two when long. */
export function forgivenEdits(termLength: number): number {
    if (termLength <= 3) {
        return 0;
    }
    return termLength <= 7 ? 1 : 2;
}

const latinKey = (text: string) => text.normalize("NFKC").toLowerCase().replaceAll(/[^a-z0-9]/g, "");

/** Works out everything an entry can be found by. Do it once per list, not once per keystroke. */
export function prepareEntry<Entry extends SearchableEntry>(entry: Entry): PreparedEntry<Entry> {
    const keys: MappedKey[] = [];
    const name = foldText(entry.name);
    keys.push({ key: name.key, nameRanges: name.sourcePositions.map((position) => [position, position + (Array.from(entry.name.slice(position))[0]?.length ?? 1)]), matchedText: "name" });

    // The reading of the whole name in kana, each kana knowing which part of the name it reads.
    const readingRanges: (readonly [number, number])[] = [];
    let reading = "";
    let namePosition = 0;
    const segments = entry.reading ?? [[entry.name]];
    for (const [text, segmentReading] of segments) {
        if (segmentReading === undefined) {
            let offset = 0;
            for (const character of text) {
                reading += character;
                for (let unit = 0; unit < character.length; unit++) {
                    readingRanges.push([namePosition + offset, namePosition + offset + character.length]);
                }
                offset += character.length;
            }
        } else {
            reading += segmentReading;
            for (let unit = 0; unit < segmentReading.length; unit++) {
                readingRanges.push([namePosition, namePosition + text.length]);
            }
        }
        namePosition += text.length;
    }
    const rangeOfReadingPosition = (position: number): readonly [number, number] => readingRanges[position] ?? [0, 0];

    if (entry.reading !== undefined) {
        const foldedReading = foldText(reading);
        keys.push({ key: foldedReading.key, nameRanges: foldedReading.sourcePositions.map(rangeOfReadingPosition), matchedText: "reading" });
    }

    const katakanaReading = toKatakana(reading);
    // NFKC can change the length of a character (half-width kana with a voicing mark), so positions are followed through it.
    const positionInReading: number[] = [];
    let readingOffset = 0;
    for (const character of reading) {
        for (let unit = 0; unit < toKatakana(character).length; unit++) {
            positionInReading.push(readingOffset);
        }
        readingOffset += character.length;
    }
    const romanized = romanizeKana(katakanaReading);
    const canonical = canonicalizeRomaji(romanized.romaji, romanized.sourcePositions);
    if (canonical.romaji !== "") {
        keys.push({
            key: canonical.romaji,
            nameRanges: canonical.sourcePositions.map((katakanaPosition) => rangeOfReadingPosition(positionInReading[katakanaPosition] ?? 0)),
            matchedText: "romaji",
        });
    }

    if (entry.englishParts !== undefined) {
        let key = "";
        const nameRanges: (readonly [number, number])[] = [];
        let partStart = 0;
        for (const [nameText, english] of entry.englishParts) {
            for (const _letter of latinKey(english)) {
                nameRanges.push([partStart, partStart + nameText.length]);
            }
            key += latinKey(english);
            partStart += nameText.length;
        }
        if (key !== "") {
            keys.push({ key, nameRanges, matchedText: "english", written: entry.english ?? entry.englishParts.map(([, english]) => english).join(" ") });
        }
    } else if (entry.english !== undefined && latinKey(entry.english) !== "") {
        keys.push({ key: latinKey(entry.english), matchedText: "english", written: entry.english });
    }
    for (const alias of entry.aliases ?? []) {
        keys.push({ key: foldText(alias).key, matchedText: "alias", written: alias });
        const aliasRomaji = canonicalizeRomaji(romanizeKana(alias).romaji).romaji;
        if (aliasRomaji !== "" && aliasRomaji !== foldText(alias).key) {
            keys.push({ key: aliasRomaji, matchedText: "alias", written: alias });
        }
    }
    return { entry, keys };
}

export function prepareEntries<Entry extends SearchableEntry>(entries: readonly Entry[]): PreparedEntry<Entry>[] {
    return entries.map(prepareEntry);
}

interface TermForms {
    readonly term: string;
    /** The term folded as kana and width: compared with names, readings and aliases. */
    readonly folded: string;
    /** The term as romaji in one spelling, when it is written in Latin letters. */
    readonly romaji: string | null;
    /** The term as plain Latin letters, when it has any: compared with English names. */
    readonly latin: string | null;
    readonly queriedId: number | null;
}

function formsOf(term: string): TermForms {
    const isLatin = /^[\p{ASCII}]+$/u.test(term.normalize("NFKC"));
    const latin = latinKey(term);
    return {
        term,
        folded: foldText(term).key,
        romaji: romajiFormOf(term, isLatin, latin),
        latin: latin === "" ? null : latin,
        queriedId: /^#?\d+$/.test(term) ? Number(term.replace("#", "")) : null,
    };
}

/**
 * A term in Latin letters as romaji in one spelling. Not for a term that
 * shrinks to less than half of itself on the way: "zzzzzz" is not a way of
 * typing "z".
 */
function romajiFormOf(term: string, isLatin: boolean, latin: string): string | null {
    if (!isLatin || !/[a-z]/i.test(term)) {
        return null;
    }
    const { romaji } = canonicalizeRomaji(term.normalize("NFKC"));
    return romaji.length * 2 < latin.length ? null : romaji;
}

const rankOfKind = (kind: MatchKind) => matchKinds.indexOf(kind);

function bestMatchOfTerm(forms: TermForms, prepared: PreparedEntry): TermMatch | null {
    if (forms.queriedId !== null && forms.queriedId === prepared.entry.id) {
        return { term: forms.term, kind: "exact", edits: 0, matchedText: "id", matchedAs: `#${prepared.entry.id}` };
    }
    let best: (TermMatch & { readonly priority: number; readonly start: number }) | null = null;
    for (const mappedKey of prepared.keys) {
        const form = mappedKey.matchedText === "romaji" ? forms.romaji : mappedKey.matchedText === "english" ? forms.latin : forms.folded;
        if (form === null || form === "" || mappedKey.key === "") {
            continue;
        }
        const found: ApproximateMatch | null = findApproximately(form, mappedKey.key, forgivenEdits(form.length));
        if (found === null) {
            continue;
        }
        const kind: MatchKind = found.edits > 0 ? "typo" : mappedKey.key === form ? "exact" : found.start === 0 ? "startsWith" : "substring";
        const priority = keyPriority.indexOf(mappedKey.matchedText);
        const isBetter =
            best === null ||
            rankOfKind(kind) < rankOfKind(best.kind) ||
            (kind === best.kind && (found.edits < best.edits || (found.edits === best.edits && (priority < best.priority || (priority === best.priority && found.start < best.start)))));
        if (!isBetter) {
            continue;
        }
        const ranges = mappedKey.nameRanges?.slice(found.start, found.end) ?? [];
        const nameRange: readonly [number, number] | undefined =
            ranges.length === 0 ? undefined : [Math.min(...ranges.map(([start]) => start)), Math.max(...ranges.map(([, end]) => end))];
        best = {
            term: forms.term,
            kind,
            edits: found.edits,
            matchedText: mappedKey.matchedText,
            ...(nameRange === undefined ? {} : { nameRange }),
            matchedAs: mappedKey.written !== undefined || nameRange === undefined ? (mappedKey.written ?? prepared.entry.name) : prepared.entry.name.slice(nameRange[0], nameRange[1]),
            priority,
            start: found.start,
        };
    }
    if (best === null) {
        return null;
    }
    const { priority: _priority, start: _start, ...termMatch } = best;
    return termMatch;
}

function mergedRanges(ranges: readonly (readonly [number, number])[]): (readonly [number, number])[] {
    const merged: [number, number][] = [];
    for (const [start, end] of [...ranges].sort((oneRange, otherRange) => oneRange[0] - otherRange[0])) {
        const last = merged.at(-1);
        if (last !== undefined && start < last[1]) {
            last[1] = Math.max(last[1], end);
        } else {
            merged.push([start, end]);
        }
    }
    return merged;
}

export interface SearchOptions<Entry extends SearchableEntry> {
    /** Raises an entry among hits of the same kind: the higher, the earlier. For "owned", "recently used" and the like. */
    readonly boostOf?: (entry: Entry) => number;
}

/**
 * Finds the entries that match every word of the query, in any order, by
 * name, reading, romaji, English name, alias or "#ID". Exact matches come
 * first, then names that start with the query, then names that hold it,
 * then near misses.
 */
export function searchEntries<Entry extends SearchableEntry>(prepared: readonly PreparedEntry<Entry>[], query: string, options: SearchOptions<Entry> = {}): SearchResult<Entry> {
    const terms = query
        .normalize("NFKC")
        .split(/\s+/)
        .filter((term) => term !== "");
    const boostOf = options.boostOf ?? (() => 0);
    if (terms.length === 0) {
        const everyEntry = prepared.map((preparedEntry, order) => ({ hit: { entry: preparedEntry.entry, kind: "exact" as const, edits: 0, terms: [], highlights: [] }, order }));
        everyEntry.sort((one, other) => boostOf(other.hit.entry) - boostOf(one.hit.entry) || one.order - other.order);
        return { hits: everyEntry.map(({ hit }) => hit), terms };
    }

    const termForms = terms.map(formsOf);
    const ranked: { readonly hit: SearchHit<Entry>; readonly order: number; readonly firstStart: number }[] = [];
    prepared.forEach((preparedEntry, order) => {
        const termMatches: TermMatch[] = [];
        for (const forms of termForms) {
            const termMatch = bestMatchOfTerm(forms, preparedEntry);
            if (termMatch === null) {
                return;
            }
            termMatches.push(termMatch);
        }
        const worstKind = termMatches.reduce<MatchKind>((worst, termMatch) => (rankOfKind(termMatch.kind) > rankOfKind(worst) ? termMatch.kind : worst), "exact");
        // Two words can each match exactly without the whole query being the whole name.
        const kind: MatchKind = terms.length > 1 && rankOfKind(worstKind) < rankOfKind("substring") ? "substring" : worstKind;
        const highlights = mergedRanges(termMatches.flatMap((termMatch) => (termMatch.nameRange === undefined ? [] : [termMatch.nameRange])));
        ranked.push({
            hit: { entry: preparedEntry.entry, kind, edits: termMatches.reduce((edits, termMatch) => edits + termMatch.edits, 0), terms: termMatches, highlights },
            order,
            firstStart: highlights[0]?.[0] ?? Number.MAX_SAFE_INTEGER,
        });
    });
    ranked.sort(
        (one, other) =>
            rankOfKind(one.hit.kind) - rankOfKind(other.hit.kind) ||
            one.hit.edits - other.hit.edits ||
            boostOf(other.hit.entry) - boostOf(one.hit.entry) ||
            one.firstStart - other.firstStart ||
            one.hit.entry.name.length - other.hit.entry.name.length ||
            one.order - other.order,
    );
    return { hits: ranked.map(({ hit }) => hit), terms };
}
