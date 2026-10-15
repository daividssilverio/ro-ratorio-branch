import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import { changesBetween } from "../tree/changes-between.ts";
import type { Build } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
// ratorio auto-spell IDs: Fire Bolt and Cold Bolt, both at level 3.
const fireBoltAutoSpellId = 2;
const coldBoltAutoSpellId = 1;

describe("auto-spells", () => {
    let engine: RatorioEngine;
    /** The golden character attacking plainly, which is when auto-spells go off. */
    let plainAttack: Build;
    const withAutoSpells = (autoSpells: NonNullable<Build["character"]["autoSpells"]>): Build => ({ ...plainAttack, character: { ...plainAttack.character, autoSpells } });
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
        plainAttack = { ...goldenBuild, scenario: { skillId: engine.skillIds.basicAttack, skillLevel: 1, targetMonsterId: goldenBuild.scenario.targetMonsterId } };
    });

    it("offers the auto-spells and chances the original does", () => {
        const autoSpells = engine.catalog.autoSpells();
        const chances = engine.catalog.autoSpellChances();

        expect(autoSpells.length).toBeGreaterThan(50);
        expect(autoSpells.map((autoSpell) => autoSpell.id)).not.toContain(0);
        expect(new Set(autoSpells.map((autoSpell) => autoSpell.id)).size).toBe(autoSpells.length);
        expect(autoSpells.map((autoSpell) => autoSpell.id)).toEqual(expect.arrayContaining([fireBoltAutoSpellId, coldBoltAutoSpellId]));
        expect(chances.slice(0, 12)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]);
        expect(chances.at(-1)).toBe(1000);
        expect(engine.calcModelLayout.autoSpells.limit).toBe(20);
    });

    it("writes each one's ID, level and chance into the model, and reads them back", () => {
        const autoSpells = [
            { autoSpellId: fireBoltAutoSpellId, level: 3, chancePerMille: 100 },
            { autoSpellId: coldBoltAutoSpellId, level: 0, chancePerMille: 15 },
        ];
        const calcModel = convertBuildToCalcModel(withAutoSpells(autoSpells), engine);

        expect(engine.calcModelLayout.autoSpells.fromCalcModelList(calcModel.autoSpell)).toEqual(autoSpells);
        expect(engine.calcModelLayout.autoSpells.fromCalcModelList(convertBuildToCalcModel(plainAttack, engine).autoSpell)).toEqual([]);
    });

    it("adds to the damage per second of a plain attack, more the more often it goes off, and leaves nothing behind", () => {
        const damagePerSecondOf = (build: Build) => calculateBuild(build, engine).averageDamagePerSecond;
        const without = damagePerSecondOf(plainAttack);
        const sometimes = damagePerSecondOf(withAutoSpells([{ autoSpellId: fireBoltAutoSpellId, level: 3, chancePerMille: 100 }]));
        const always = damagePerSecondOf(withAutoSpells([{ autoSpellId: fireBoltAutoSpellId, level: 3, chancePerMille: 1000 }]));

        expect(sometimes).toBeGreaterThan(without);
        expect(always).toBeGreaterThan(sometimes);
        expect(damagePerSecondOf(plainAttack)).toBe(without);
    });

    it("reports an auto-spell the original does not offer and a chance it does not list", () => {
        expect(issuesOf(withAutoSpells([{ autoSpellId: 999_999, chancePerMille: 100 }, { autoSpellId: fireBoltAutoSpellId, chancePerMille: 12 }]))).toEqual([
            { kind: "unknownAutoSpell", autoSpellId: 999_999 },
            { kind: "autoSpellChanceNotOffered", autoSpellId: fireBoltAutoSpellId, chancePerMille: 12 },
        ]);
    });

    it("goes through a ratorio save and comes back the same", async () => {
        const readSave = await engine.loadSaveReader();
        const writeSave = await engine.loadSaveWriter();
        const build = withAutoSpells([
            { autoSpellId: fireBoltAutoSpellId, level: 3, chancePerMille: 100 },
            { autoSpellId: coldBoltAutoSpellId, chancePerMille: 15 },
        ]);

        const imported = importRatorioSave(readSave(writeSave(exportRatorioSave(build, engine).content)), engine);

        expect(imported.notImported).toEqual([]);
        expect(imported.character.autoSpells).toEqual(build.character.autoSpells);
    });

    it("becomes one tree change for the whole list", () => {
        const autoSpells = [{ autoSpellId: fireBoltAutoSpellId, chancePerMille: 100 }];

        expect(changesBetween(plainAttack.character, withAutoSpells(autoSpells).character)).toEqual({ changes: [{ kind: "setAutoSpells", autoSpells }], inexpressible: [] });
    });
});
