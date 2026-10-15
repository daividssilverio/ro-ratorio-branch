import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { type AttackMethod, chosenOptionsOf } from "../engine-adapter/attack-methods.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import type { Build } from "./build-format.ts";
import { attackMethodsOfBuild, calculateBuild, resolveAttack } from "./calculate-build.ts";
import { BuildConversionError } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
const goldenDamagePerSecond = 6507149;
const armsCannonSkillId = 554;
const ironCannonball = 1;
const soulCannonball = 4;
const fireBoltSkillId = 51;
// The item panel's switch that adds scroll and card skills to the attacks.
const scrollSwitchPosition = "15";
const scrollSkillCount = 19;

const withScrolls: Build = { ...goldenBuild, character: { ...goldenBuild.character, itemBuffs: { [scrollSwitchPosition]: 1 } } };
const attackingWith = (build: Build, scenario: Partial<Build["scenario"]>): Build => {
    const { skillOptions: _options, skillSource: _source, ...plainScenario } = build.scenario;
    return { ...build, scenario: { ...plainScenario, ...scenario } };
};

describe("the attacks a character can use", () => {
    let engine: RatorioEngine;
    let attackMethods: AttackMethod[];
    const issuesOf = (build: Build): BuildConversionError["issues"] => {
        try {
            calculateBuild(build, engine);
            return [];
        } catch (error) {
            if (error instanceof BuildConversionError) {
                return error.issues;
            }
            throw error;
        }
    };

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        attackMethods = attackMethodsOfBuild(goldenBuild, engine);
    });

    it("lists the job's attacks, the plain attack first, each with its levels", () => {
        expect(attackMethods[0]?.skillId).toBe(engine.skillIds.basicAttack);
        expect(new Set(attackMethods.map((attackMethod) => attackMethod.source))).toEqual(new Set(["job"]));
        expect(attackMethods.map((attackMethod) => attackMethod.skillId)).toEqual(engine.catalog.attackSkillsOfJob(goldenBuild.character.jobId).map((skill) => skill.id));

        const armsCannon = attackMethods.find((attackMethod) => attackMethod.skillId === armsCannonSkillId);
        expect(armsCannon?.levels.choices?.map((choice) => choice.value)).toEqual([1, 2, 3, 4, 5]);
        expect(armsCannon?.levels.defaultValue).toBe(5);
    });

    it("gives a skill its options after the level, with the default of each", () => {
        const armsCannon = attackMethods.find((attackMethod) => attackMethod.skillId === armsCannonSkillId);
        if (armsCannon === undefined) {
            throw new Error("the mechanic has no Arms Cannon");
        }
        const [level, cannonball, ...more] = chosenOptionsOf(armsCannon, undefined, []);

        expect(level?.value).toBe(5);
        expect(cannonball?.optionList.choices?.map((choice) => choice.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        expect(cannonball?.value).toBe(ironCannonball);
        expect(more).toEqual([]);
        expect(chosenOptionsOf(armsCannon, 3, [soulCannonball]).map((chosen) => chosen.value)).toEqual([3, soulCannonball]);
    });

    it("adds the scroll skills as attacks from gear when the item switch is on", () => {
        const withTheSwitch = attackMethodsOfBuild(withScrolls, engine);
        const fromGear = withTheSwitch.filter((attackMethod) => attackMethod.source === "gear");

        expect(fromGear).toHaveLength(scrollSkillCount);
        expect(withTheSwitch).toHaveLength(attackMethods.length + scrollSkillCount);
        expect(fromGear.find((attackMethod) => attackMethod.skillId === fireBoltSkillId)?.levels.defaultValue).toBe(5);
    });

    it("takes the skill's defaults for options the scenario leaves out, and leaves nothing behind", () => {
        const withoutOptions = attackingWith(goldenBuild, {});
        const withAnotherCannonball = attackingWith(goldenBuild, { skillOptions: [soulCannonball] });

        expect(goldenBuild.scenario.skillOptions).toEqual([ironCannonball]);
        expect(calculateBuild(withoutOptions, engine).averageDamagePerSecond).toBe(goldenDamagePerSecond);
        expect(calculateBuild(withAnotherCannonball, engine).averageDamagePerSecond).not.toBe(goldenDamagePerSecond);
        expect(calculateBuild(goldenBuild, engine).averageDamagePerSecond).toBe(goldenDamagePerSecond);
    });

    it("calculates an attack from gear only for a character that has it", () => {
        const fireBolt = { skillId: fireBoltSkillId, skillSource: "gear" as const, skillLevel: 5 };

        expect(calculateBuild(attackingWith(withScrolls, fireBolt), engine).averageDamagePerAttack).toBeGreaterThan(0);
        expect(issuesOf(attackingWith(goldenBuild, fireBolt))).toEqual([{ kind: "attackNotOffered", skillId: fireBoltSkillId, source: "gear" }]);
        expect(issuesOf(attackingWith(withScrolls, { skillId: fireBoltSkillId, skillLevel: 5 }))).toEqual([{ kind: "attackNotOffered", skillId: fireBoltSkillId, source: "job" }]);
    });

    it("reports a level and an option value the skill does not take", () => {
        expect(issuesOf(attackingWith(goldenBuild, { skillLevel: 6 }))).toEqual([{ kind: "attackLevelNotOffered", skillId: armsCannonSkillId, level: 6 }]);
        expect(issuesOf(attackingWith(goldenBuild, { skillOptions: [9] }))).toEqual([{ kind: "attackOptionNotOffered", skillId: armsCannonSkillId, position: 1, value: 9 }]);
        expect(resolveAttack({ ...goldenBuild.scenario, skillOptions: [soulCannonball, 7, 7] }, attackMethods)).toEqual({ optionValues: [soulCannonball] });
    });

    it("keeps the source of the attack through a ratorio save", async () => {
        const build = attackingWith(withScrolls, { skillId: fireBoltSkillId, skillSource: "gear", skillLevel: 3 });
        const readSave = await engine.loadSaveReader();
        const writeSave = await engine.loadSaveWriter();

        const { scenario } = importRatorioSave(readSave(writeSave(exportRatorioSave(build, engine).content)), engine);

        expect(scenario).toEqual({ skillId: fireBoltSkillId, skillSource: "gear", skillLevel: 3, targetMonsterId: build.scenario.targetMonsterId });
    });
});
