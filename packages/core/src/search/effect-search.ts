import type { CatalogEntry } from "../engine-adapter/engine-catalog.ts";
import { type EnglishGlossary, englishPartsOf } from "../text/english-names.ts";
import { type PreparedEntry, prepareEntries, type SearchableEntry, searchEntries } from "./forgiving-search.ts";

/** A catalog entry found by what it does, with the lines that matched. */
export interface EffectHit<Entry extends CatalogEntry = CatalogEntry> {
    readonly entry: Entry;
    /** The effect lines to show: those a word of the query was found in, or the first ones when nothing was asked. */
    readonly lines: readonly { readonly text: string; readonly highlights: readonly (readonly [number, number])[] }[];
}

export interface EffectSearch<Entry extends CatalogEntry = CatalogEntry> {
    readonly shown: readonly EffectHit<Entry>[];
    readonly matchCount: number;
}

const effectLineSeparator = " / ";

interface EntryWithEffects<Entry extends CatalogEntry> extends SearchableEntry {
    readonly source: Entry;
    readonly lineStarts: readonly number[];
}

export type PreparedEffects<Entry extends CatalogEntry = CatalogEntry> = readonly PreparedEntry<EntryWithEffects<Entry>>[];

/** Works out what every entry of a list can be found by among its effects. Once per list. */
export function prepareEffects<Entry extends CatalogEntry>(entries: readonly Entry[], effectWords: EnglishGlossary = {}): PreparedEffects<Entry> {
    return prepareEntries(
        entries.map((entry): EntryWithEffects<Entry> => {
            const lines = entry.effects ?? [];
            const lineStarts: number[] = [];
            let position = 0;
            for (const line of lines) {
                lineStarts.push(position);
                position += line.length + effectLineSeparator.length;
            }
            const text = lines.join(effectLineSeparator);
            // Effect text has no English of its own; the words the glossary knows let an English word find its place in it.
            const { parts } = englishPartsOf(text, effectWords);
            return { id: entry.id, name: text, source: entry, lineStarts, ...(parts.some(([, english]) => english !== "") ? { englishParts: parts } : {}) };
        }),
    );
}

/**
 * The entries whose effects have every word of the query, in any of their
 * lines, best match first; every entry in the list's order for no query.
 */
export function searchEffects<Entry extends CatalogEntry>(prepared: PreparedEffects<Entry>, query: string, shownLimit: number, shownLinesPerEntry: number): EffectSearch<Entry> {
    const { hits } = searchEntries(prepared, query);
    const shown = hits.slice(0, shownLimit).map((hit): EffectHit<Entry> => {
        const lines = (hit.entry.source.effects ?? []).map((text, lineIndex) => {
            const start = hit.entry.lineStarts[lineIndex] ?? 0;
            const highlights = hit.highlights
                .filter(([from, to]) => from < start + text.length && to > start)
                .map(([from, to]) => [Math.max(from - start, 0), Math.min(to - start, text.length)] as const);
            return { text, highlights };
        });
        const matching = lines.filter((line) => line.highlights.length > 0);
        return { entry: hit.entry.source, lines: (matching.length > 0 ? matching : lines).slice(0, shownLinesPerEntry) };
    });
    return { shown, matchCount: hits.length };
}
