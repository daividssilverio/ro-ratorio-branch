import { describe, expect, it } from "vitest";
import { alignNameWithReading, alignWordReading, isWrittenInFull, joinPlainSegments, plainKanaOf, readingOf, readingsByPiece } from "./align-reading.ts";

describe("a word and its reading", () => {
    it("leaves kana at the ends of the word out of the reading", () => {
        expect(alignWordReading("讃え", "タタエ")).toEqual([["讃", "たた"], ["え"]]);
        expect(alignWordReading("お守り", "オマモリ")).toEqual([["お"], ["守", "まも"], ["り"]]);
        expect(alignWordReading("戦車", "センシャ")).toEqual([["戦車", "せんしゃ"]]);
    });

    it("gives kana and unread words no reading", () => {
        expect(alignWordReading("カード", "カード")).toEqual([["カード"]]);
        expect(alignWordReading("勁", "")).toEqual([["勁"]]);
    });

    it("joins neighbours that have no reading", () => {
        expect(joinPlainSegments([["の"], ["カード"], ["戦車", "せんしゃ"], ["の"], ["書", "しょ"]])).toEqual([["のカード"], ["戦車", "せんしゃ"], ["の"], ["書", "しょ"]]);
    });
});

describe("a name laid over a whole reading", () => {
    it("gives each run of kanji the stretch the kana of the name leave it", () => {
        expect(alignNameWithReading("魂のリング", "タマシイノリンク")?.segments).toEqual([["魂", "たましい"], ["のリング"]]);
        expect(alignNameWithReading("村正", "ムラマサ")?.segments).toEqual([["村正", "むらまさ"]]);
        expect(alignNameWithReading("ビギナー帽", "ヒキナアホウ")?.segments).toEqual([["ビギナー"], ["帽", "ほう"]]);
    });

    it("keeps a reading that is written in full as it is written", () => {
        expect(alignNameWithReading("傲慢のヘルム", "ゴウマンノヘルム")?.segments).toEqual([["傲慢", "ごうまん"], ["のヘルム"]]);
        expect(isWrittenInFull("ゴウマンノヘルム")).toBe(true);
        expect(isWrittenInFull("タマシイノリンク")).toBe(false);
    });

    it("gives signs no reading and lets letters and digits be read out or left out", () => {
        expect(alignNameWithReading("時間のサークレット(天帝)", "シカンノサアクレツトテンテイ")?.segments).toEqual([["時間", "しかん"], ["のサークレット("], ["天帝", "てんてい"], [")"]]);
        expect(alignNameWithReading("攻城戦TEナイフ", "コウシヨウセンテイイナイフ")?.segments).toEqual([["攻城戦", "こうしようせん"], ["TEナイフ"]]);
    });

    it("divides a stretch between runs of kanji the way the words were already read, where that fits", () => {
        const byTokenizer = [["風", "かぜ"], ["魔", "ま"], ["手裏剣", "しゅりけん"], ["・"], ["乱", "らん"], ["華", "はな"]] as const;

        const aligned = alignNameWithReading("風魔手裏剣・乱華", "フウマシユリケンランカ", byTokenizer);

        // 手裏剣 and 乱 are read as the tokenizer read them, so they come back written in full; 風魔 and 華 as upstream wrote them.
        expect(aligned?.segments).toEqual([["風魔手裏剣", "ふうましゅりけん"], ["・"], ["乱華", "らんか"]]);
        expect(aligned?.hasUnconfirmedStretches).toBe(true);
        expect(alignNameWithReading("手裏剣", "シユリケン", [["手裏剣", "しゅりけん"]])).toEqual({ segments: [["手裏剣", "しゅりけん"]], hasUnconfirmedStretches: false });
        expect(readingsByPiece("風魔手裏剣・乱華", byTokenizer)).toEqual(["かぜましゅりけん", undefined, "らんはな"]);
    });

    it("refuses a reading that does not fit the name", () => {
        expect(alignNameWithReading("疾風のカタール", "ハヤテノ")).toBeUndefined();
        expect(alignNameWithReading("魂のリング", "コノリンク")).toBeDefined();
        expect(alignNameWithReading("魂のリング", "タマシイ")).toBeUndefined();
    });

    it("writes kana the plain way upstream's older readings do", () => {
        expect(plainKanaOf("げっこうけん")).toBe("ケツコウケン");
        expect(plainKanaOf("ブーツ +7")).toBe("フーツ");
        expect(readingOf([["戦車", "せんしゃ"], ["カード"]])).toBe("センシャカード");
    });
});
