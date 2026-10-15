import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { type RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { Build } from "./build-format.ts";
import { equipmentSlots, shadowEquipmentSlots } from "../character-vocabulary.ts";
import { BuildConversionError, type BuildConversionIssue, convertBuildToCalcModel, slotTakesRefine, slotTakesTranscendence } from "./convert-build.ts";

const mechanicJobId = 51;
const armsCannonSkillId = 554;
const maceItemId = 4411;
const shieldItemId = 4936;
const accessoryItemId = 3407;
const archMageStaffItemId = 5476;
const cardId = 659;
const idBeyondEveryUpstreamTable = 999_999;

function unequippedMechanicBuild(): Build {
    return {
        formatVersion: 1,
        character: {
            jobId: mechanicJobId,
            baseLevel: 200,
            jobLevel: 70,
            baseStats: { str: 110, agi: 110, vit: 100, int: 100, dex: 110, luk: 78 },
            equipment: {},
        },
        scenario: { skillId: armsCannonSkillId, skillLevel: 5, skillOptions: [1], targetMonsterId: 850 },
    };
}

describe("slotTakesRefine and slotTakesTranscendence", () => {
    it("lets the weapon hands and the five refinable armor slots take both", () => {
        expect(equipmentSlots.filter(slotTakesTranscendence)).toEqual(["rightHand", "leftHand", "headTop", "shield", "armor", "garment", "shoes"]);
    });

    it("lets shadow gear take refine only", () => {
        expect(equipmentSlots.filter((slot) => slotTakesRefine(slot) && !slotTakesTranscendence(slot))).toEqual([...shadowEquipmentSlots]);
    });
});

describe("convertBuildToCalcModel", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    }, 60_000);

    function conversionIssuesOf(build: Build): readonly BuildConversionIssue[] {
        try {
            convertBuildToCalcModel(build, engine);
        } catch (error) {
            if (error instanceof BuildConversionError) {
                return error.issues;
            }
            throw error;
        }
        return [];
    }

    describe("character and scenario", () => {
        it("carries job, levels, base stats and the attack into the model", () => {
            const calcModel = convertBuildToCalcModel(unequippedMechanicBuild(), engine);

            expect(calcModel.status).toEqual({
                jobId: mechanicJobId,
                baseLv: 200,
                jobLv: 70,
                str: 110,
                agi: 110,
                vit: 100,
                dex: 110,
                int: 100,
                luk: 78,
                speedPot: 0,
            });
            expect(calcModel.attackMethod.skillId).toBe(armsCannonSkillId);
            expect(calcModel.attackMethod.skillLv).toBe(5);
            expect(calcModel.attackMethod.optionValueArray).toEqual([1]);
        });

        it("leaves an unequipped character exactly at the baseline model apart from status and attack", () => {
            const calcModel = convertBuildToCalcModel(unequippedMechanicBuild(), engine);

            const baselineCalcModel = engine.createBaselineCalcModel(mechanicJobId);
            expect({ ...calcModel, status: null, attackMethod: null }).toEqual({
                ...baselineCalcModel,
                status: null,
                attackMethod: null,
            });
        });
    });

    describe("equipment", () => {
        it("puts a weapon in the right hand with its type, refine and transcendence", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.rightHand = { itemId: maceItemId, refine: 9, transcendence: 4 };

            const calcModel = convertBuildToCalcModel(build, engine);

            expect(calcModel.equip[engine.calcModelLayout.equipPositionOfSlot.rightHand]).toBe(maceItemId);
            expect(calcModel.weapon.type).toBe(engine.itemKind(maceItemId));
            expect(calcModel.weapon.atkPlus).toBe(9);
            expect(calcModel.weapon.transcendence).toBe(4);
        });

        it("writes armor refine to the armor region of its slot", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.shield = { itemId: shieldItemId, refine: 7 };

            const calcModel = convertBuildToCalcModel(build, engine);

            expect(calcModel.defPlus).toEqual({ head: 0, body: 0, shield: 7, shoulder: 0, shoes: 0 });
        });

        it("places sockets in slot order and skips empty ones", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.rightHand = { itemId: maceItemId, sockets: [null, cardId] };

            const calcModel = convertBuildToCalcModel(build, engine);

            const [firstSocket, secondSocket] = engine.calcModelLayout.cardPositionsOfSlot.rightHand;
            expect(calcModel.card[firstSocket ?? -1]).toBe(0);
            expect(calcModel.card[secondSocket ?? -1]).toBe(cardId);
        });

        it("reports an item the engine does not know, with its slot", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.armor = { itemId: idBeyondEveryUpstreamTable };

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "unknownItem", slot: "armor", itemId: idBeyondEveryUpstreamTable },
            ]);
        });

        it("reports an item in a slot of another kind", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.shield = { itemId: maceItemId };

            expect(conversionIssuesOf(build)).toEqual([{ kind: "itemDoesNotFitSlot", slot: "shield", itemId: maceItemId }]);
        });

        it("reports an item the job may not wear", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.rightHand = { itemId: archMageStaffItemId };

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "itemNotEquippableByJob", slot: "rightHand", itemId: archMageStaffItemId },
            ]);
        });

        it("reports a card the engine does not know, with its slot and socket number", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.rightHand = { itemId: maceItemId, sockets: [null, idBeyondEveryUpstreamTable] };

            expect(conversionIssuesOf(build)).toEqual([
                {
                    kind: "unknownCardOrEnchant",
                    slot: "rightHand",
                    socket: 2,
                    cardOrEnchantId: idBeyondEveryUpstreamTable,
                },
            ]);
        });

        it("reports refine and transcendence on a slot the engine cannot refine", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.accessory1 = { itemId: accessoryItemId, refine: 5, transcendence: 1 };

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "refineNotSupported", slot: "accessory1" },
                { kind: "transcendenceNotSupported", slot: "accessory1" },
            ]);
        });
    });

    describe("skills and buffs", () => {
        it("writes a learned skill at the job's slot for that skill", () => {
            const build = unequippedMechanicBuild();
            build.character.learnedSkills = { [armsCannonSkillId]: 5 };

            const calcModel = convertBuildToCalcModel(build, engine);

            const { learnedSkillIds } = engine.skillSlotsOfJob(mechanicJobId);
            expect(calcModel.learnedSkill[learnedSkillIds.indexOf(armsCannonSkillId)]).toBe(5);
        });

        it("reports a level, a base stat and a trait stat the original would not let the job have", () => {
            const limits = engine.catalog.limitsOfJob(mechanicJobId);
            const build = unequippedMechanicBuild();
            build.character.baseLevel = (limits?.baseLevel.highest ?? 0) + 1;
            build.character.jobLevel = (limits?.jobLevel.highest ?? 0) + 1;
            build.character.baseStats = { ...build.character.baseStats, str: (limits?.baseStat.highest ?? 0) + 1 };
            build.character.traitStats = { pow: 1, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 };

            expect(limits?.traitStat).toBeNull();
            expect(conversionIssuesOf(build)).toEqual([
                { kind: "baseLevelOutOfRange", baseLevel: build.character.baseLevel },
                { kind: "jobLevelOutOfRange", jobLevel: build.character.jobLevel },
                { kind: "baseStatOutOfRange", stat: "str", value: build.character.baseStats.str },
                { kind: "traitStatOutOfRange", stat: "pow", value: 1 },
            ]);
        });

        it("writes timed effects in order and the speed potion", () => {
            const build = unequippedMechanicBuild();
            build.character.timedItems = [3, 1];
            build.character.speedPotion = 2;

            const calcModel = convertBuildToCalcModel(build, engine);

            expect(calcModel.timeItemConf.slice(0, 3)).toEqual([3, 1, 0]);
            expect(calcModel.status.speedPot).toBe(2);
        });

        it("writes the same timed effect as often as it is set, as the original lets it be", () => {
            const build = unequippedMechanicBuild();
            build.character.timedItems = [79, 3, 79];

            expect(convertBuildToCalcModel(build, engine).timeItemConf.slice(0, 4)).toEqual([79, 3, 79, 0]);
        });

        it("reports a timed effect the engine does not have, one the original does not list, and an unknown speed potion", () => {
            const build = unequippedMechanicBuild();
            build.character.timedItems = [1, 999_999, 137];
            build.character.speedPotion = 9;

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "unknownSpeedPotion", speedPotion: 9 },
                { kind: "unknownTimedItem", timedItemId: 999_999 },
                { kind: "timedItemNotOffered", timedItemId: 137 },
            ]);
        });

        it("writes a support buff into the section and position of its upstream name", () => {
            const build = unequippedMechanicBuild();
            build.character.supportBuffs = { ADRENALINE_RUSH: 1 };

            const calcModel = convertBuildToCalcModel(build, engine);

            const location = engine.calcModelLayout.supportBuffLocations.get("ADRENALINE_RUSH");
            expect(location?.section).toBe("confNizi");
            expect(calcModel.confNizi[location?.position ?? -1]).toBe(1);
        });

        it("reports a learned skill the job cannot learn", () => {
            const build = unequippedMechanicBuild();
            build.character.learnedSkills = { [idBeyondEveryUpstreamTable]: 1 };

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "skillNotLearnableByJob", skillId: idBeyondEveryUpstreamTable },
            ]);
        });

        it("reports a self-buff the job does not have", () => {
            const build = unequippedMechanicBuild();
            build.character.selfBuffs = { [idBeyondEveryUpstreamTable]: 1 };

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "selfBuffNotAvailableForJob", skillId: idBeyondEveryUpstreamTable },
            ]);
        });

        it("reports a support buff name upstream does not define", () => {
            const build = unequippedMechanicBuild();
            build.character.supportBuffs = { NOT_A_BUFF: 1 };

            expect(conversionIssuesOf(build)).toEqual([{ kind: "unknownSupportBuff", name: "NOT_A_BUFF" }]);
        });
    });

    describe("scenario", () => {
        it("reports a target monster the engine does not know", () => {
            const build = unequippedMechanicBuild();
            build.scenario.targetMonsterId = idBeyondEveryUpstreamTable;

            expect(conversionIssuesOf(build)).toEqual([
                { kind: "unknownTargetMonster", monsterId: idBeyondEveryUpstreamTable },
            ]);
        });
    });

    describe("failure reporting", () => {
        it("reports an unknown job by itself, since nothing else can be checked without it", () => {
            const build = unequippedMechanicBuild();
            build.character.jobId = idBeyondEveryUpstreamTable;
            build.character.supportBuffs = { NOT_A_BUFF: 1 };

            expect(conversionIssuesOf(build)).toEqual([{ kind: "unknownJob", jobId: idBeyondEveryUpstreamTable }]);
        });

        it("collects every issue of a build in one error", () => {
            const build = unequippedMechanicBuild();
            build.character.equipment.armor = { itemId: idBeyondEveryUpstreamTable };
            build.character.supportBuffs = { NOT_A_BUFF: 1 };

            expect(conversionIssuesOf(build).map((issue) => issue.kind)).toEqual(["unknownItem", "unknownSupportBuff"]);
        });
    });
});
