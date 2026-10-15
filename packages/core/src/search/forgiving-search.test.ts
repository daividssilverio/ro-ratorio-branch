import { describe, expect, it } from "vitest";
import { findApproximately } from "./approximate.ts";
import { forgivenEdits, prepareEntries, type SearchableEntry, searchEntries } from "./forgiving-search.ts";
import { canonicalizeRomaji, foldText, romanizeKana } from "./kana.ts";

const diamondBoots = 4685;
const tankCard = 1234;
const armsCannon = 554;
const entries: SearchableEntry[] = [
    { id: 1, name: "ブーツ", english: "Boots" },
    {
        id: diamondBoots,
        name: "トゥーサイドダイヤモンドブーツ",
        english: "Two-Side Diamond Boots",
        englishParts: [
            ["トゥーサイド", "Two-Side"],
            ["ダイヤモンド", "Diamond"],
            ["ブーツ", "Boots"],
        ],
    },
    { id: 3, name: "ダイヤモンドリング", english: "Diamond Ring" },
    { id: tankCard, name: "戦車カード", reading: [["戦車", "せんしゃ"], ["カード"]], english: "Tank Card" },
    { id: armsCannon, name: "アームズキャノン", english: "Arms Cannon", aliases: ["AC"] },
    { id: 6, name: "アースクエイク", english: "Earthquake" },
    { id: 7, name: "精錬の書", reading: [["精錬", "せいれん"], ["の"], ["書", "しょ"]] },
    { id: 8, name: "メロンメイス", english: "Melon Mace" },
];
const prepared = prepareEntries(entries);
const idsFor = (query: string) => searchEntries(prepared, query).hits.map((hit) => hit.entry.id);

describe("what a user types and what it must find", () => {
    it.each([
        // A part of the name, anywhere in it: Japanese has no spaces.
        ["ブーツ", diamondBoots],
        // One typing mistake for a short word, two for a long one.
        ["daiyamond", diamondBoots],
        ["diamnd", diamondBoots],
        ["daimond", diamondBoots],
        // ダイヤ is also written ダイア.
        ["daiamondo", diamondBoots],
        ["ダイアモンド", diamondBoots],
        // Romaji in its several spellings of a long vowel and of shi, tsu and the like.
        ["buutsu", diamondBoots],
        ["butsu", diamondBoots],
        ["bu-tsu", diamondBoots],
        ["butu", diamondBoots],
        // Kana in any width, hiragana for katakana, with or without voicing marks.
        ["フーツ", diamondBoots],
        ["ﾌﾞｰﾂ", diamondBoots],
        ["ぶーつ", diamondBoots],
        // English words in any order.
        ["boots diamond", diamondBoots],
        ["buutsu dia", diamondBoots],
        // A name people use for it.
        ["AC", armsCannon],
        ["ac", armsCannon],
        // A kanji name through its reading.
        ["sensha", tankCard],
        ["せんしゃ", tankCard],
        ["センシャ", tankCard],
        ["戦車", tankCard],
        ["sensya", tankCard],
        // Its ID.
        ["#554", armsCannon],
    ])("%s finds entry %i", (query, expectedId) => {
        expect(idsFor(query)).toContain(expectedId);
    });

    it("finds nothing for something unrelated, and does not forgive mistakes in very short words", () => {
        expect(idsFor("zzzzzz")).toEqual([]);
        expect(idsFor("xy")).toEqual([]);
        expect(forgivenEdits(3)).toBe(0);
        expect(forgivenEdits(4)).toBe(1);
        expect(forgivenEdits(7)).toBe(1);
        expect(forgivenEdits(8)).toBe(2);
    });
});

describe("the order of what is found", () => {
    it("puts the exact name first, then names that start with it, then names that hold it, then near misses", () => {
        expect(idsFor("ブーツ")).toEqual([1, diamondBoots]);
        expect(idsFor("ダイヤモンド")).toEqual([3, diamondBoots]);
        expect(searchEntries(prepared, "ダイヤモンド").hits.map((hit) => hit.kind)).toEqual(["startsWith", "substring"]);
        expect(searchEntries(prepared, "ブーツ").hits.map((hit) => hit.kind)).toEqual(["exact", "substring"]);
        expect(searchEntries(prepared, "daimond").hits.every((hit) => hit.kind === "typo")).toBe(true);
    });

    it("raises boosted entries among equally good hits only", () => {
        const boosted = searchEntries(prepared, "ダイヤモンド", { boostOf: (entry) => (entry.id === diamondBoots ? 1 : 0) });
        const allBoosted = searchEntries(prepared, "", { boostOf: (entry) => (entry.id === 8 ? 1 : 0) });

        expect(boosted.hits.map((hit) => hit.entry.id)).toEqual([3, diamondBoots]);
        expect(allBoosted.hits[0]?.entry.id).toBe(8);
        expect(allBoosted.hits).toHaveLength(entries.length);
    });

    it("lists everything in the given order for an empty query", () => {
        expect(idsFor("")).toEqual(entries.map((entry) => entry.id));
        expect(idsFor("   ")).toEqual(entries.map((entry) => entry.id));
    });
});

