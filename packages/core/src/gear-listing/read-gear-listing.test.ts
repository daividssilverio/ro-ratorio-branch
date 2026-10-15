import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { EngineCatalog } from "../engine-adapter/engine-catalog.ts";
import { listingsFromTheOfficialTool } from "./listings-from-the-official-tool.ts";
import { readGearListing } from "./read-gear-listing.ts";

const rustyArmItemId = 2498;
const laurellCardId = 1010;
const holyElementId = 6;
const listingFromTheOfficialTool = `+ 7　錆びたアーム[3]
ローラカード
武器に聖属性を付与する
物理攻撃時、小型モンスターに与えるダメージ+90%
物理攻撃時、中型モンスターに与えるダメージ+105%
魔法攻撃時、大型モンスターに与えるダメージ+60%
MaxHP+11%`;

describe("readGearListing", () => {
    let catalog: EngineCatalog;
    const optionIdNamed = (name: string) => {
        const option = catalog.randomOptionsOfItem(rustyArmItemId)[0]?.find((choice) => choice.name === name);
        if (option === undefined) {
            throw new Error(`the item rolls no option named ${name}`);
        }
        return option.id;
    };

    beforeAll(async () => {
        catalog = (await loadRatorioEngine()).catalog;
    });

    it("reads a listing as the official tool shows it into the item, its refine, its card and its options", () => {
        const listing = readGearListing(listingFromTheOfficialTool, catalog);

        expect(listing.gearPiece).toEqual({
            itemId: rustyArmItemId,
            refine: 7,
            element: holyElementId,
            sockets: [laurellCardId],
            randomOptions: [
                { optionId: optionIdNamed("物理UP－サイズ(小)"), value: 90 },
                { optionId: optionIdNamed("物理UP－サイズ(中)"), value: 105 },
                { optionId: optionIdNamed("魔法UP－サイズ(大)"), value: 60 },
                { optionId: optionIdNamed("MaxHP％"), value: 11 },
            ],
        });
        expect(listing.lines.map((line) => line.reading.kind)).toEqual(["item", "cardOrEnchant", "weaponElement", "randomOption", "randomOption", "randomOption", "randomOption"]);
        expect(listing.lines[2]?.reading).toMatchObject({ kind: "weaponElement", elementId: holyElementId });
        expect(readGearListing("錆びたアーム\nMaxHP+11%", catalog).gearPiece?.element).toBeUndefined();
    });

    it.each(listingsFromTheOfficialTool.map((example) => [example.text.split("\n").find((line) => !line.startsWith("超越")) ?? "", example] as const))("reads every line of %s", (_itemLine, example) => {
        const listing = readGearListing(example.text, catalog);
        const read = listing.lines.flatMap((line) => (line.reading.kind === "cardOrEnchant" ? [line.reading] : []));
        const expectedNames = (example.cardOrEnchantNames ?? []).map((name) => name.normalize("NFKC"));

        expect(listing.lines.filter((line) => line.reading.kind === "notUnderstood").map((line) => line.text)).toEqual([]);
        expect(listing.gearPiece).toMatchObject({ itemId: example.itemId });
        expect(listing.gearPiece?.refine).toBe(example.refine);
        expect(listing.gearPiece?.transcendence).toBe(example.transcendence);
        expect(read.filter((reading) => !expectedNames.some((name) => reading.name.startsWith(name))).map((reading) => reading.cardOrEnchantId).sort()).toEqual([...example.cardOrEnchantIds].sort());
        expect(read.filter((reading) => expectedNames.some((name) => reading.name.startsWith(name)))).toHaveLength(expectedNames.length);
        expect(new Set(read.map((reading) => reading.socketIndex)).size).toBe(read.length);
        expect(listing.gearPiece?.randomOptions).toEqual(example.randomOptions);
        expect(listing.gearPiece?.element).toBe(example.element);
    });

    it("places an enchant that only one socket takes there, whatever order the listing names it in", () => {
        const enchantOfTheLastSocketLast = readGearListing("+ 10　ガーディアンオブアビス[1]\n極限の魔力\n暴走した魔力\n悠遠なる天上の都", catalog);

        expect(enchantOfTheLastSocketLast.lines.map((line) => line.reading.kind)).toEqual(["item", "cardOrEnchant", "cardOrEnchant", "cardOrEnchant"]);
    });

    it("keeps an element on a weapon only, and says so for armor that has no mark for it", () => {
        expect(readGearListing("+ 10　ガーディアンオブアビス[1]\n武器に聖属性を付与する", catalog).lines[1]?.reading).toEqual({ kind: "notUnderstood", reason: "elementOnNonWeapon" });
        expect(readGearListing("+ 10　勇者のプレート[1]\n鎧に無属性を付与する", catalog).gearPiece?.element).toBeUndefined();
    });

    it.each([
        { item: "a weapon", itemId: rustyArmItemId },
        { item: "shadow armor", itemId: 5649 },
    ])("recognises every option $item rolls by upstream's own wording of it", ({ itemId }) => {
        const options = [...new Map(catalog.randomOptionsOfItem(itemId).flat().map((option) => [option.id, option])).values()];
        const misread = options.filter((option) => {
            const value = Math.max(option.range?.lowest ?? 1, Math.min(7, option.range?.highest ?? 7));
            const [line] = readGearListing(catalog.wordingOfRandomOption(option.id, value), catalog, { itemId }).lines;
            return !(line?.reading.kind === "randomOption" && line.reading.optionId === option.id && line.reading.value === value);
        });

        expect(options.length).toBeGreaterThan(1);
        expect(misread.map((option) => option.name)).toEqual([]);
    });

    it.each([
        { line: "Atk + 30", option: "Atk+" },
        { line: "Matk＋３０", option: "Matk+" },
        { line: "物理攻撃時、ボスモンスターに与えるダメージ + 10%", option: "物理UP－敵級(ボス)" },
        { line: "魔法攻撃時、悪魔形モンスターに与えるダメージ + 10%", option: "魔法UP－種族(悪魔)" },
        { line: "物理攻撃時、火属性モンスターに与えるダメージ + 10%", option: "物理UP－敵属性(火)" },
        { line: "遠距離物理攻撃で与えるダメージ + 10%", option: "遠距離ダメージ％" },
        { line: "クリティカル攻撃で与えるダメージ + 10%", option: "クリティカルダメージ％" },
        { line: "攻撃速度 + 10%", option: "ASPD％" },
        { line: "STR + 5", option: "STR+" },
        { line: "物理攻撃時、人間形モンスターに与えるダメージ+35%（プレイヤーには発動しない）", option: "物理UP－種族(人間)" },
    ])("reads '$line' in the game's words as $option", ({ line, option }) => {
        const [read] = readGearListing(line, catalog, { itemId: rustyArmItemId }).lines;

        expect(read?.reading).toMatchObject({ kind: "randomOption", optionId: optionIdNamed(option) });
    });

    it("fills the positions in the order of the lines, and says when there is no room left", () => {
        const sixOptions = Array.from({ length: 6 }, (_unused, index) => `STR + ${index + 1}`).join("\n");
        const listing = readGearListing(sixOptions, catalog, { itemId: rustyArmItemId });

        expect(listing.gearPiece?.randomOptions?.map((option) => option?.value)).toEqual([1, 2, 3, 4, 5]);
        expect(listing.lines.at(-1)?.reading).toEqual({ kind: "notUnderstood", reason: "noRoomLeft" });
    });

    it("says when the item does not roll an option that high", () => {
        expect(readGearListing("STR + 999", catalog, { itemId: rustyArmItemId }).lines[0]?.reading).toEqual({ kind: "notUnderstood", reason: "valueNotOffered" });
    });

    it("takes the text for a piece that is already chosen without an item line, and refuses another item's", () => {
        const withoutItemLine = readGearListing("ローラカード\nMaxHP+11%", catalog, { itemId: rustyArmItemId });
        const ofAnotherItem = readGearListing("+9 メロンメイス\nMaxHP+11%", catalog, { itemId: rustyArmItemId });

        expect(withoutItemLine.gearPiece).toMatchObject({ itemId: rustyArmItemId, sockets: [laurellCardId] });
        expect(withoutItemLine.gearPiece?.refine).toBeUndefined();
        expect(ofAnotherItem.lines[0]?.reading).toEqual({ kind: "notUnderstood", reason: "anotherItem" });
    });

    it("has no piece for an item the engine does not have, and says so on the first line", () => {
        const listing = readGearListing("+7 存在しない装備[3]\nMaxHP+11%", catalog);

        expect(listing.gearPiece).toBeNull();
        expect(listing.lines.map((line) => line.reading)).toEqual([
            { kind: "notUnderstood", reason: "unknownItem" },
            { kind: "notUnderstood", reason: "unknownItem" },
        ]);
    });

    it("says what it could not place on a line of its own", () => {
        const listing = readGearListing("錆びたアーム\nなにかよくわからない効果\nポリンカード", catalog);

        expect(listing.gearPiece).toEqual({ itemId: rustyArmItemId });
        expect(listing.lines.slice(1).map((line) => line.reading)).toEqual([
            { kind: "notUnderstood", reason: "unknownEffect" },
            expect.objectContaining({ kind: expect.stringMatching(/cardOrEnchant|notUnderstood/) }),
        ]);
    });
});
