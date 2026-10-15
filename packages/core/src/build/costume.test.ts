import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { changesBetween } from "../tree/changes-between.ts";
import type { Build } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));

describe("the costume", () => {
    let engine: RatorioEngine;
    /** A job the original offers a costume, with its first costume. */
    let jobWithACostume: { readonly jobId: number; readonly costumeId: number };

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        const offered = engine.catalog.jobs().flatMap((job) => engine.catalog.costumesOfJob(job.id).map((costume) => ({ jobId: job.id, costumeId: costume.id })));
        const [first] = offered;
        if (first === undefined) {
            throw new Error("the engine offers no job a costume");
        }
        jobWithACostume = first;
    });

    it("is offered to some jobs only, never as costume 0, and to no unknown job", () => {
        const jobsWithACostume = engine.catalog.jobs().filter((job) => engine.catalog.costumesOfJob(job.id).length > 0);

        expect(jobsWithACostume.length).toBeGreaterThan(0);
        expect(jobsWithACostume.length).toBeLessThan(engine.catalog.jobs().length);
        expect(engine.catalog.costumesOfJob(jobWithACostume.jobId).map((costume) => costume.id)).not.toContain(0);
        expect(engine.catalog.costumesOfJob(999_999)).toEqual([]);
    });

    it("is written to the lower headgear's place in the model for a job that is offered it", () => {
        const wearer: Build = {
            formatVersion: 1,
            character: {
                jobId: jobWithACostume.jobId,
                baseLevel: engine.catalog.limitsOfJob(jobWithACostume.jobId)?.baseLevel.lowest ?? 1,
                jobLevel: 1,
                baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
                equipment: {},
                costumeId: jobWithACostume.costumeId,
            },
            scenario: { skillId: engine.skillIds.basicAttack, skillLevel: 1, targetMonsterId: goldenBuild.scenario.targetMonsterId },
        };
        const { costumeId: _costumeId, ...characterWithoutCostume } = wearer.character;

        const calcModel = convertBuildToCalcModel(wearer, engine);

        expect(calcModel.costume[engine.calcModelLayout.costumePositionOfLowerHeadgear]).toBe(jobWithACostume.costumeId);
        expect(convertBuildToCalcModel({ ...wearer, character: characterWithoutCostume }, engine).costume.every((costumeId) => costumeId === 0)).toBe(true);
        expect(exportRatorioSave(wearer, engine).notExported).toEqual([{ kind: "costumeNotInSaves" }]);
        expect(changesBetween(characterWithoutCostume, wearer.character)).toEqual({ changes: [], inexpressible: ["costumeId"] });
    });

    it("is reported for a job that is not offered it", () => {
        const jobWithoutACostume = engine.catalog.jobs().find((job) => engine.catalog.costumesOfJob(job.id).length === 0);
        const build: Build = { ...goldenBuild, character: { ...goldenBuild.character, costumeId: jobWithACostume.costumeId } };
        let issues: BuildConversionError["issues"] = [];
        try {
            calculateBuild(build, engine);
        } catch (error) {
            issues = error instanceof BuildConversionError ? error.issues : [];
        }

        expect(jobWithoutACostume).toBeDefined();
        expect(engine.catalog.costumesOfJob(goldenBuild.character.jobId)).toEqual([]);
        expect(issues).toEqual([{ kind: "costumeNotOfferedToJob", costumeId: jobWithACostume.costumeId }]);
    });
});
