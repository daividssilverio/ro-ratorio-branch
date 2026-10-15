import type { EnglishGlossary, EnglishName, ReadingSegment, TextKind } from "@ro-ratorio-branch/core/platform-neutral";
import aliasesOfKind from "@ro-ratorio-branch/core/text/aliases.json" with { type: "json" };
import { useEffect, useState } from "react";

/** How the kanji in the names of one kind are read, by ID. A name without kanji has no entry. */
export type Readings = Readonly<Record<string, readonly ReadingSegment[]>>;
/** What is known in English of the names of one kind, by ID. */
export type EnglishNames = Readonly<Record<string, EnglishName>>;

type FileOf<Content> = { readonly default: Content };
type ReadingsFile = FileOf<Record<string, (string | undefined)[][]>>;
type EnglishFile = FileOf<Record<string, object>>;

// One file per kind, fetched the first time a list of that kind is opened.
const readingFiles: Readonly<Record<TextKind, () => Promise<ReadingsFile>>> = {
    item: () => import("@ro-ratorio-branch/core/text/readings/item.json"),
    cardOrEnchant: () => import("@ro-ratorio-branch/core/text/readings/cardOrEnchant.json"),
    monster: () => import("@ro-ratorio-branch/core/text/readings/monster.json"),
    skill: () => import("@ro-ratorio-branch/core/text/readings/skill.json"),
    job: () => import("@ro-ratorio-branch/core/text/readings/job.json"),
    timedItem: () => import("@ro-ratorio-branch/core/text/readings/timedItem.json"),
};
const englishFiles: Readonly<Record<TextKind, () => Promise<EnglishFile>>> = {
    item: () => import("@ro-ratorio-branch/core/text/english/item.json"),
    cardOrEnchant: () => import("@ro-ratorio-branch/core/text/english/cardOrEnchant.json"),
    monster: () => import("@ro-ratorio-branch/core/text/english/monster.json"),
    skill: () => import("@ro-ratorio-branch/core/text/english/skill.json"),
    job: () => import("@ro-ratorio-branch/core/text/english/job.json"),
    timedItem: () => import("@ro-ratorio-branch/core/text/english/timedItem.json"),
};

/** The text of the names of one kind beyond the names themselves. Search and display work without it while it loads. */
export interface TextOfKind {
    readonly readings: Readings;
    readonly english: EnglishNames;
}

const loading = new Map<TextKind, Promise<TextOfKind>>();
const loaded = new Map<TextKind, TextOfKind>();

export function loadTextOfKind(kind: TextKind): Promise<TextOfKind> {
    let text = loading.get(kind);
    if (text === undefined) {
        const contentOf = <Content,>(file: Promise<FileOf<unknown>>): Promise<Content> => file.then((module) => module.default as Content).catch(() => ({}) as Content);
        text = Promise.all([contentOf<Readings>(readingFiles[kind]()), contentOf<EnglishNames>(englishFiles[kind]())]).then(([readings, english]) => ({ readings, english }));
        void text.then((result) => loaded.set(kind, result));
        loading.set(kind, text);
    }
    return text;
}

/** The readings and English names of a kind of name. `null` while they load, and for no kind. */
export function useTextOfKind(kind: TextKind | null): TextOfKind | null {
    const [, setLoadedCount] = useState(0);

    useEffect(() => {
        if (kind === null || loaded.has(kind)) {
            return;
        }
        let isCurrent = true;
        void loadTextOfKind(kind).then(() => {
            if (isCurrent) {
                setLoadedCount((count) => count + 1);
            }
        });
        return () => {
            isCurrent = false;
        };
    }, [kind]);

    return kind === null ? null : (loaded.get(kind) ?? null);
}

/** The Japanese words of effect text and their English, to find effects by: the words of names and the words only effects use. */
export function loadEffectWords(): Promise<EnglishGlossary> {
    effectWords ??= Promise.all([import("@ro-ratorio-branch/core/text/english-glossary.json"), import("@ro-ratorio-branch/core/text/english-effect-words.json")])
        .then(([names, effects]): EnglishGlossary => ({ ...names.default, ...effects.default }))
        .catch((): EnglishGlossary => ({}));
    return effectWords;
}
let effectWords: Promise<EnglishGlossary> | undefined;

/** `null` while the words load, and while they are not asked for. */
export function useEffectWords(isAsked: boolean): EnglishGlossary | null {
    const [words, setWords] = useState<EnglishGlossary | null>(null);

    useEffect(() => {
        if (!isAsked) {
            return;
        }
        let isCurrent = true;
        void loadEffectWords().then((loadedWords) => {
            if (isCurrent) {
                setWords(loadedWords);
            }
        });
        return () => {
            isCurrent = false;
        };
    }, [isAsked]);

    return words;
}

/** Other names people use for something, by kind and ID. */
export function aliasesOf(kind: TextKind | null, id: number): readonly string[] {
    const ofKind = kind === null ? undefined : (aliasesOfKind as Readonly<Partial<Record<TextKind, Readonly<Record<string, readonly string[]>>>>>)[kind];
    return ofKind?.[String(id)] ?? [];
}