describe("why something was found", () => {
    const hitFor = (query: string, id: number) => searchEntries(prepared, query).hits.find((hit) => hit.entry.id === id);
    const marked = (query: string, id: number) => {
        const hit = hitFor(query, id);
        return hit?.highlights.map(([start, end]) => hit.entry.name.slice(start, end));
    };

    it("marks the part of the name each word matched, whatever it was typed as", () => {
        expect(marked("ブーツ", diamondBoots)).toEqual(["ブーツ"]);
        expect(marked("ぶーつ", diamondBoots)).toEqual(["ブーツ"]);
        expect(marked("buutsu", diamondBoots)).toEqual(["ブーツ"]);
        expect(marked("buutsu dai", diamondBoots)).toEqual(["ダイ", "ブーツ"]);
        // An English word marks the part of the name it translates.
        expect(marked("boots dia", diamondBoots)).toEqual(["ダイヤモンド", "ブーツ"]);
        expect(marked("diamnd", diamondBoots)).toEqual(["ダイヤモンド"]);
        expect(marked("daiyamond", diamondBoots)).toEqual(["ダイヤモンド"]);
    });

    it("marks the whole kanji word a reading belongs to", () => {
        expect(marked("sensha", tankCard)).toEqual(["戦車"]);
        expect(marked("せんし", tankCard)).toEqual(["戦車"]);
        expect(marked("しゃかーど", tankCard)).toEqual(["戦車カード"]);
        expect(marked("seiren", 7)).toEqual(["精錬"]);
    });

    it("says what each word was read as and how far off it was", () => {
        const typo = hitFor("daimond", diamondBoots)?.terms[0];
        const romaji = hitFor("sensha", tankCard)?.terms[0];
        const alias = hitFor("ac", armsCannon)?.terms[0];

        expect(typo).toMatchObject({ kind: "typo", edits: 1 });
        expect(romaji).toMatchObject({ kind: "startsWith", edits: 0, matchedText: "romaji", matchedAs: "戦車" });
        expect(alias).toMatchObject({ kind: "exact", matchedText: "alias", matchedAs: "AC" });
        expect(searchEntries(prepared, "buutsu  dia").terms).toEqual(["buutsu", "dia"]);
    });
});

describe("the pieces", () => {
    it("folds kana of any width and voicing to one form, keeping where each character came from", () => {
        expect(foldText("ブーツ").key).toBe("フツ");
        expect(foldText("ﾌﾞｰﾂ").key).toBe("フツ");
        expect(foldText("ぶーつ").key).toBe("フツ");
        expect(foldText("カッター").key).toBe("カツタ");
        expect(foldText("Two-Side").key).toBe("twoside");
        expect(foldText("ブーツ").sourcePositions).toEqual([0, 2]);
    });

    it("writes kana in Latin letters and brings the spellings of one sound together", () => {
        expect(romanizeKana("ブーツ").romaji).toBe("buutsu");
        expect(romanizeKana("カッター").romaji).toBe("kattaa");
        expect(romanizeKana("せんしゃ").romaji).toBe("sensha");
        expect(romanizeKana("ダイヤモンド").romaji).toBe("daiyamondo");
        for (const spelling of ["buutsu", "butsu", "bu-tsu", "butu", "BUUTSU"]) {
            expect(canonicalizeRomaji(spelling).romaji).toBe("butu");
        }
        expect(canonicalizeRomaji("sensha").romaji).toBe(canonicalizeRomaji("sensya").romaji);
        expect(canonicalizeRomaji("jutsu").romaji).toBe(canonicalizeRomaji("zyutu").romaji);
        expect(canonicalizeRomaji("toukyou").romaji).toBe(canonicalizeRomaji("tokyo").romaji);
    });

    it("finds a word that is one mistake away: a letter missing, added, wrong, or two swapped", () => {
        expect(findApproximately("diamnd", "twosidediamondboots", 1)).toEqual({ start: 7, end: 14, edits: 1 });
        expect(findApproximately("diaamond", "diamond", 1)?.edits).toBe(1);
        expect(findApproximately("diemond", "diamond", 1)?.edits).toBe(1);
        expect(findApproximately("daimond", "diamond", 1)?.edits).toBe(1);
        expect(findApproximately("diamond", "twosidediamondboots", 1)).toEqual({ start: 7, end: 14, edits: 0 });
        expect(findApproximately("emerald", "diamond", 2)).toBeNull();
    });
});
