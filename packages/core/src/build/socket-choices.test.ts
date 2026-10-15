import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { EquipmentSlot } from "../character-vocabulary.ts";
import type { CatalogEntry } from "../engine-adapter/engine-catalog.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { Build, GearPiece } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError, convertBuildToCalcModel } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const goldenBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
// The two items upstream gives a card of their slot in the last socket.
const itemIdsWithACardInTheLastSocket = [4508, 4509];

const idsOf = (entries: readonly CatalogEntry[]) => entries.map((entry) => entry.id);
const wearing = (slot: EquipmentSlot, gearPiece: GearPiece): Build => ({
    ...goldenBuild,
    character: { ...goldenBuild.character, equipment: { ...goldenBuild.character.equipment, [slot]: gearPiece } },
});

describe("what the sockets of an item take", () => {
    let engine: RatorioEngine;
    const { jobId } = goldenBuild.character;
    const choicesOf = (slot: EquipmentSlot, itemId: number) => engine.catalog.socketChoicesOfItem(slot, itemId);
    /** The job's first item for the slot whose sockets fit the description. */
    const firstItemWhere = (slot: EquipmentSlot, fits: (choicesOfSocket: CatalogEntry[][]) => boolean): number => {
        const item = engine.catalog.itemsForSlot(slot, jobId).find((candidate) => fits(choicesOf(slot, candidate.id)));
        if (item === undefined) {
            throw new Error(`the engine offers the job no such item for ${slot}`);
        }
        return item.id;
    };
    const hasNoEnchants = (choicesOfSocket: CatalogEntry[][]) => choicesOfSocket.every((choices) => choices.every((choice) => choice.detail === undefined));
    const hasEnchantsAt = (socketIndex: number) => (choicesOfSocket: CatalogEntry[][]) => (choicesOfSocket[socketIndex] ?? []).some((choice) => choice.detail !== undefined);
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

    it("gives armor without enchants a card in its first socket only", () => {
        for (const slot of ["headTop", "headMid", "shield", "armor", "garment", "shoes", "accessory1", "accessory2"] as const) {
            const socketSizes = choicesOf(slot, firstItemWhere(slot, hasNoEnchants)).map((choices) => choices.length);

            expect(socketSizes[0]).toBeGreaterThan(10);
            expect(socketSizes.slice(1)).toEqual([0, 0, 0]);
        }
    });

    it("gives the lower headgear no card at all", () => {
        expect(choicesOf("headLow", firstItemWhere("headLow", hasNoEnchants)).map((choices) => choices.length)).toEqual([0, 0, 0, 0]);
    });

    it("gives a weapon a card in all four sockets, the first one with a few entries of its own", () => {
        const [first = [], second = [], third = [], fourth = []] = choicesOf("rightHand", firstItemWhere("rightHand", hasNoEnchants)).map(idsOf);

        expect(second.length).toBeGreaterThan(10);
        expect(third).toEqual(second);
        expect(fourth).toEqual(second);
        expect(first.length).toBeGreaterThan(second.length);
        expect(first).toEqual(expect.arrayContaining(second));
    });

    it("never lists the same card twice in a socket, nor card 0", () => {
        for (const slot of ["rightHand", "headTop", "accessory1"] as const) {
            for (const choices of choicesOf(slot, firstItemWhere(slot, hasNoEnchants))) {
                expect(new Set(idsOf(choices)).size).toBe(choices.length);
                expect(idsOf(choices)).not.toContain(0);
            }
        }
    });

    it("hands a socket over to the item's own enchants, which are not cards of the slot", () => {
        const lastSocket = 3;
        const itemId = firstItemWhere("armor", hasEnchantsAt(lastSocket));
        const enchantIds = idsOf(choicesOf("armor", itemId)[lastSocket] ?? []);
        const cardIds = new Set(idsOf(choicesOf("armor", firstItemWhere("armor", hasNoEnchants))[0] ?? []));

        expect(enchantIds.length).toBeGreaterThan(0);
        expect(enchantIds.filter((enchantId) => cardIds.has(enchantId))).toEqual([]);
        expect(engine.catalog.socketChoicesOfItem("armor", itemId)).toHaveLength(4);
    });

    it("gives two items a card of their slot in the last socket", () => {
        for (const itemId of itemIdsWithACardInTheLastSocket) {
            const [slot] = engine.catalog.slotsOfItem(itemId);
            expect(slot).toBeDefined();
            if (slot === undefined) {
                continue;
            }
            const cardsOfTheSlot = idsOf(choicesOf(slot, firstItemWhere(slot, hasNoEnchants))[0] ?? []);

            expect(cardsOfTheSlot.length).toBeGreaterThan(10);
            expect(idsOf(choicesOf(slot, itemId)[3] ?? [])).toEqual(cardsOfTheSlot);
        }
    });

    it("gives shadow gear three sockets and no cards", () => {
        const jobWithShadowGear = engine.catalog.jobs().find((job) => engine.catalog.itemsForSlot("shadowArmor", job.id).length > 0);
        const [shadowArmor] = engine.catalog.itemsForSlot("shadowArmor", jobWithShadowGear?.id ?? -1);
        const choicesOfSocket = choicesOf("shadowArmor", shadowArmor?.id ?? -1);

        expect(choicesOfSocket).toHaveLength(3);
        expect(choicesOfSocket.flat().filter((choice) => choice.detail === undefined)).toEqual([]);
    });

    it("lets the converter take a card where the item takes it, and reports it anywhere else", () => {
        const itemId = firstItemWhere("armor", hasNoEnchants);
        const [card] = choicesOf("armor", itemId)[0] ?? [];
        const [weaponCard] = choicesOf("rightHand", firstItemWhere("rightHand", hasNoEnchants))[1] ?? [];
        const cardId = card?.id ?? 0;
        const weaponCardId = weaponCard?.id ?? 0;

        const calcModel = convertBuildToCalcModel(wearing("armor", { itemId, sockets: [cardId] }), engine);
        expect(calcModel.card[engine.calcModelLayout.cardPositionsOfSlot.armor[0] ?? -1]).toBe(cardId);

        expect(issuesOf(wearing("armor", { itemId, sockets: [weaponCardId, cardId] }))).toEqual([
            { kind: "cardOrEnchantNotOfferedForItem", slot: "armor", socket: 1, cardOrEnchantId: weaponCardId },
            { kind: "cardOrEnchantNotOfferedForItem", slot: "armor", socket: 2, cardOrEnchantId: cardId },
        ]);
    });
});
