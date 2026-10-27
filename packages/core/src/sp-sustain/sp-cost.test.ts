import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { calculateBuildInDetail } from "../build/calculate-build.ts";
import type { Build } from "../build/build-format.ts";
import { parseBuild } from "../build/parse-build.ts";
import type { SkillCostChanges } from "../engine-adapter/engine-catalog.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";

const goldenBuild = (name: string): Build => parseBuild(JSON.parse(readFileSync(new URL(`../build/golden-builds/${name}.build.json`, import.meta.url), "utf8")));

const tigerSlashSkillId = 1221;
const frozenSlashSkillId = 1070;
const armsCannonSkillId = 554;
/** Its wording: skills cost 10% more. */
const cruiserHatItemId = 1074;
/** Its wording: skills cost 5% less. */
const magicStoleItemId = 1396;
const unchanged: SkillCostChanges = { flat: 0, percentOfThisSkill: 100, percentOfEverySkill: 100 };

describe("the SP a skill costs", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("is the skill's own cost when nothing changes it", () => {
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, unchanged)).toBe(100);
    });

    it("takes off a flat reduction, then this skill's percent, then every skill's percent", () => {
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, { ...unchanged, flat: -10 })).toBe(90);
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, { ...unchanged, percentOfThisSkill: 80 })).toBe(80);
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, { ...unchanged, percentOfEverySkill: 90 })).toBe(90);
    });

    it("rounds up only once every change is applied, as upstream's cast simulator does", () => {
        // 100 - 67 = 33; 33 at 90% is 29.7; at 100% that rounds up to 30, at 50% 14.85 rounds up to 15.
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, { ...unchanged, flat: -67, percentOfThisSkill: 90 })).toBe(30);
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, { flat: -67, percentOfThisSkill: 90, percentOfEverySkill: 50 })).toBe(15);
    });

    it("never comes below 1 for a skill that costs SP, and is 0 for one that costs none or does not exist", () => {
        expect(engine.catalog.spCostOfSkill(tigerSlashSkillId, 7, { ...unchanged, flat: -1000 })).toBe(1);
        expect(engine.catalog.spCostOfSkill(engine.skillIds.basicAttack, 1, unchanged)).toBe(0);
        expect(engine.catalog.spCostOfSkill(999_999, 1, unchanged)).toBe(0);
    });

    it("tells physical skills from magical ones", () => {
        expect(engine.catalog.damageKindOfSkill(tigerSlashSkillId)).toBe("physical");
        expect(engine.catalog.damageKindOfSkill(armsCannonSkillId)).toBe("physical");
        expect(engine.catalog.damageKindOfSkill(frozenSlashSkillId)).toBe("magical");
        expect(engine.catalog.damageKindOfSkill(999_999)).toBe("neither");
    });

    it("is part of a build's calculation, with what the character wears", () => {
        const spiritHandler = goldenBuild("spirit-handler-tiger-slash");
        const wearing = (equipment: Build["character"]["equipment"]): Build => ({
            ...spiritHandler,
            character: { ...spiritHandler.character, equipment: { ...spiritHandler.character.equipment, ...equipment } },
        });

        expect(calculateBuildInDetail(spiritHandler, engine).spCostPerUse).toBe(100);
        expect(engine.skillCostChangesOfLastCalculation(tigerSlashSkillId)).toEqual(unchanged);
        expect(calculateBuildInDetail(wearing({ headTop: { itemId: cruiserHatItemId } }), engine).spCostPerUse).toBe(110);
        expect(engine.skillCostChangesOfLastCalculation(tigerSlashSkillId)).toEqual({ ...unchanged, percentOfEverySkill: 110 });
        expect(calculateBuildInDetail(wearing({ garment: { itemId: magicStoleItemId } }), engine).spCostPerUse).toBe(95);
    });
});
