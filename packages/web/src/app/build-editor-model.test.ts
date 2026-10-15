import { addCharacterToWorkspace, emptyWorkspace, equipmentSlots, parseBuild } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { blankCharacter, equipmentRowsOf } from "./build-editor-model.ts";

describe("blankCharacter", () => {
    it("is a valid character of the job with nothing allocated or equipped", () => {
        const character = blankCharacter(51);

        expect(character).toEqual({ jobId: 51, baseLevel: 1, jobLevel: 1, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment: {} });
        expect(parseBuild({ formatVersion: 1, character, scenario: { skillId: 0, skillLevel: 1, targetMonsterId: 0 } }).character).toEqual(character);
        expect(blankCharacter(74, 200).baseLevel).toBe(200);
    });
});

describe("equipmentRowsOf", () => {
    const added = addCharacterToWorkspace(emptyWorkspace(), { ...blankCharacter(51), equipment: { rightHand: { itemId: 4411, refine: 9 }, shoes: { itemId: 4359 } } }, "メカニック");

    it("gives one row per slot in slot order, with the locker piece each slot holds", () => {
        const rows = equipmentRowsOf(added.workspace, added.characterId, true);

        expect(rows.map((row) => row.slot)).toEqual([...equipmentSlots]);
        expect(rows.filter((row) => row.lockerPiece !== null)).toEqual([
            { slot: "rightHand", gearPieceId: "rightHand-1", lockerPiece: { itemId: 4411, refine: 9, owned: true } },
            { slot: "shoes", gearPieceId: "shoes-1", lockerPiece: { itemId: 4359, owned: true } },
        ]);
    });

    it("leaves the left hand out for a job that wields one weapon, unless something is worn there", () => {
        const withoutLeftHand = equipmentSlots.filter((slot) => slot !== "leftHand");
        const wearingBoth = addCharacterToWorkspace(emptyWorkspace(), { ...blankCharacter(51), equipment: { rightHand: { itemId: 4411 }, leftHand: { itemId: 4411 } } }, "メカニック");

        expect(equipmentRowsOf(added.workspace, added.characterId, false).map((row) => row.slot)).toEqual(withoutLeftHand);
        expect(equipmentRowsOf(wearingBoth.workspace, wearingBoth.characterId, false).map((row) => row.slot)).toEqual([...equipmentSlots]);
    });

    it("gives only empty rows for a character the workspace does not have", () => {
        expect(equipmentRowsOf(added.workspace, "nobody", true).every((row) => row.gearPieceId === null && row.lockerPiece === null)).toBe(true);
    });
});
