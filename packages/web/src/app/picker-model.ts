import {
    type CatalogEntry,
    type PreparedEntry,
    prepareEntries,
    type ReadingSegment,
    type SearchableEntry,
    searchEntries,
    type SearchHit,
    type TermMatch,
    type TextKind,
} from "@ro-ratorio-branch/core/platform-neutral";
import { aliasesOf, type TextOfKind } from "./text/text-index.ts";

/** A catalog entry as a search box lists it. Its text (reading, aliases) is that of `textId` where it has one, of its own ID otherwise. */
export interface PickerEntry extends CatalogEntry {
    readonly textId?: number;
}

/** An entry with everything it can be found by. */
export interface SearchablePickerEntry extends SearchableEntry {
    readonly source: PickerEntry;
    /** Whether someone checked the English name; one put together by the app is shown with a question mark. */
    readonly isEnglishConfirmed: boolean;
}

export type PreparedPickerEntries = readonly PreparedEntry<SearchablePickerEntry>[];

/** Works out what every entry of a list can be found by. Once per list and set of readings, not per keystroke. */
export function preparePickerEntries(entries: readonly PickerEntry[], textKind: TextKind | null, text: TextOfKind | null): PreparedPickerEntries {
    return prepareEntries(
        entries.map((entry): SearchablePickerEntry => {
            const textId = entry.textId ?? entry.id;
            const reading = text?.readings[String(textId)];
            const english = text?.english[String(textId)];
            // A list may show a name with something added to it; the parts only fit the name they were cut from.
            const englishParts = english?.parts !== undefined && english.parts.map(([nameText]) => nameText).join("") === entry.name ? english.parts : undefined;
            // What an entry does finds it too.
            const aliases = [...aliasesOf(textKind, textId), ...(english?.aliases ?? []), ...(entry.detail === undefined || entry.detail === "" ? [] : [entry.detail])];
            return {
                id: entry.id,
                name: entry.name,
                source: entry,
                isEnglishConfirmed: english?.isConfirmed === true,
                ...(reading === undefined ? {} : { reading }),
                ...(english?.name === undefined ? {} : { english: english.name }),
                ...(englishParts === undefined ? {} : { englishParts }),
                ...(aliases.length === 0 ? {} : { aliases }),
            };
        }),
    );
}

/** What a search box says above its results about how the query was understood. */
export type PickerNotice =
    /** Nothing matched as typed; the results are near misses. */
    | { readonly kind: "nearMatchesOnly"; readonly term: string; readonly matchedAs: string; readonly edits: number }
    /** Words were found through a reading, romaji, an English name or an alias. */
    | { readonly kind: "readAs"; readonly readings: readonly { readonly term: string; readonly matchedAs: string }[] };

export interface PickerSearch {
    /** The first hits, best first. */
    readonly shown: readonly SearchHit<SearchablePickerEntry>[];
    readonly matchCount: number;
    readonly notice: PickerNotice | null;
}

const isIndirect = (termMatch: TermMatch) => termMatch.matchedText !== "name" && termMatch.matchedText !== "id";

export function searchPicker(prepared: PreparedPickerEntries, query: string, shownLimit: number, boostOf?: (entry: PickerEntry) => number): PickerSearch {
    const { hits } = searchEntries(prepared, query, boostOf === undefined ? {} : { boostOf: (entry) => boostOf(entry.source) });
    const [firstHit] = hits;
    let notice: PickerNotice | null = null;
    if (firstHit !== undefined && firstHit.terms.length > 0) {
        const nearMiss = firstHit.terms.find((termMatch) => termMatch.kind === "typo");
        if (firstHit.kind === "typo" && nearMiss !== undefined) {
            notice = { kind: "nearMatchesOnly", term: nearMiss.term, matchedAs: nearMiss.matchedAs, edits: nearMiss.edits };
        } else if (firstHit.terms.some(isIndirect)) {
            notice = { kind: "readAs", readings: firstHit.terms.filter(isIndirect).map((termMatch) => ({ term: termMatch.term, matchedAs: termMatch.matchedAs })) };
        }
    }
    return { shown: hits.slice(0, shownLimit), matchCount: hits.length, notice };
}

/** A stretch of a name as it is shown: marked or not, with its reading where it is kanji. */
export interface NamePart {
    readonly text: string;
    readonly reading?: string;
    readonly isMarked: boolean;
}

/**
 * A name cut for display: at the borders of what a search marked and of the
 * words that have a reading. A word with a reading is never cut: it is
 * marked as a whole when any of it is.
 */
export function namePartsOf(name: string, reading: readonly ReadingSegment[] | undefined, highlights: readonly (readonly [number, number])[]): NamePart[] {
    const segments: readonly ReadingSegment[] = reading !== undefined && reading.map(([text]) => text).join("") === name ? reading : [[name]];
    const isMarkedAt = (position: number) => highlights.some(([start, end]) => position >= start && position < end);
    const parts: NamePart[] = [];
    let position = 0;
    for (const [text, segmentReading] of segments) {
        if (segmentReading !== undefined) {
            const isMarked = Array.from({ length: text.length }, (_unused, offset) => isMarkedAt(position + offset)).some(Boolean);
            parts.push({ text, reading: segmentReading, isMarked });
            position += text.length;
            continue;
        }
        let run = "";
        let runIsMarked = false;
        for (const character of text) {
            const isMarked = isMarkedAt(position);
            if (run !== "" && isMarked !== runIsMarked) {
                parts.push({ text: run, isMarked: runIsMarked });
                run = "";
            }
            run += character;
            runIsMarked = isMarked;
            position += character.length;
        }
        if (run !== "") {
            parts.push({ text: run, isMarked: runIsMarked });
        }
    }
    return parts;
}

/**
 * The rows whose text matches every word of the query, in their own order:
 * for lists that are filtered in place, not ranked.
 */
export function rowsMatching<Row>(rows: readonly Row[], textOf: (row: Row) => string, query: string): Row[] {
    if (query.trim() === "") {
        return [...rows];
    }
    const prepared = prepareEntries(rows.map((row, index) => ({ id: index, name: textOf(row) })));
    const matchingIndexes = new Set(searchEntries(prepared, query).hits.map((hit) => hit.entry.id));
    return rows.filter((_row, index) => matchingIndexes.has(index));
}
