import { describe, expect, it } from "vitest";
import type { Character } from "../build/build-format.ts";
import { applyChange } from "./apply-change.ts";
import type { Change } from "./tree-format.ts";
import { anotherWeaponItemId, maceItemId, mechanicBuild, refineMaceToTen } from "./tree-test-support.ts";

const character = mechanicBuild.character;

function characterAfter(change: Change, startingCharacter: Character = character): Character {
    const application = applyChange(startingCharacter, change);
    if (!application.applied) {
        throw new Error(`change did not apply: ${application.staleReason}`);
    }
    return application.character;
}

describe("applyChange on a gear piece", () => {
    it("sets the refine of the piece it was made for", () => {
        expect(characterAfter(refineMaceToTen).equipment.rightHand?.refine).toBe(10);
    });

    it("leaves the character it was given untouched", () => {
        const refineBefore = character.equipment.rightHand?.refine;

        characterAfter(refineMaceToTen);

        expect(character.equipment.rightHand?.refine).toBe(refineBefore);
    });

    it("is stale when the slot holds another item", () => {
        const change: Change = { ...refineMaceToTen, expectedItemId: anotherWeaponItemId };

        expect(applyChange(character, change)).toEqual({ applied: false, staleReason: "slotHoldsAnotherItem" });
    });

    it("is stale when the slot is empty", () => {
        const change: Change = { kind: "setRefine", slot: "leftHand", expectedItemId: maceItemId, refine: 10 };

        expect(applyChange(character, change)).toEqual({ applied: false, staleReason: "slotIsEmpty" });
    });

    it("sets transcendence", () => {
        const change: Change = { kind: "setTranscendence", slot: "rightHand", expectedItemId: maceItemId, transcendence: 5 };

        expect(characterAfter(change).equipment.rightHand?.transcendence).toBe(5);
    });

    it("fills a socket and keeps the others", () => {
        const change: Change = { kind: "setSocket", slot: "rightHand", expectedItemId: maceItemId, socket: 1, cardOrEnchantId: 46 };

        expect(characterAfter(change).equipment.rightHand?.sockets).toEqual([46, 659, 1381, 1297]);
    });

    it("pads with empty sockets up to the one it fills", () => {
        const change: Change = { kind: "setSocket", slot: "headMid", expectedItemId: 4444, socket: 3, cardOrEnchantId: 46 };

        expect(characterAfter(change).equipment.headMid?.sockets).toEqual([null, null, 46]);
    });

    it("drops trailing empty sockets after emptying one", () => {
        const change: Change = { kind: "setSocket", slot: "rightHand", expectedItemId: maceItemId, socket: 4, cardOrEnchantId: null };

        expect(characterAfter(change).equipment.rightHand?.sockets).toEqual([null, 659, 1381]);
    });

    it("replaces the piece in a slot", () => {
        const change: Change = { kind: "setGearPiece", slot: "rightHand", gearPiece: { itemId: anotherWeaponItemId } };

        expect(characterAfter(change).equipment.rightHand).toEqual({ itemId: anotherWeaponItemId });
    });

    it("empties a slot", () => {
        const change: Change = { kind: "setGearPiece", slot: "rightHand", gearPiece: null };

        expect(Object.hasOwn(characterAfter(change).equipment, "rightHand")).toBe(false);
    });
});

describe("applyChange on stats, skills and buffs", () => {
    it("sets a base stat", () => {
        expect(characterAfter({ kind: "setBaseStat", stat: "str", value: 120 }).baseStats.str).toBe(120);
    });

    it("sets a trait stat on a character that had none, the others at 0", () => {
        expect(characterAfter({ kind: "setTraitStat", stat: "pow", value: 10 }).traitStats).toEqual({
            pow: 10,
            sta: 0,
            wis: 0,
            spl: 0,
            con: 0,
            crt: 0,
        });
    });

    it("sets a learned skill level", () => {
        expect(characterAfter({ kind: "setLearnedSkill", skillId: 554, level: 3 }).learnedSkills?.["554"]).toBe(3);
    });

    it("removes a learned skill at level 0", () => {
        const withoutSkill = characterAfter({ kind: "setLearnedSkill", skillId: 554, level: 0 });

        expect(Object.hasOwn(withoutSkill.learnedSkills ?? {}, "554")).toBe(false);
    });

    it("activates a self-buff", () => {
        expect(characterAfter({ kind: "setSelfBuff", skillId: 739, level: 1 }).selfBuffs).toEqual({ "739": 1 });
    });

    it("removes a support buff at value 0", () => {
        const withoutBuff = characterAfter({ kind: "setSupportBuff", name: "ADRENALINE_RUSH", value: 0 });

        expect(withoutBuff.supportBuffs).toEqual({});
    });
});
