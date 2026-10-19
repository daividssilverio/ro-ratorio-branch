import { describe, expect, it } from "vitest";
import { prepareEffects, searchEffects } from "./effect-search.ts";

describe("searchEffects", () => {
    const withEffects = prepareEffects([
        { id: 1, name: "メイス", effects: ["物理攻撃で与えるダメージ + 10%", "精錬値が7以上の時、全ての種族のDEFを + 50% 無視"] },
        { id: 2, name: "ローブ", effects: ["MDEF + 5", "VIT + 10", "詠唱が中断されない"] },
        { id: 3, name: "指輪", effects: ["必中攻撃 + 25%", "物理攻撃で与えるダメージ + 2%", "MaxHP + 15%", "MaxSP + 15%"] },
        { id: 4, name: "効果なし" },
    ]);
    const found = (query: string) => searchEffects(withEffects, query, 10, 2);

    it.each([
        { situation: "a word of an effect", query: "詠唱", ids: [2] },
        { situation: "hiragana for a katakana word", query: "だめーじ", ids: [1, 3] },
        { situation: "Latin letters in any case", query: "mdef", ids: [1, 2] },
        { situation: "two words in different lines, both required", query: "必中 maxhp", ids: [3] },
        { situation: "a word no effect has", query: "ぽりん", ids: [] },
    ])("finds entries by $situation", ({ query, ids }) => {
        expect(found(query).shown.map((hit) => hit.entry.id).sort()).toEqual(ids);
    });

    it("finds an effect by the English of the words a glossary knows, and marks the Japanese", () => {
        const withWords = prepareEffects([{ id: 1, name: "メイス", effects: ["MDEF + 5", "物理攻撃で与えるダメージ + 10%"] }], { 物理攻撃: "Physical Attack", ダメージ: "Damage" });
        const [hit] = searchEffects(withWords, "damage physical", 10, 2).shown;

        expect(hit?.lines).toEqual([
            {
                text: "物理攻撃で与えるダメージ + 10%",
                highlights: [
                    [0, 4],
                    [8, 12],
                ],
            },
        ]);
    });

    it("shows the lines the words were found in, with the place marked", () => {
        const [hit] = found("詠唱").shown;

        expect(hit?.lines).toEqual([{ text: "詠唱が中断されない", highlights: [[0, 2]] }]);
    });

    it("lists every entry with its first lines when nothing is asked", () => {
        const everything = found("");

        expect(everything.matchCount).toBe(4);
        expect(everything.shown.map((hit) => hit.lines.length)).toEqual([2, 2, 2, 0]);
        expect(everything.shown[0]?.lines.every((line) => line.highlights.length === 0)).toBe(true);
    });
});
