import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { CatalogEntry } from "../engine-adapter/engine-catalog.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import type { Build, GearPiece } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
const goldenDamagePerSecond = 6507149;
const goldenMaceItemId = 4411;
const optionIdBeyondUpstreamTable = 999_999;
const isFlatAttack = (choice: CatalogEntry) => /^atk\+$/i.test(choice.name);

const withWeapon = (weapon: GearPiece): Build => ({ ...goldenBuild, character: { ...goldenBuild.character, equipment: { ...goldenBuild.character.equipment, rightHand: weapon } } });

describe("gear random options", () => {
    let engine: RatorioEngine;
    /** A weapon the golden build's job may wield that rolls a flat ATK option, the position it rolls it at, and the option. */
    let weapon: { itemId: number; positionIndex: number; attack: CatalogEntry };
    const optionsAt = (positionIndex: number, value: number) => [...Array.from({ length: positionIndex }, () => null), { optionId: weapon.attack.id, value }];
    const damagePerSecondOf = (build: Build) => calculateBuild(build, engine).averageDamagePerSecond;
    const issuesOf = (build: Build) => {
        try {
            calculateBuild(build, engine);
            return [];
        } catch (error) {
            return error instanceof BuildConversionError ? error.issues : [];
        }
    };

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        for (const item of engine.catalog.itemsForSlot("rightHand", goldenBuild.character.jobId)) {
            const optionsOfPosition = engine.catalog.randomOptionsOfItem(item.id);
            const positionIndex = optionsOfPosition.findIndex((choices) => choices.some(isFlatAttack));
            const attack = optionsOfPosition[positionIndex]?.find(isFlatAttack);
            if (attack !== undefined) {
                weapon = { itemId: item.id, positionIndex, attack };
                return;
            }
        }
        throw new Error("no weapon of the job rolls a flat ATK option");
    });

    it("offers an item five positions, each with its own options and the values they can take", () => {
        const optionsOfPosition = engine.catalog.randomOptionsOfItem(weapon.itemId);

        expect(optionsOfPosition).toHaveLength(5);
        expect(weapon.attack.range?.highest).toBeGreaterThan(weapon.attack.range?.lowest ?? 0);
        expect(optionsOfPosition.flat().every((choice) => choice.name.length > 0 && choice.id > 0 && choice.range !== undefined && choice.range.step >= 1)).toBe(true);
    });

    it("offers nothing for an item that rolls no random options, like the golden build's mace, or that the engine does not have", () => {
        expect(engine.catalog.randomOptionsOfItem(goldenMaceItemId)).toEqual([[], [], [], [], []]);
        expect(engine.catalog.randomOptionsOfItem(optionIdBeyondUpstreamTable)).toEqual([[], [], [], [], []]);
    });

    it("raises the damage with an ATK option at the position the weapon rolls it, and more with a higher roll", () => {
        const { lowest, highest, step } = weapon.attack.range ?? { lowest: 0, highest: 0, step: 1 };
        const without = damagePerSecondOf(withWeapon({ itemId: weapon.itemId }));
        const withLowRoll = damagePerSecondOf(withWeapon({ itemId: weapon.itemId, randomOptions: optionsAt(weapon.positionIndex, lowest + step) }));
        const withHighRoll = damagePerSecondOf(withWeapon({ itemId: weapon.itemId, randomOptions: optionsAt(weapon.positionIndex, highest) }));

        expect(withHighRoll).toBeGreaterThan(without);
        expect(withHighRoll).toBeGreaterThanOrEqual(withLowRoll);
        expect(withLowRoll).toBeGreaterThanOrEqual(without);
    });

    it("leaves nothing behind for the next calculation", () => {
        damagePerSecondOf(withWeapon({ itemId: weapon.itemId, randomOptions: optionsAt(weapon.positionIndex, weapon.attack.range?.highest ?? 0) }));

        expect(damagePerSecondOf(goldenBuild)).toBe(goldenDamagePerSecond);
    });

    it("rejects an option the engine does not have, one the item does not roll, and a value outside its range", () => {
        const highest = weapon.attack.range?.highest ?? 0;

        expect(issuesOf(withWeapon({ itemId: weapon.itemId, randomOptions: [{ optionId: optionIdBeyondUpstreamTable, value: 1 }] }))).toEqual([
            { kind: "unknownRandomOption", slot: "rightHand", optionId: optionIdBeyondUpstreamTable },
        ]);
        expect(issuesOf(withWeapon({ itemId: goldenMaceItemId, randomOptions: [null, { optionId: weapon.attack.id, value: 1 }] }))).toEqual([
            { kind: "randomOptionNotOfferedForItem", slot: "rightHand", position: 2, optionId: weapon.attack.id },
        ]);
        expect(issuesOf(withWeapon({ itemId: weapon.itemId, randomOptions: optionsAt(weapon.positionIndex, highest + 1) }))).toEqual([
            { kind: "randomOptionValueOutOfRange", slot: "rightHand", position: weapon.positionIndex + 1, optionId: weapon.attack.id, value: highest + 1 },
        ]);
    });

    it("survives being written as a ratorio save and read back, keeping its position", async () => {
        const build = withWeapon({ itemId: weapon.itemId, randomOptions: optionsAt(weapon.positionIndex, weapon.attack.range?.highest ?? 0) });
        const readSave = await engine.loadSaveReader();
        const writeSave = await engine.loadSaveWriter();

        const reimported = importRatorioSave(readSave(writeSave(exportRatorioSave(build, engine).content)), engine);

        expect(reimported).toEqual({ character: build.character, scenario: build.scenario, notImported: [] });
    });
});
