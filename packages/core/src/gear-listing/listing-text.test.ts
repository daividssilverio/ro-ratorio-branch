import { describe, expect, it } from "vitest";
import { characterSimilarity, effectFeaturesOf, linesOfListing, readItemLine, valueOfEffectLine } from "./listing-text.ts";

describe("linesOfListing", () => {
    it("gives the lines that say something, trimmed", () => {
        expect(linesOfListing("  + 7　錆びたアーム[3] \n\n ローラカード\r\nMaxHP+11%  ")).toEqual(["+ 7　錆びたアーム[3]", "ローラカード", "MaxHP+11%"]);
    });
});

describe("readItemLine", () => {
    it.each([
        { line: "+ 7　錆びたアーム[3]", item: { refine: 7, name: "錆びたアーム", socketCount: 3 } },
        { line: "＋１０ メロンメイス", item: { refine: 10, name: "メロンメイス", socketCount: null } },
        { line: "サバイバルロッド(INT) [0]", item: { refine: null, name: "サバイバルロッド(INT)", socketCount: 0 } },
        { line: "ストーンバックラー", item: { refine: null, name: "ストーンバックラー", socketCount: null } },
    ])("reads $line", ({ line, item }) => {
        expect(readItemLine(line)).toEqual(item);
    });
});

describe("valueOfEffectLine", () => {
    it.each([
        { line: "物理攻撃時、小型モンスターに与えるダメージ+90%", value: 90 },
        { line: "MaxHP + 11%", value: 11 },
        { line: "Atk＋３０", value: 30 },
        { line: "スキル後のディレイ7%減少", value: 7 },
        { line: "不死形のMDEFを 7% 無視", value: 7 },
        { line: "変動詠唱時間 - 5%", value: 5 },
        { line: "武器に聖属性を付与する", value: null },
        { line: "ローラカード", value: null },
    ])("finds $value in $line", ({ line, value }) => {
        expect(valueOfEffectLine(line)).toBe(value);
    });
});

describe("effectFeaturesOf", () => {
    it.each([
        { situation: "damage to a size, in the game's order and in the calculator's", wordings: ["物理攻撃時、小型モンスターに与えるダメージ+90%", "小型のモンスターに与える物理ダメージ + 90%"] },
        { situation: "damage to a race", wordings: ["魔法攻撃時、不死形モンスターに与えるダメージ + 7%", "魔法攻撃で、不死形モンスターに与えるダメージ + 7%"] },
        { situation: "a share of a stat, with and without spaces and width", wordings: ["MaxHP+11%", "ＭａｘＨＰ ＋ 11％"] },
        { situation: "a defense named in words or by its short name", wordings: ["不死形モンスターの魔法防御力を 7% 無視", "不死形のMDEFを 7% 無視"] },
        { situation: "fish by either name", wordings: ["魚貝形モンスターから受けるダメージ - 3%", "魚類形モンスターから受けるダメージ3%減少"] },
        { situation: "a delay that is lowered, however that is said", wordings: ["スキルディレイ - 7%", "スキル後のディレイ7%減少"] },
    ])("reads the same from $situation", ({ wordings }) => {
        const [first, ...others] = wordings.map(effectFeaturesOf);

        expect(first?.length).toBeGreaterThan(0);
        for (const other of others) {
            expect(other).toEqual(first);
        }
    });

    it.each([
        { situation: "physical and magical", one: "小型のモンスターに与える物理ダメージ + 7%", other: "小型のモンスターに与える魔法ダメージ + 7%" },
        { situation: "one size and another", one: "物理攻撃時、小型モンスターに与えるダメージ+90%", other: "物理攻撃時、中型モンスターに与えるダメージ+90%" },
        { situation: "dealt and taken", one: "小型モンスターに与える物理ダメージ + 7%", other: "小型モンスターから受けるダメージ - 7%" },
        { situation: "a share and a flat amount", one: "MaxHP + 11%", other: "MaxHP + 11" },
        { situation: "the undead race and the undead element", one: "不死形モンスターに与える物理ダメージ + 7%", other: "不死属性モンスターに与える物理ダメージ + 7%" },
        { situation: "an element's monsters and an element's attacks", one: "火属性モンスターから受けるダメージ - 7%", other: "火属性攻撃で受けるダメージ - 7%" },
        { situation: "Atk and Matk", one: "Atk + 30", other: "Matk + 30" },
        { situation: "Def and Mdef ignored", one: "不死形のDEFを 7% 無視", other: "不死形のMDEFを 7% 無視" },
        { situation: "bosses and the rest", one: "物理攻撃時、ボスモンスターに与えるダメージ + 7%", other: "物理攻撃時、一般モンスターに与えるダメージ + 7%" },
    ])("tells $situation apart", ({ one, other }) => {
        expect(effectFeaturesOf(one)).not.toEqual(effectFeaturesOf(other));
    });

    it("reads nothing from a name that is about no effect", () => {
        expect(effectFeaturesOf("ローラカード")).toEqual([]);
    });
});

describe("characterSimilarity", () => {
    it("is 1 for the same letters in another order and lower the less is shared", () => {
        expect(characterSimilarity("物理ダメージ", "ダメージ物理 + 7%")).toBe(1);
        expect(characterSimilarity("物理ダメージ", "魔法ダメージ")).toBeLessThan(1);
        expect(characterSimilarity("物理ダメージ", "魔法ダメージ")).toBeGreaterThan(characterSimilarity("物理ダメージ", "詠唱時間"));
        expect(characterSimilarity("", "")).toBe(0);
    });
});
