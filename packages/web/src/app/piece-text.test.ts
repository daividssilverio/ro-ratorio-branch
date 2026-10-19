import { describe, expect, it } from "vitest";
import { noDescriptions } from "../engine-host/host-protocol.ts";
import { pieceTextIn } from "./piece-text.ts";

const descriptions = {
    ...noDescriptions,
    items: { 4411: { name: "メロンメイス" } },
    cardsOrEnchants: { 1262: { name: "戦車のカード" }, 1297: { name: "覇王 (+9以上)" } },
    randomOptionNames: { 20: "Atk+" },
} as unknown as typeof noDescriptions;

describe("pieceTextIn", () => {
    it("writes the transcendence, the item with its refine, then the filled sockets and the options, one per line", () => {
        const text = pieceTextIn(descriptions, { itemId: 4411, refine: 9, transcendence: 2, sockets: [1262, null, null, 1297], randomOptions: [{ optionId: 20, value: 30 }, null] });

        expect(text.split("\n")).toEqual(["超越段階 ★2", "+9 メロンメイス", "戦車のカード", "覇王 (+9以上)", "Atk+ 30"]);
    });

    it("writes only the item for a bare piece", () => {
        expect(pieceTextIn(descriptions, { itemId: 4411 })).toBe("メロンメイス");
    });
});
