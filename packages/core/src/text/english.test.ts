import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { loadTextSources, type TextKind, textKinds, type TextSource } from "../engine-adapter/text-sources.ts";
import { type EnglishGlossary, type EnglishName, englishNamesOf } from "./english-names.ts";

const jsonAt = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as unknown;
const englishOfKind = (kind: TextKind) => jsonAt(`./english/${kind}.json`) as Record<string, EnglishName>;

describe("the English names of upstream's names", () => {
    let sources: Record<TextKind, TextSource[]>;
    const glossary = jsonAt("./english-glossary.json") as EnglishGlossary;
    const checkedNames = jsonAt("./english-overrides.json") as Partial<Record<TextKind, Record<string, string>>>;

    beforeAll(async () => {
        await loadRatorioEngine();
        sources = await loadTextSources();
    });

    // Run `pnpm text-index` after an upstream bump or a change to the glossary or the checked names.
    it.each(textKinds)("are current for every %s", (kind) => {
        expect(englishOfKind(kind)).toEqual(englishNamesOf(sources[kind], glossary, checkedNames[kind] ?? {}));
    });

    it("cut each name into parts that make up the name", () => {
        for (const kind of textKinds) {
            const nameOfId = new Map(sources[kind].map((source) => [String(source.id), source.name]));
            for (const [id, englishName] of Object.entries(englishOfKind(kind))) {
                if (englishName.parts !== undefined) {
                    expect(englishName.parts.map(([nameText]) => nameText).join("")).toBe(nameOfId.get(id));
                }
            }
        }
    });

    it("give a skill the name of its identifier, a checked name where there is one, and the game's code to search by", () => {
        const skills = englishOfKind("skill");

        expect(skills["554"]).toMatchObject({ name: "Arms Cannon", isConfirmed: true, aliases: ["NC_ARMSCANNON"] });
        expect(skills["0"]?.isConfirmed).toBeUndefined();
        expect(Object.values(englishOfKind("job")).every((job) => job.isConfirmed === true)).toBe(true);
    });

    it("only checks names of things upstream has", () => {
        for (const kind of textKinds) {
            const ids = new Set(sources[kind].map((source) => String(source.id)));
            expect(Object.keys(checkedNames[kind] ?? {}).filter((id) => !ids.has(id))).toEqual([]);
        }
    });
});
