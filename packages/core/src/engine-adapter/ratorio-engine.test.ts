import { beforeAll, describe, expect, it } from "vitest";
import type { RatorioCalcModel } from "./ratorio-calc-model.ts";
import { loadRatorioEngine } from "./load-ratorio-engine-in-node.ts";
import { type RatorioEngine, UnknownJobError, UnknownMonsterError } from "./ratorio-engine.ts";

const plainCannonballOption = 0;

const poringMonsterId = 272;
const shinaimMonsterId = 837;
const monsterIdBeyondTheMonsterTable = 999_999;
const jobIdBeyondTheJobTable = 999_999;

function setEveryBaseStat(calcModel: RatorioCalcModel, statValue: number): void {
    calcModel.status.str = statValue;
    calcModel.status.agi = statValue;
    calcModel.status.vit = statValue;
    calcModel.status.dex = statValue;
    calcModel.status.int = statValue;
    calcModel.status.luk = statValue;
}

function slotOfSkill(skillIdsInSlotOrder: readonly number[], skillId: number): number {
    const slot = skillIdsInSlotOrder.indexOf(skillId);
    if (slot < 0) {
        throw new RangeError(`skill ${skillId} has no slot for this job`);
    }
    return slot;
}

function buildUnarmedNoviceBasicAttackModel(engine: RatorioEngine): RatorioCalcModel {
    const calcModel = engine.createBaselineCalcModel(engine.jobIds.novice);
    calcModel.status.baseLv = 99;
    calcModel.status.jobLv = 50;
    setEveryBaseStat(calcModel, 50);
    return calcModel;
}

function buildGearlessMeisterArmsCannonModel(
    engine: RatorioEngine,
    options: { abrDualCannonActive: boolean },
): RatorioCalcModel {
    const { passiveSkillIds, learnedSkillIds } = engine.skillSlotsOfJob(engine.jobIds.meister);
    const calcModel = engine.createBaselineCalcModel(engine.jobIds.meister);
    calcModel.status.baseLv = 200;
    calcModel.status.jobLv = 50;
    setEveryBaseStat(calcModel, 100);
    calcModel.attackMethod.skillId = engine.skillIds.armsCannon;
    calcModel.attackMethod.skillLv = 5;
    calcModel.attackMethod.optionValueArray = [plainCannonballOption];
    calcModel.passiveSkill[slotOfSkill(passiveSkillIds, engine.skillIds.madogear)] = 1;
    calcModel.passiveSkill[slotOfSkill(passiveSkillIds, engine.skillIds.abrDualCannon)] = options.abrDualCannonActive ? 1 : 0;
    calcModel.learnedSkill[slotOfSkill(learnedSkillIds, engine.skillIds.madogearLicense)] = 5;
    return calcModel;
}

