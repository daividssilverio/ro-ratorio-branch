import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { calcModelListOfBuffPanel } from "../engine-adapter/calc-model-layout.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { panelDefinitions, positionalBuffPanels } from "../panels/panel-definitions.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import { changesBetween } from "../tree/changes-between.ts";
import type { Build } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
const goldenDamagePerSecond = 6507149;

// Positions in the original's panels, with the label each has there.
const gospelAllStatsPosition = "5"; // ステータスALL+20
const gospelAttackPosition = "8"; // ATK+100%
const guildLeadershipPosition = "1"; // 偉大なる指導力, levels 0 to 5
const boxOfResentmentPosition = "9"; // 恨みの箱(ATK+20)
const timedAttackSpeedPosition = "47"; // 期間限定系[ASPD], 10 to 50
const petPosition = "0";
const adoptedPosition = "13"; // 養子状態にする

const withCharacter = (fields: Partial<Build["character"]>): Build => ({ ...goldenBuild, character: { ...goldenBuild.character, ...fields } });
const issuesOf = (build: Build, engine: RatorioEngine): BuildConversionError["issues"] => {
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

describe("guild, item and other buffs", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("has a place in the calc model for every buff the panels offer", () => {
        const baseline = engine.createBaselineCalcModel(goldenBuild.character.jobId);
        for (const panel of positionalBuffPanels) {
            const positions = Object.keys(panelDefinitions[panel]).map(Number);
            expect(positions.length).toBeGreaterThan(10);
            expect(Math.max(...positions)).toBeLessThan(baseline[calcModelListOfBuffPanel[panel]].length);
        }
    });

    it("writes each buff at its position, and leaves the baseline without them", () => {
        const plain = convertBuildToCalcModel(goldenBuild, engine);
        const changed = convertBuildToCalcModel(
            withCharacter({ guildBuffs: { [guildLeadershipPosition]: 5 }, itemBuffs: { [timedAttackSpeedPosition]: 15 }, otherBuffs: { [petPosition]: 1 } }),
            engine,
        );

        expect([plain.buff4[1], plain.buff7[47], plain.buff8[0]]).toEqual([0, 0, 0]);
        expect([changed.buff4[1], changed.buff7[47], changed.buff8[0]]).toEqual([5, 15, 1]);
    });

    it("changes the damage, more for the larger buff, and leaves nothing behind", () => {
        const damageOf = (fields: Partial<Build["character"]>, scenario = goldenBuild.scenario) =>
            calculateBuild({ ...withCharacter(fields), scenario }, engine).averageDamagePerAttack;
        const withoutBuffs = damageOf({});
        const withAttackItem = damageOf({ itemBuffs: { [boxOfResentmentPosition]: 1 } });
        const withGospelStats = damageOf({ guildBuffs: { [gospelAllStatsPosition]: 1 } });

        expect(withAttackItem).toBeGreaterThan(withoutBuffs);
        expect(withGospelStats).toBeGreaterThan(withAttackItem);

        // The engine gives the gospel's ATK+100% to a plain attack, not to Arms Cannon.
        const plainAttack = { skillId: engine.skillIds.basicAttack, skillLevel: 1, targetMonsterId: goldenBuild.scenario.targetMonsterId };
        expect(damageOf({ guildBuffs: { [gospelAttackPosition]: 1 } })).toBe(withoutBuffs);
        expect(damageOf({ guildBuffs: { [gospelAttackPosition]: 1 } }, plainAttack)).toBeGreaterThan(damageOf({}, plainAttack) * 1.9);
        expect(calculateBuild(goldenBuild, engine).averageDamagePerSecond).toBe(goldenDamagePerSecond);
    });

    it("lowers the highest base stat of an adopted character", () => {
        const { jobId, baseStats } = goldenBuild.character;
        const highestOf = (isAdopted: boolean) => engine.catalog.limitsOfJob(jobId, isAdopted)?.baseStat.highest ?? 0;

        expect(highestOf(true)).toBeGreaterThan(0);
        expect(highestOf(true)).toBeLessThan(highestOf(false));
        const adoptedWithAStatTooHigh = withCharacter({ otherBuffs: { [adoptedPosition]: 1 }, baseStats: { ...baseStats, str: highestOf(false) } });
        expect(issuesOf(adoptedWithAStatTooHigh, engine)).toContainEqual({ kind: "baseStatOutOfRange", stat: "str", value: highestOf(false) });
        expect(issuesOf(withCharacter({ baseStats: { ...baseStats, str: highestOf(false) } }), engine)).toEqual([]);
    });

    it("reports a position the panel does not have and a value it does not offer", () => {
        const issues = issuesOf(
            withCharacter({
                guildBuffs: { "20": 1, [guildLeadershipPosition]: 6 },
                itemBuffs: { [timedAttackSpeedPosition]: 5, [boxOfResentmentPosition]: 2 },
                otherBuffs: { "9": 1 },
            }),
            engine,
        );

        expect(issues).toEqual([
            { kind: "panelBuffValueNotOffered", panel: "guildBuffs", position: 1, value: 6 },
            { kind: "unknownPanelBuff", panel: "guildBuffs", position: 20 },
            { kind: "panelBuffValueNotOffered", panel: "itemBuffs", position: 9, value: 2 },
            { kind: "panelBuffValueNotOffered", panel: "itemBuffs", position: 47, value: 5 },
            { kind: "unknownPanelBuff", panel: "otherBuffs", position: 9 },
        ]);
    });

    it("goes through a ratorio save and comes back the same", async () => {
        const read = await engine.loadSaveReader();
        const write = await engine.loadSaveWriter();
        const build = withCharacter({
            guildBuffs: { [guildLeadershipPosition]: 5, [gospelAttackPosition]: 1, "35": 600 },
            itemBuffs: { [boxOfResentmentPosition]: 1, [timedAttackSpeedPosition]: 15, "52": 8 },
            otherBuffs: { [petPosition]: 55, [adoptedPosition]: 1, "22": 4 },
            speedPotion: 2,
            weaponElement: 3,
        });
        const exported = exportRatorioSave(build, engine);
        const imported = importRatorioSave(read(write(exported.content)), engine);

        expect(exported.notExported).toEqual([]);
        expect(imported.notImported).toEqual([]);
        expect(imported.character.guildBuffs).toEqual(build.character.guildBuffs);
        expect(imported.character.itemBuffs).toEqual(build.character.itemBuffs);
        expect(imported.character.otherBuffs).toEqual(build.character.otherBuffs);
        expect([imported.character.speedPotion, imported.character.weaponElement]).toEqual([2, 3]);
    });

    it("becomes one tree change per buff", () => {
        const changed = withCharacter({ guildBuffs: { [gospelAttackPosition]: 1 }, otherBuffs: { [petPosition]: 1 } });

        expect(changesBetween(goldenBuild.character, changed.character)).toEqual({
            changes: [
                { kind: "setPanelBuff", panel: "guildBuffs", position: 8, value: 1 },
                { kind: "setPanelBuff", panel: "otherBuffs", position: 0, value: 1 },
            ],
            inexpressible: [],
        });
    });
});
