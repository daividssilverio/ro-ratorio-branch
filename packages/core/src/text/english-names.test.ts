import { describe, expect, it } from "vitest";
import { composeEnglishName, englishNameFromCode, englishNameOf, englishPartsOf } from "./english-names.ts";

const glossary = { ダイヤモンド: "Diamond", ブーツ: "Boots", トゥーサイド: "Two-Side", リング: "Ring", ミニ: "Mini", ポリン: "Poring", カード: "Card", 深淵: "Abyss", 騎士: "Knight", 剣: "Sword", 大剣: "Greatsword" };

describe("englishPartsOf", () => {
    it("cuts a name with no spaces at the words it knows", () => {
        expect(englishPartsOf("トゥーサイドダイヤモンドブーツ", glossary)).toEqual({
            parts: [
                ["トゥーサイド", "Two-Side"],
                ["ダイヤモンド", "Diamond"],
                ["ブーツ", "Boots"],
            ],
            coversWholeName: true,
        });
    });

    it("keeps what it does not know as a part without English, and says the name is not covered", () => {
        expect(englishPartsOf("スターダストブーツ", glossary)).toEqual({
            parts: [
                ["スターダスト", ""],
                ["ブーツ", "Boots"],
            ],
            coversWholeName: false,
        });
    });

    it("does not count digits, brackets and Latin letters as untranslated", () => {
        expect(englishPartsOf("ダイヤモンドリング[1]", glossary).coversWholeName).toBe(true);
    });

    it("takes the longer word where two could start", () => {
        expect(englishPartsOf("大剣", glossary).parts).toEqual([["大剣", "Greatsword"]]);
    });

    it("takes a short katakana word only where it stands alone", () => {
        expect(englishPartsOf("ミニポリン", glossary).parts).toEqual([
            ["ミニ", ""],
            ["ポリン", "Poring"],
        ]);
        expect(englishPartsOf("ミニ ポリン", glossary).parts).toEqual([
            ["ミニ", "Mini"],
            [" ", ""],
            ["ポリン", "Poring"],
        ]);
    });

    it("gives back the whole name when its parts are joined", () => {
        for (const name of ["トゥーサイドダイヤモンドブーツ", "ミニポリン(MVP)", "深淵の騎士カード", "abc"]) {
            expect(
                englishPartsOf(name, glossary)
                    .parts.map(([nameText]) => nameText)
                    .join(""),
            ).toBe(name);
        }
    });
});

describe("englishNameOf", () => {
    it.each([
        { name: "トゥーサイドダイヤモンドブーツ", english: "Two-Side Diamond Boots" },
        { name: "ダイヤモンドリング[1]", english: "Diamond Ring [1]" },
        { name: "ポリンカード（ハード）", english: undefined },
        { name: "深淵の騎士", english: "Abyss Knight" },
        { name: "深淵の騎士カード（ポリン）[2]", english: "Abyss Knight Card (Poring) [2]" },
        { name: "深淵の騎士の剣", english: "Abyss Knight Sword" },
        { name: "あの騎士", english: undefined },
        { name: "スターダストブーツ", english: undefined },
        { name: "Dex+1", english: undefined },
    ])("reads $name as $english", ({ name, english }) => {
        expect(englishNameOf(name, glossary).name).toBe(english);
    });

    it("keeps the parts in the order of the Japanese name", () => {
        expect(englishNameOf("深淵の騎士", glossary).parts).toEqual([
            ["深淵", "Abyss"],
            ["の", ""],
            ["騎士", "Knight"],
        ]);
    });
});

describe("composeEnglishName", () => {
    it("puts spaces between words and none inside brackets", () => {
        expect(
            composeEnglishName([
                ["ポリン", "Poring"],
                ["カード（", ""],
                ["x", ""],
                ["）", ""],
            ]),
        ).toBe("Poring カード (x)");
    });
});

describe("englishNameFromCode", () => {
    it.each([
        { code: "ARMS_CANNON", english: "Arms Cannon" },
        { code: "TELEPORT", english: "Teleport" },
        { code: "SEVERE_RAINSTORM_EX", english: "Severe Rainstorm Ex" },
    ])("reads $code as $english", ({ code, english }) => {
        expect(englishNameFromCode(code)).toBe(english);
    });
});
