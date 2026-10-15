import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import type { Build } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
const goldenDamagePerSecond = 6507149;
const fireElementId = 3;
const holyElementId = 6;
const undeadMonsterId = 1;
const plainArrowId = 1;

const withCharacter = (fields: Partial<Build["character"]>): Build => ({ ...goldenBuild, character: { ...goldenBuild.character, ...fields } });

describe("weapon element and arrow", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("writes the endowed element and the arrow into the model, and leaves the baseline without them", () => {
        const plain = convertBuildToCalcModel(goldenBuild, engine);
        const changed = convertBuildToCalcModel(withCharacter({ weaponElement: fireElementId, arrowId: plainArrowId }), engine);

        expect([plain.weapon.zokusei, plain.arrow]).toEqual([0, 0]);
        expect([changed.weapon.zokusei, changed.arrow]).toEqual([fireElementId, plainArrowId]);
    });

    it("changes the damage of a plain attack with the element, and leaves nothing behind", () => {
        // Arms Cannon takes its element from the cannonball, so the endow shows on a plain attack only.
        // Monster 1 is undead: holy hurts it more than fire, and fire more than no endow.
        const plainAttack = (weaponElement: number): Build => ({
            ...withCharacter(weaponElement === 0 ? {} : { weaponElement }),
            scenario: { skillId: engine.skillIds.basicAttack, skillLevel: 1, targetMonsterId: undeadMonsterId },
        });
        const damageOf = (weaponElement: number) => calculateBuild(plainAttack(weaponElement), engine).averageDamagePerAttack;
        const withoutEndow = damageOf(0);

        expect(withoutEndow).toBeGreaterThan(0);
        expect(damageOf(fireElementId)).toBeGreaterThan(withoutEndow);
        expect(damageOf(holyElementId)).toBeGreaterThan(damageOf(fireElementId));
        expect(damageOf(0)).toBe(withoutEndow);
        expect(calculateBuild(goldenBuild, engine).averageDamagePerSecond).toBe(goldenDamagePerSecond);
    });

    it("reports an element and an arrow the engine does not have", () => {
        let issues: BuildConversionError["issues"] = [];
        try {
            calculateBuild(withCharacter({ weaponElement: 99, arrowId: 999_999 }), engine);
        } catch (error) {
            issues = error instanceof BuildConversionError ? error.issues : [];
        }

        expect(issues).toEqual([
            { kind: "unknownWeaponElement", elementId: 99 },
            { kind: "unknownArrow", arrowId: 999_999 },
        ]);
    });

    it("names and lists ten elements and the arrows", () => {
        expect(engine.catalog.weaponElements().map((element) => element.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(engine.catalog.weaponElements().every((element) => element.name.length > 0)).toBe(true);
        expect(engine.hasArrow(0)).toBe(false);
    });

    it("offers arrows to the archer and thief lines, bullets to the gunslinger line, and nothing to anyone else", () => {
        const archerJobId = 4;
        const thiefJobId = 2;
        const gunslingerJobId = engine.catalog.jobs().find((job) => job.name === "ガンスリンガー")?.id ?? -1;
        const idsFor = (jobId: number) => engine.catalog.arrowsOfJob(jobId).map((arrow) => arrow.id);
        const bulletId = 26;

        expect(idsFor(archerJobId)).toContain(plainArrowId);
        expect(idsFor(archerJobId)).not.toContain(bulletId);
        expect(idsFor(thiefJobId)).toEqual(idsFor(archerJobId));
        expect(idsFor(gunslingerJobId)).toContain(bulletId);
        expect(idsFor(gunslingerJobId)).not.toContain(plainArrowId);
        expect(idsFor(goldenBuild.character.jobId)).toEqual([]);
        expect(idsFor(999_999)).toEqual([]);
        expect(idsFor(archerJobId)).not.toContain(0);
    });

    describe("an element a random option gives the weapon", () => {
        const withWeaponElement = (element: number, characterFields: Partial<Build["character"]> = {}): Build => {
            const rightHand = goldenBuild.character.equipment.rightHand;
            if (rightHand === undefined) {
                throw new Error("the golden build has no weapon");
            }
            return withCharacter({ ...characterFields, equipment: { ...goldenBuild.character.equipment, rightHand: { ...rightHand, element } } });
        };
        const asPlainAttack = (build: Build): Build => ({ ...build, scenario: { skillId: engine.skillIds.basicAttack, skillLevel: 1, targetMonsterId: undeadMonsterId } });

        it("attacks as the same element endowed on the character does", () => {
            expect(calculateBuild(asPlainAttack(withWeaponElement(holyElementId)), engine)).toEqual(calculateBuild(asPlainAttack(withCharacter({ weaponElement: holyElementId })), engine));
            expect(convertBuildToCalcModel(withWeaponElement(holyElementId), engine).weapon.zokusei).toBe(holyElementId);
        });

        it("gives way to an element the character is endowed with", () => {
            expect(convertBuildToCalcModel(withWeaponElement(holyElementId, { weaponElement: fireElementId }), engine).weapon.zokusei).toBe(fireElementId);
        });

        it("is carried by a ratorio save as the endowment, the only place the original has for it", async () => {
            const readSave = await engine.loadSaveReader();
            const writeSave = await engine.loadSaveWriter();
            const reimported = importRatorioSave(readSave(writeSave(exportRatorioSave(withWeaponElement(holyElementId), engine).content)), engine);

            expect(reimported.character.weaponElement).toBe(holyElementId);
            expect(calculateBuild(asPlainAttack({ ...goldenBuild, character: reimported.character }), engine)).toEqual(calculateBuild(asPlainAttack(withWeaponElement(holyElementId)), engine));
        });
    });

    it("survives being written as a ratorio save and read back", async () => {
        const build = withCharacter({ weaponElement: fireElementId, arrowId: plainArrowId });
        const readSave = await engine.loadSaveReader();
        const writeSave = await engine.loadSaveWriter();

        const reimported = importRatorioSave(readSave(writeSave(exportRatorioSave(build, engine).content)), engine);

        expect(reimported).toEqual({ character: build.character, scenario: build.scenario, notImported: [] });
    });
});
