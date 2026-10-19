import { describe, expect, it } from "vitest";
import type { Build } from "./build-format.ts";
import { buildWearingItem, buildWithSocketFilled } from "./wear-item.ts";

const build: Build = {
    formatVersion: 1,
    character: {
        jobId: 51,
        baseLevel: 200,
        jobLevel: 70,
        baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
        equipment: { rightHand: { itemId: 4411, refine: 10, transcendence: 2, sockets: [1262, null] }, accessory1: { itemId: 9, refine: 3 } },
    },
    scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 100 },
};

describe("buildWearingItem", () => {
    it("keeps the refine and transcendence of the piece it replaces and drops its cards", () => {
        expect(buildWearingItem(build, "rightHand", 4400).character.equipment.rightHand).toEqual({ itemId: 4400, refine: 10, transcendence: 2 });
    });

    it("gives no refine to a slot that takes none, and fills an empty slot", () => {
        expect(buildWearingItem(build, "accessory1", 10).character.equipment.accessory1).toEqual({ itemId: 10 });
        expect(buildWearingItem(build, "shoes", 20).character.equipment.shoes).toEqual({ itemId: 20 });
    });

    it("leaves the given build as it was", () => {
        buildWearingItem(build, "rightHand", 4400);

        expect(build.character.equipment.rightHand?.itemId).toBe(4411);
    });
});

describe("buildWithSocketFilled", () => {
    it("fills the socket and keeps the others", () => {
        expect(buildWithSocketFilled(build, "rightHand", 1, 337)?.character.equipment.rightHand?.sockets).toEqual([1262, 337]);
        expect(buildWithSocketFilled(build, "rightHand", 3, 337)?.character.equipment.rightHand?.sockets).toEqual([1262, null, null, 337]);
        expect(buildWithSocketFilled(build, "accessory1", 0, 337)?.character.equipment.accessory1).toEqual({ itemId: 9, refine: 3, sockets: [337] });
    });

    it("empties the socket for no card", () => {
        expect(buildWithSocketFilled(build, "rightHand", 0, null)?.character.equipment.rightHand?.sockets).toEqual([null, null]);
    });

    it("has nothing to fill where nothing is worn", () => {
        expect(buildWithSocketFilled(build, "shoes", 0, 337)).toBeNull();
    });
});
