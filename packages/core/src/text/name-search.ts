import { readFile } from "node:fs/promises";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { loadTextSources } from "../engine-adapter/text-sources.ts";
import { type MatchKind, matchKinds, type PreparedEntry, prepareEntries, type ReadingSegment, type SearchableEntry, searchEntries } from "../search/forgiving-search.ts";
import { readingOf } from "./align-reading.ts";
import type { EnglishName } from "./english-names.ts";
import { type TextKind, textKinds } from "./text-kinds.ts";

/** One name found by a search across the kinds of things the engine knows. */
export interface NameSearchResult {
    readonly kind: TextKind;
    readonly id: number;
    readonly name: string;
    /** The whole name in kana, for a name with kanji. */
    readonly reading?: string;
    readonly english?: string;
    /** `false` for an English name the app put together and nobody checked. */
    readonly isEnglishConfirmed?: boolean;
    readonly match: MatchKind;
    /** How many letters off the query was, for a near miss. */
    readonly edits: number;
}

export interface NameSearchOptions {
    /** The kinds to look in. Every kind when left out. */
    readonly kinds?: readonly TextKind[];
    /** The most results to give. 20 when left out. */
    readonly limit?: number;
}

export interface NameSearch {
    search(query: string, options?: NameSearchOptions): NameSearchResult[];
}

const defaultLimit = 20;

interface NamedEntry extends SearchableEntry {
    readonly isEnglishConfirmed?: boolean;
}

const jsonAt = async <Content>(path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as Content;

/**
 * The search the app's pickers use, over every name the engine has: a word
 * may be part of the name, its reading, romaji, an English word or an alias,
 * give or take a typing mistake.
 */
export async function loadNameSearch(): Promise<NameSearch> {
    await loadRatorioEngine();
    const sources = await loadTextSources();
    const aliases = await jsonAt<Partial<Record<TextKind, Record<string, string[]>>>>("./aliases.json");
    const preparedOfKind = new Map<TextKind, PreparedEntry<NamedEntry>[]>();

    for (const kind of textKinds) {
        const readings = await jsonAt<Record<string, ReadingSegment[]>>(`./readings/${kind}.json`);
        const english = await jsonAt<Record<string, EnglishName>>(`./english/${kind}.json`);
        preparedOfKind.set(
            kind,
            prepareEntries(
                sources[kind].map(({ id, name }): NamedEntry => {
                    const reading = readings[String(id)];
                    const englishName = english[String(id)];
                    const allAliases = [...(aliases[kind]?.[String(id)] ?? []), ...(englishName?.aliases ?? [])];
                    return {
                        id,
                        name,
                        ...(reading === undefined ? {} : { reading }),
                        ...(englishName?.name === undefined ? {} : { english: englishName.name, isEnglishConfirmed: englishName.isConfirmed === true }),
                        ...(englishName?.parts === undefined ? {} : { englishParts: englishName.parts }),
                        ...(allAliases.length === 0 ? {} : { aliases: allAliases }),
                    };
                }),
            ),
        );
    }

    return {
        search(query, { kinds = textKinds, limit = defaultLimit } = {}) {
            if (query.trim() === "") {
                return [];
            }
            const results = kinds.flatMap((kind) =>
                searchEntries(preparedOfKind.get(kind) ?? [], query).hits.map(
                    (hit): NameSearchResult => ({
                        kind,
                        id: hit.entry.id,
                        name: hit.entry.name,
                        ...(hit.entry.reading === undefined ? {} : { reading: readingOf(hit.entry.reading) }),
                        ...(hit.entry.english === undefined ? {} : { english: hit.entry.english, isEnglishConfirmed: hit.entry.isEnglishConfirmed === true }),
                        match: hit.kind,
                        edits: hit.edits,
                    }),
                ),
            );
            // Each kind comes back best first; across kinds the better kind of match wins, then the order of the kinds.
            return results
                .map((result, index) => ({ result, index }))
                .sort((one, other) => matchKinds.indexOf(one.result.match) - matchKinds.indexOf(other.result.match) || one.result.edits - other.result.edits || one.index - other.index)
                .slice(0, Math.max(0, limit))
                .map(({ result }) => result);
        },
    };
}
