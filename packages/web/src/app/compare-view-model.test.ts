import { noDescriptions } from "../engine-host/host-protocol.ts";
import type { EvaluationDiff, GearPiece } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { effectTextLines, gearDiffRowsOf, newlyEquippedIn, itemSetChangeRowsOf } from "./compare-view-model.ts";

const mace: GearPiece = { itemId: 4411, refine: 9, transcendence: 4, sockets: [null, 659, 1381] };

describe("gearDiffRowsOf", () => {
    it("shows a different item as one swap, without listing its sockets", () => {
        const after: GearPiece = { itemId: 5476, refine: 7, sockets: [661] };

        expect(gearDiffRowsOf({ slot: "rightHand", before: mace, after })).toEqual([
            { kind: "swapped", slot: "rightHand", before: mace, after },
        ]);
    });

    it("shows a piece put into an empty slot as equipped", () => {
        expect(gearDiffRowsOf({ slot: "shield", before: undefined, after: mace })[0]?.kind).toBe("equipped");
    });

    it("shows a slot that was emptied as unequipped", () => {
        expect(gearDiffRowsOf({ slot: "shield", before: mace, after: undefined })[0]?.kind).toBe("unequipped");
    });

    it("gives one line when the random options changed, and none when only their order did", () => {
        const attack = { optionId: 20, value: 100 };
        const speed = { optionId: 12, value: 7 };
        const before: GearPiece = { ...mace, randomOptions: [attack, speed] };

        expect(gearDiffRowsOf({ slot: "rightHand", before, after: { ...mace, randomOptions: [speed, attack] } })).toEqual([]);
        expect(gearDiffRowsOf({ slot: "rightHand", before, after: { ...mace, randomOptions: [attack] } })).toEqual([
            { kind: "randomOptionsChanged", slot: "rightHand", optionsBefore: [attack, speed], optionsAfter: [attack] },
        ]);
        expect(gearDiffRowsOf({ slot: "rightHand", before: mace, after: before })[0]).toMatchObject({ kind: "randomOptionsChanged", optionsBefore: [] });
    });

    it("gives the same item one line per thing that moved", () => {
        const after: GearPiece = { itemId: 4411, refine: 10, transcendence: 5, sockets: [46, 659] };

        expect(gearDiffRowsOf({ slot: "rightHand", before: mace, after })).toEqual([
            { kind: "refined", slot: "rightHand", itemId: 4411, before: 9, after: 10 },
            { kind: "transcended", slot: "rightHand", itemId: 4411, before: 4, after: 5 },
            { kind: "socketFilled", slot: "rightHand", socket: 1, before: null, after: 46 },
            { kind: "socketEmptied", slot: "rightHand", socket: 3, before: 1381, after: null },
        ]);
    });

    it("tells a replaced card from a filled socket", () => {
        const after: GearPiece = { ...mace, sockets: [null, 1262, 1381] };

        expect(gearDiffRowsOf({ slot: "rightHand", before: mace, after })).toEqual([
            { kind: "socketSwapped", slot: "rightHand", socket: 2, before: 659, after: 1262 },
        ]);
    });
});

describe("newlyEquippedIn", () => {
    it("names the new item with its cards, and cards put into kept items", () => {
        const diff = {
            gear: [
                { slot: "shield", before: undefined, after: { itemId: 4936, sockets: [1262, null] } },
                { slot: "rightHand", before: mace, after: { ...mace, sockets: [46, 659, 1381] } },
            ],
        } as unknown as EvaluationDiff;

        expect(newlyEquippedIn(diff)).toEqual({ itemIds: [4936], cardOrEnchantIds: [1262, 46] });
    });
});

describe("effectTextLines", () => {
    it("splits upstream effect text at its line-break tags", () => {
        expect(effectTextLines("ダメージ+1%。<BR>精錬値が10の時、+5%。")).toEqual(["ダメージ+1%。", "精錬値が10の時、+5%。"]);
    });

    it("gives no lines for an empty text", () => {
        expect(effectTextLines("")).toEqual([]);
    });
});

describe("itemSetChangeRowsOf", () => {
    it("names the sets side A completes alone, then those side B completes alone, after their members", () => {
        const descriptions = { ...noDescriptions, items: { 5483: { name: "アビスセイバーガーブ", effectText: "" } }, cardsOrEnchants: { 2098: { name: "極限の魔力", effectText: "" } } } as unknown as typeof noDescriptions;
        const abyssSet = { set: { kind: "item", id: 5486 }, members: [{ kind: "item", id: 5483 }, { kind: "cardOrEnchant", id: 2098 }], effects: ["物理・魔法攻撃命中時、一定確率で10秒間、1秒毎にSP + 10%"] } as const;
        const diff = { itemSets: { lost: [], gained: [abyssSet] } } as unknown as EvaluationDiff;

        expect(itemSetChangeRowsOf(diff, descriptions)).toEqual([
            { key: "gained:item:5486", change: "gained", name: "アビスセイバーガーブ + 極限の魔力", lines: ["物理・魔法攻撃命中時、一定確率で10秒間、1秒毎にSP + 10%"] },
        ]);
    });
});
