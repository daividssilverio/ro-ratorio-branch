import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { customizationSections, targetSettingSections } from "../engine-adapter/named-settings.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import type { Build } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
const goldenDamagePerSecond = 6507149;

const customized = (customization: NonNullable<Build["character"]["customization"]>): Build => ({ ...goldenBuild, character: { ...goldenBuild.character, customization } });
const against = (targetSettings: NonNullable<Build["scenario"]["targetSettings"]>): Build => ({ ...goldenBuild, scenario: { ...goldenBuild.scenario, targetSettings } });

describe("performance customisation and monster settings", () => {
    let engine: RatorioEngine;
    const damageOf = (build: Build) => calculateBuild(build, engine).averageDamagePerAttack;
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
    });

    it("offers settings in every part, each with a range", () => {
        const customizations = engine.catalog.customizations();
        const targetSettings = engine.catalog.targetSettings();

        expect(customizationSections.map((section) => customizations[section].length > 3)).toEqual([true, true, true, true, true]);
        expect(targetSettingSections.map((section) => targetSettings[section].length > 3)).toEqual([true, true, true]);
        expect(customizations.attack.find((setting) => setting.name === "ATK_PLUS")).toMatchObject({ control: "number", lowest: -500, highest: 500 });
        expect(customizations.attack.find((setting) => setting.name === "WEAPON_LEVEL")?.choices?.map((choice) => choice.value)).toEqual([0, 1, 2, 3, 4]);
        expect(targetSettings.buffs.find((setting) => setting.name === "DAMAGE_DIVIDE")?.choices).toHaveLength(10);
        expect(Object.values(customizations).flat().filter((setting) => /^(DUMMY|BLANK)/.test(setting.name))).toEqual([]);
        // The "as player" table exports the values of two settings next to the settings themselves.
        expect(targetSettings.asPlayer.map((setting) => setting.name)).toEqual(expect.arrayContaining(["MAXHP", "ZOKUSEI", "SENTO_AREA", "SHUZOKU"]));
        expect(targetSettings.asPlayer.filter((setting) => /^(SENTO_AREA|SHUZOKU)_/.test(setting.name))).toEqual([]);
        expect(new Set(engine.calcModelLayout.targetSettings.asPlayer.positionOfName.values()).size).toBe(engine.calcModelLayout.targetSettings.asPlayer.positionOfName.size);
    });

    it("writes each setting at its upstream slot", () => {
        const { customizations, targetSettings } = engine.calcModelLayout;
        const calcModel = convertBuildToCalcModel(
            { ...customized({ attack: { ATK_PLUS: -120 }, status: { DISABLE_SETTINGS: 1 } }), scenario: { ...goldenBuild.scenario, targetSettings: { buffs: { DAMAGE_DIVIDE: 2 } } } },
            engine,
        );

        expect(calcModel.confCustomAtk[customizations.attack.positionOfName.get("ATK_PLUS") ?? -1]).toBe(-120);
        expect(calcModel.confCustomStatus[customizations.status.positionOfName.get("DISABLE_SETTINGS") ?? -1]).toBe(1);
        expect(calcModel.mobConfKyouka[targetSettings.buffs.positionOfName.get("DAMAGE_DIVIDE") ?? -1]).toBe(2);
    });

    it("raises and lowers the damage with attack added and taken away, and leaves nothing behind", () => {
        const plain = damageOf(goldenBuild);

        expect(damageOf(customized({ attack: { ATK_PLUS: 500 } }))).toBeGreaterThan(plain);
        expect(damageOf(customized({ attack: { ATK_PLUS: -500 } }))).toBeLessThan(plain);
        expect(calculateBuild(goldenBuild, engine).averageDamagePerSecond).toBe(goldenDamagePerSecond);
    });

    it("lowers the damage on a target that divides it, and leaves nothing behind", () => {
        const plain = damageOf(goldenBuild);
        const halved = damageOf(against({ buffs: { DAMAGE_DIVIDE: 1 } }));

        expect(halved).toBeLessThan(plain * 0.6);
        expect(halved).toBeGreaterThan(plain * 0.4);
        expect(calculateBuild(goldenBuild, engine).averageDamagePerSecond).toBe(goldenDamagePerSecond);
    });

    it("reports a setting upstream does not have and a value it does not offer", () => {
        expect(issuesOf(customized({ attack: { NO_SUCH_SETTING: 1, ATK_PLUS: 501, WEAPON_LEVEL: 5 } }))).toEqual([
            { kind: "unknownCustomization", section: "attack", name: "NO_SUCH_SETTING" },
            { kind: "customizationValueNotOffered", section: "attack", name: "ATK_PLUS", value: 501 },
            { kind: "customizationValueNotOffered", section: "attack", name: "WEAPON_LEVEL", value: 5 },
        ]);
        expect(issuesOf(against({ buffs: { NO_SUCH_SETTING: 1, DAMAGE_DIVIDE: 10 } }))).toEqual([
            { kind: "unknownTargetSetting", section: "buffs", name: "NO_SUCH_SETTING" },
            { kind: "targetSettingValueNotOffered", section: "buffs", name: "DAMAGE_DIVIDE", value: 10 },
        ]);
    });

    it("goes through a ratorio save and comes back the same, apart from what a save has no place for", async () => {
        const readSave = await engine.loadSaveReader();
        const writeSave = await engine.loadSaveWriter();
        const { customizations } = engine.calcModelLayout;
        const [settingSavesDoNotCarry] = [...customizations.attack.namesSavesDoNotCarry].filter((name) => customizations.attack.settings.some((setting) => setting.name === name && setting.control === "number"));
        const customization = {
            status: { STR_PLUS: 12 },
            attack: { ATK_PLUS: -250, WEAPON_LEVEL: 4, PHYSICAL_DAMAGE_UP: 35 },
            defense: { DEF_PLUS: 40 },
            skill: { SKILL_CAST_MINUS: -15 },
            traitStatus: { POW_PLUS: 9 },
        };
        const targetSettings = { asPlayer: { ZOKUSEI: 3 }, ailments: { ELEMENTAL_CHANGE: 2 }, buffs: { DAMAGE_DIVIDE: 1, ASSUMPTIO: 1 } };
        const build: Build = {
            ...goldenBuild,
            character: { ...goldenBuild.character, customization: { ...customization, attack: { ...customization.attack, ...(settingSavesDoNotCarry === undefined ? {} : { [settingSavesDoNotCarry]: 1 }) } } },
            scenario: { ...goldenBuild.scenario, targetSettings },
        };

        expect(issuesOf(build)).toEqual([]);
        const exported = exportRatorioSave(build, engine);
        const imported = importRatorioSave(readSave(writeSave(exported.content)), engine);

        expect(settingSavesDoNotCarry).toBeDefined();
        expect(exported.notExported).toEqual([{ kind: "customizationNotInSaves", section: "attack", name: settingSavesDoNotCarry }]);
        expect(imported.notImported).toEqual([]);
        expect(imported.character.customization).toEqual(customization);
        expect(imported.scenario?.targetSettings).toEqual(targetSettings);
    });
});