describe("ratorio engine in plain Node", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    }, 60_000);

    function summarizeNoviceBasicAttackAgainst(targetMonsterId: number) {
        const battleResult = engine.calculateBattleResult(buildUnarmedNoviceBasicAttackModel(engine), targetMonsterId);
        return engine.summarizeBattleResult(battleResult);
    }

    function summarizeMeisterArmsCannonAgainstShinaim(options: { abrDualCannonActive: boolean }) {
        const battleResult = engine.calculateBattleResult(
            buildGearlessMeisterArmsCannonModel(engine, options),
            shinaimMonsterId,
        );
        return engine.summarizeBattleResult(battleResult);
    }

    describe("loading", () => {
        it("returns a CBattleCalcResultAll for an unarmed novice basic attack", () => {
            const battleResult = engine.calculateBattleResult(
                buildUnarmedNoviceBasicAttackModel(engine),
                poringMonsterId,
            );

            expect(engine.isBattleResult(battleResult)).toBe(true);
        });

        it("does not take an arbitrary object for a battle result", () => {
            expect(engine.isBattleResult({ charaData: [], specData: [], mobData: [] })).toBe(false);
        });

        it("reuses the one engine copy on a second load", async () => {
            expect(await loadRatorioEngine()).toBe(engine);
        });
    });

    describe("target monster", () => {
        it("calculates against the requested monster, also right after another one", () => {
            expect(summarizeNoviceBasicAttackAgainst(shinaimMonsterId).targetMonsterId).toBe(shinaimMonsterId);
            expect(summarizeNoviceBasicAttackAgainst(poringMonsterId).targetMonsterId).toBe(poringMonsterId);
        });

        it("rejects a monster ID the engine does not know", () => {
            const calculateAgainstUnknownMonster = () =>
                engine.calculateBattleResult(
                    buildUnarmedNoviceBasicAttackModel(engine),
                    monsterIdBeyondTheMonsterTable,
                );

            expect(calculateAgainstUnknownMonster).toThrow(UnknownMonsterError);
            expect(calculateAgainstUnknownMonster).toThrow(
                expect.objectContaining({ monsterId: monsterIdBeyondTheMonsterTable }),
            );
        });
    });

    describe("battle summary", () => {
        it("reports positive, finite damage and a time to kill against a weak monster", () => {
            const battleSummary = summarizeNoviceBasicAttackAgainst(poringMonsterId);

            expect(battleSummary.averageDamagePerAttack).toBeGreaterThan(0);
            expect(Number.isFinite(battleSummary.averageDamagePerAttack)).toBe(true);
            expect(battleSummary.averageDamagePerSecond).toBeGreaterThan(0);
            expect(Number.isFinite(battleSummary.averageDamagePerSecond)).toBe(true);
            expect(battleSummary.averageTimeToKill?.attacks).toBeGreaterThanOrEqual(1);
            expect(battleSummary.averageTimeToKill?.seconds).toBeGreaterThan(0);
        });

        it("reports no time to kill when the attack cannot damage the monster", () => {
            const battleSummary = summarizeNoviceBasicAttackAgainst(shinaimMonsterId);

            expect(battleSummary.averageDamagePerAttack).toBe(0);
            expect(battleSummary.averageTimeToKill).toBeNull();
        });
    });

    describe("baseline model", () => {
        it("leaves no scalar undefined", () => {
            const calcModel = engine.createBaselineCalcModel(engine.jobIds.meister);

            const scalars = [
                ...Object.values(calcModel.status),
                ...Object.values(calcModel.weapon),
                ...Object.values(calcModel.defPlus),
                ...Object.values(calcModel.defTranscendence),
                calcModel.arrow,
                calcModel.attackMethod.skillId,
                calcModel.attackMethod.sourceType,
                calcModel.attackMethod.skillLv,
            ];
            expect(scalars.filter((scalar) => typeof scalar !== "number")).toEqual([]);
        });

        it("is for the requested job, with one passive skill level per slot, all 0", () => {
            const { passiveSkillIds } = engine.skillSlotsOfJob(engine.jobIds.meister);

            const calcModel = engine.createBaselineCalcModel(engine.jobIds.meister);

            expect(calcModel.status.jobId).toBe(engine.jobIds.meister);
            expect(calcModel.passiveSkill).toEqual(passiveSkillIds.map(() => 0));
        });

        it("calculates to finite numbers without any further input", () => {
            const battleResult = engine.calculateBattleResult(
                engine.createBaselineCalcModel(engine.jobIds.meister),
                poringMonsterId,
            );

            const battleSummary = engine.summarizeBattleResult(battleResult);
            expect(Number.isFinite(battleSummary.averageDamagePerAttack)).toBe(true);
            expect(Number.isFinite(battleSummary.averageDamagePerSecond)).toBe(true);
        });
    });

    describe("job skills", () => {
        it("lists Madogear and ABR Dual Cannon as Meister buffs and Madogear License as learnable", () => {
            const { passiveSkillIds, learnedSkillIds } = engine.skillSlotsOfJob(engine.jobIds.meister);

            expect(passiveSkillIds).toContain(engine.skillIds.madogear);
            expect(passiveSkillIds).toContain(engine.skillIds.abrDualCannon);
            expect(learnedSkillIds).toContain(engine.skillIds.madogearLicense);
        });

        it("rejects a job ID the engine does not know", () => {
            expect(() => engine.skillSlotsOfJob(jobIdBeyondTheJobTable)).toThrow(UnknownJobError);
            expect(() => engine.createBaselineCalcModel(jobIdBeyondTheJobTable)).toThrow(
                expect.objectContaining({ jobId: jobIdBeyondTheJobTable }),
            );
        });
    });

    describe("Meister Arms Cannon against 魔神の使徒・シナイム", () => {
        it("deals damage while riding a Madogear with Madogear License 5", () => {
            const battleSummary = summarizeMeisterArmsCannonAgainstShinaim({ abrDualCannonActive: false });

            expect(battleSummary.averageDamagePerAttack).toBeGreaterThan(0);
            expect(battleSummary.averageTimeToKill).not.toBeNull();
        });

        it("hits twice while ABR Dual Cannon is active", () => {
            const withoutDualCannon = summarizeMeisterArmsCannonAgainstShinaim({ abrDualCannonActive: false });
            const withDualCannon = summarizeMeisterArmsCannonAgainstShinaim({ abrDualCannonActive: true });

            expect(withoutDualCannon.averageDamagePerAttack).toBeGreaterThan(0);
            expect(withDualCannon.averageDamagePerAttack).toBe(2 * withoutDualCannon.averageDamagePerAttack);
        });
    });
});
