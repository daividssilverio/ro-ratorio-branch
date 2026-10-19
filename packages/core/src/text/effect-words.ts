import { readFile } from "node:fs/promises";
import type { EnglishGlossary } from "./english-names.ts";

const glossaryAt = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as EnglishGlossary;

/** The English of the words in effect text, which the app's search by effect also uses. */
export async function loadEffectWords(): Promise<EnglishGlossary> {
    const [nameWords, effectWords] = await Promise.all([glossaryAt("./english-glossary.json"), glossaryAt("./english-effect-words.json")]);
    return { ...nameWords, ...effectWords };
}
