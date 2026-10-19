import { describe, expect, it } from "vitest";
import { namePartsOf, preparePickerEntries, rowsMatching, searchPicker } from "./picker-model.ts";

const entries = [
    { id: 1, name: "トゥーサイドダイヤモンドブーツ" },
    { id: 2, name: "パワードウィング" },
    { id: 3, name: "Awakened Bloom [2]" },
    { id: 40, name: "ダイヤモンド シールド" },
    { id: 50, name: "戦車カード", detail: "ASPD+100%" },
    { id: 554, name: "アームズキャノン" },
];
const readings = { "50": [["戦車", "せんしゃ"], ["カード"]] } as const;
const english = {
    "1": { name: "Two-Side Diamond Boots", parts: [["トゥーサイド", "Two-Side"], ["ダイヤモンド", "Diamond"], ["ブーツ", "Boots"]] },
    "554": { name: "Arms Cannon", isConfirmed: true, aliases: ["NC_ARMSCANNON"] },
} as const;
const prepared = preparePickerEntries(entries, "skill", { readings, english });
const search = (query: string, shownLimit = 10) => searchPicker(prepared, query, shownLimit);
const idsOf = (query: string) => search(query).shown.map((hit) => hit.entry.id);

describe("searchPicker", () => {
    it("lists everything in the list's order for an empty query", () => {
        expect(idsOf("  ")).toEqual([1, 2, 3, 40, 50, 554]);
        expect(search("").notice).toBeNull();
    });

    it.each([
        { situation: "hiragana typed for a katakana name", query: "ぶーつ", ids: [1] },
        { situation: "another case", query: "BLOOM", ids: [3] },
        { situation: "a part in the middle, the name that starts with it first", query: "ダイヤ", ids: [40, 1] },
        { situation: "two words in any order, both required", query: "しーるど ダイヤ", ids: [40] },
        { situation: "an ID", query: "#40", ids: [40] },
        { situation: "the reading of its kanji", query: "せんしゃ", ids: [50] },
        { situation: "romaji", query: "sensha", ids: [50] },
        { situation: "what it does", query: "aspd", ids: [50] },
        { situation: "an alias of its kind", query: "AC", ids: [554] },
        { situation: "a typing mistake", query: "daimond", ids: [40, 1] },
        { situation: "English words in any order", query: "boots diamond", ids: [1] },
        { situation: "the code the game has for it", query: "nc_armscannon", ids: [554] },
        { situation: "a word nothing has", query: "ぽりん", ids: [] },
    ])("finds by $situation", ({ query, ids }) => {
        expect(idsOf(query)).toEqual(ids);
    });

    it("hands back the entry it was given", () => {
        expect(search("#50").shown[0]?.entry.source).toBe(entries[4]);
    });

    it("shows no more than the limit but counts every match", () => {
        const limited = search("", 2);

        expect(limited.shown.map((hit) => hit.entry.id)).toEqual([1, 2]);
        expect(limited.matchCount).toBe(6);
    });

    it("says what a word was read as when it was not found in the name as typed", () => {
        expect(search("sensha").notice).toEqual({ kind: "readAs", readings: [{ term: "sensha", matchedAs: "戦車" }] });
        expect(search("戦車").notice).toBeNull();
    });

    it("says when the results are only near misses", () => {
        const notice = search("daimond").notice;

        expect(notice?.kind).toBe("nearMatchesOnly");
        expect(notice).toMatchObject({ term: "daimond", edits: 1 });
    });

    it("puts what the caller boosts first among equal matches", () => {
        const boosted = searchPicker(prepared, "ダイヤモンド", 10, (entry) => (entry.id === 1 ? 1 : 0));

        expect(boosted.shown.map((hit) => hit.entry.id)).toEqual([40, 1]);
        expect(searchPicker(prepared, "", 10, (entry) => (entry.id === 554 ? 1 : 0)).shown[0]?.entry.id).toBe(554);
    });

    it("finds an entry by the text of another ID when it names one", () => {
        const attackRows = preparePickerEntries([{ id: 0, textId: 554, name: "アームズキャノン" }], "skill", null);

        expect(searchPicker(attackRows, "ac", 10).shown.map((hit) => hit.entry.id)).toEqual([0]);
    });
});

describe("namePartsOf", () => {
    it("gives the name as one part when nothing is marked and no reading is known", () => {
        expect(namePartsOf("ブーツ", undefined, [])).toEqual([{ text: "ブーツ", isMarked: false }]);
    });

    it("cuts at the borders of what is marked", () => {
        expect(namePartsOf("ダイヤモンド シールド", undefined, [[0, 3]])).toEqual([
            { text: "ダイヤ", isMarked: true },
            { text: "モンド シールド", isMarked: false },
        ]);
    });

    it("keeps a word with a reading whole, and marks it when any of it is", () => {
        expect(namePartsOf("戦車カード", readings["50"], [[1, 3]])).toEqual([
            { text: "戦車", reading: "せんしゃ", isMarked: true },
            { text: "カ", isMarked: true },
            { text: "ード", isMarked: false },
        ]);
    });

    it("ignores a reading that is not of this name", () => {
        expect(namePartsOf("戦車", [["歩兵", "ほへい"]], [])).toEqual([{ text: "戦車", isMarked: false }]);
    });
});

describe("rowsMatching", () => {
    const rows = ["ブレッシング", "速度増加", "ダイヤモンドダスト", "Gloria"];

    it.each([
        { query: "", found: rows },
        { query: "ぶれっしんぐ", found: ["ブレッシング"] },
        { query: "glo", found: ["Gloria"] },
        { query: "daiyamondo", found: ["ダイヤモンドダスト"] },
        { query: "ない", found: [] },
    ])("keeps the rows that match '$query' in their own order", ({ query, found }) => {
        expect(rowsMatching(rows, (row) => row, query)).toEqual(found);
    });
});
