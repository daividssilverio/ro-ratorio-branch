import { beforeAll, describe, expect, it } from "vitest";
import { type ShadowEquipmentSlot, shadowEquipmentSlots } from "../character-vocabulary.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { exportRatorioSave } from "../sharing/export-ratorio-save.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import type { Build, GearPiece } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";

const undeadMonsterId = 1;
const regularArmorItemId = 4106;

const wearing = (slot: ShadowEquipmentSlot, gearPiece: GearPiece, build: Build): Build => ({
    ...build,
    character: { ...build.character, equipment: { ...build.character.equipment, [slot]: gearPiece } },
});

describe("shadow gear", () => {
    let engine: RatorioEngine;
    /** A plain attack by the first job upstream has shadow gear for in every slot, wearing nothing. */
    let bareBuild: Build;
    const firstItemFor = (slot: ShadowEquipmentSlot) => {
        const [firstItem] = engine.catalog.itemsForSlot(slot, bareBuild.character.jobId);
        if (firstItem === undefined) {
            throw new Error(`the engine offers the job nothing for ${slot}`);
        }
        return firstItem.id;
    };
    /** The first item of the job for the slot that takes enchants, with the first enchant of every socket that takes one. */
    const pieceWithEnchants = (slot: ShadowEquipmentSlot): { itemId: number; sockets: (number | null)[] } => {
        for (const item of engine.catalog.itemsForSlot(slot, bareBuild.character.jobId)) {
            const sockets = engine.catalog.socketChoicesOfItem(slot, item.id).map((choices) => choices[0]?.id ?? null);
            if (sockets.some((enchantId) => enchantId !== null)) {
                return { itemId: item.id, sockets };
            }
        }
        throw new Error(`the engine offers the job nothing for ${slot} that takes an enchant`);
    };
    /** A shadow weapon of the job with the highest roll of the first flat ATK option it offers, at the position it offers it. */
    const shadowWeaponWithAnOption = () => {
        for (const item of engine.catalog.itemsForSlot("shadowWeapon", bareBuild.character.jobId)) {
            const optionsOfPosition = engine.catalog.randomOptionsOfItem(item.id);
            const positionIndex = optionsOfPosition.findIndex((choices) => choices.some((choice) => /^atk\+$/i.test(choice.name)));
            const attack = optionsOfPosition[positionIndex]?.find((choice) => /^atk\+$/i.test(choice.name));
            if (attack?.range !== undefined) {
                return { itemId: item.id, randomOptions: [...Array.from({ length: positionIndex }, () => null), { optionId: attack.id, value: attack.range.highest }] };
            }
        }
        throw new Error("no shadow weapon of the job rolls a flat ATK option");
    };
    const issuesOf = (build: Build) => {
        try {
            convertBuildToCalcModel(build, engine);
            return [];
        } catch (error) {
            return error instanceof BuildConversionError ? error.issues : [];
        }
    };

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        const job = engine.catalog.jobs().find((candidate) => shadowEquipmentSlots.every((slot) => engine.catalog.itemsForSlot(slot, candidate.id).length > 0));
        if (job === undefined) {
            throw new Error("no job can wear shadow gear in every slot");
        }
        bareBuild = {
            formatVersion: 1,
            character: {
                jobId: job.id,
                baseLevel: engine.catalog.limitsOfJob(job.id)?.baseLevel.lowest ?? 1,
                jobLevel: 1,
                baseStats: { str: 99, agi: 1, vit: 1, int: 1, dex: 50, luk: 1 },
                equipment: {},
            },
            scenario: { skillId: engine.skillIds.basicAttack, skillLevel: 1, targetMonsterId: undeadMonsterId },
        };
    });

    it("is offered to some jobs and not to others, as upstream restricts it", () => {
        const jobIdsWithShadowWeapons = engine.catalog.jobs().filter((job) => engine.catalog.itemsForSlot("shadowWeapon", job.id).length > 0);

        expect(jobIdsWithShadowWeapons.length).toBeGreaterThan(0);
        expect(jobIdsWithShadowWeapons.length).toBeLessThan(engine.catalog.jobs().length);
    });

    it.each(shadowEquipmentSlots)("offers the job items for %s, and none of them fits a regular slot", (slot) => {
        const itemId = firstItemFor(slot);

        expect(engine.catalog.slotsOfItem(itemId)).toEqual([slot]);
    });

    it("puts the item and its refine into the model's shadow gear, by upstream region, and leaves the regular gear alone", () => {
        const plain = convertBuildToCalcModel(bareBuild, engine);
        const itemId = firstItemFor("shadowArmor");

        const calcModel = convertBuildToCalcModel(wearing("shadowArmor", { itemId, refine: 7 }, bareBuild), engine);

        const region = engine.calcModelLayout.equipPositionOfSlot.shadowArmor;
        expect(calcModel.shadowEquip.itemId[region]).toBe(itemId);
        expect(calcModel.shadowEquip.refined[region]).toBe(7);
        expect(calcModel.equip).toEqual(plain.equip);
    });

    it("puts its enchants into the three shadow positions of the slot", () => {
        const piece = pieceWithEnchants("shadowWeapon");

        const calcModel = convertBuildToCalcModel(wearing("shadowWeapon", piece, bareBuild), engine);

        const positions = engine.calcModelLayout.cardPositionsOfSlot.shadowWeapon;
        expect(positions).toHaveLength(3);
        expect(piece.sockets).toHaveLength(3);
        expect(positions.map((position) => calcModel.card[position])).toEqual(piece.sockets.map((enchantId) => enchantId ?? 0));
    });

    it("counts a random option on shadow gear, and leaves nothing behind", () => {
        const { itemId, randomOptions } = shadowWeaponWithAnOption();
        const damageOf = (gearPiece: GearPiece) => calculateBuild(wearing("shadowWeapon", gearPiece, bareBuild), engine).averageDamagePerAttack;
        const without = damageOf({ itemId });

        expect(without).toBeGreaterThan(0);
        expect(damageOf({ itemId, randomOptions })).toBeGreaterThan(without);
        expect(damageOf({ itemId })).toBe(without);
    });

    it("rejects a regular item in a shadow slot, a shadow item in a regular slot, and a transcended shadow piece", () => {
        const shadowArmorId = firstItemFor("shadowArmor");

        expect(issuesOf(wearing("shadowArmor", { itemId: regularArmorItemId }, bareBuild))).toEqual([{ kind: "itemDoesNotFitSlot", slot: "shadowArmor", itemId: regularArmorItemId }]);
        expect(issuesOf({ ...bareBuild, character: { ...bareBuild.character, equipment: { armor: { itemId: shadowArmorId } } } })).toEqual([
            { kind: "itemDoesNotFitSlot", slot: "armor", itemId: shadowArmorId },
        ]);
        expect(issuesOf(wearing("shadowArmor", { itemId: shadowArmorId, transcendence: 1 }, bareBuild))).toEqual([{ kind: "transcendenceNotSupported", slot: "shadowArmor" }]);
    });

    it("survives being written as a ratorio save and read back, on all six slots", async () => {
        const withoutEmptyEnd = (sockets: (number | null)[]) => sockets.slice(0, sockets.findLastIndex((enchantId) => enchantId !== null) + 1);
        const enchanted = pieceWithEnchants("shadowShoes");
        const dressed = shadowEquipmentSlots.reduce(
            (wearingSoFar, slot, index) => wearing(slot, { itemId: firstItemFor(slot), ...(index % 2 === 0 ? { refine: index + 1 } : {}) }, wearingSoFar),
            bareBuild,
        );
        const withEnchants = wearing("shadowShoes", { itemId: enchanted.itemId, refine: 4, sockets: withoutEmptyEnd(enchanted.sockets) }, dressed);
        const build = wearing("shadowWeapon", { ...shadowWeaponWithAnOption(), refine: 7 }, withEnchants);
        const readSave = await engine.loadSaveReader();
        const writeSave = await engine.loadSaveWriter();

        const reimported = importRatorioSave(readSave(writeSave(exportRatorioSave(build, engine).content)), engine);

        expect(reimported).toEqual({ character: build.character, scenario: build.scenario, notImported: [] });
    });
});
