import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { loadTextSources, type TextKind, textKinds, type TextSource } from "../engine-adapter/text-sources.ts";
import type { ReadingSegment } from "../search/forgiving-search.ts";

const readingsOfKind = (kind: TextKind) => JSON.parse(readFileSync(new URL(`./readings/${kind}.json`, import.meta.url), "utf8")) as Record<string, ReadingSegment[]>;
const hasKanji = (text: string) => /[一-鿿々〆]/.test(text);

describe("the readings of upstream's names", () => {
    let sources: Record<TextKind, TextSource[]>;

    beforeAll(async () => {
        await loadRatorioEngine();
        sources = await loadTextSources();
    });

    it.each(textKinds)("has a reading for every %s name with kanji, whose pieces make up the name", (kind) => {
        const readings = readingsOfKind(kind);
        const namesWithKanji = sources[kind].filter((source) => hasKanji(source.name));
        const stale = namesWithKanji.filter((source) => (readings[String(source.id)] ?? []).map(([text]) => text).join("") !== source.name);

        // Run `pnpm text-index` after an upstream bump: these names are new or have changed.
        expect(stale.map((source) => source.id)).toEqual([]);
        expect(Object.keys(readings)).toHaveLength(namesWithKanji.length);
    });

    it("reads names with kanji in kana only, and leaves kana unread", () => {
        for (const kind of textKinds) {
            for (const segments of Object.values(readingsOfKind(kind))) {
                for (const [text, reading] of segments) {
                    expect(reading === undefined || /^[ぁ-ゖー]+$/.test(reading)).toBe(true);
                    expect(reading !== undefined && !hasKanji(text) && /^[ぁ-ゖァ-ヺー]+$/.test(text)).toBe(false);
                }
            }
        }
    });

    it("knows names of each kind, with upstream's own code for skills and jobs", () => {
        expect(textKinds.map((kind) => sources[kind].length > 50)).toEqual([true, true, true, true, true, true]);
        expect(sources.skill.find((skill) => skill.id === 554)).toEqual({ id: 554, name: expect.any(String) as string, code: "ARMS_CANNON", gameCode: "NC_ARMSCANNON" });
        expect(sources.item.find((item) => item.id === 4411)?.sortKey).toBeDefined();
    });
});
