import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { savesMadeOnTheOriginal } from "../sharing/golden-save-urls.ts";
import { importRatorioSave } from "../sharing/import-ratorio-save.ts";
import type { Build } from "./build-format.ts";
import { calculateBuild } from "./calculate-build.ts";
import { BuildConversionError } from "./convert-build.ts";
import { parseBuild } from "./parse-build.ts";

const mechanicBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));

// ratorio job IDs.
const assassinLineJobIds = [8, 22, 47, 67];
const ninjaJobIdsThatWieldTwo = [59, 60, 81, 82];
const jobIdsThatWieldOne = [44, 14, 51, 7, 0];
const guillotineCrossJobId = 47;
const kageroJobId = 59;

describe("the left hand", () => {
    let engine: RatorioEngine;
    /** A character with a dagger in each hand, as saved on the original page. */
    let twoDaggers: Build;
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
    const wearing = (build: Build, equipment: Build["character"]["equipment"]): Build => ({
        ...build,
        character: { ...build.character, equipment: { ...build.character.equipment, ...equipment } },
    });
    /** The job's right-hand weapons next to which it gets no left hand. */
    const rightHandWeaponsThatTakeBothHands = (jobId: number) =>
        engine.catalog.itemsForSlot("rightHand", jobId).filter((item) => engine.catalog.leftHandItemKindsOfJob(jobId, item.id).length === 0);

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        const readSave = await engine.loadSaveReader();
        const { character, scenario } = importRatorioSave(readSave(savesMadeOnTheOriginal["guillotine-cross-two-daggers-endow"]?.url ?? ""), engine);
        if (scenario === null) {
            throw new Error("the save has no scenario");
        }
        twoDaggers = { formatVersion: 1, character, scenario };
    });

    it("is for the assassin line with three kinds of weapon, for four ninja jobs with one of those, and for nobody else", () => {
        const kindsOf = (jobId: number) => engine.catalog.leftHandItemKindsOfJob(jobId);
        const assassinKinds = kindsOf(guillotineCrossJobId);

        expect(assassinKinds).toHaveLength(3);
        expect(assassinLineJobIds.map(kindsOf)).toEqual(assassinLineJobIds.map(() => assassinKinds));
        expect(kindsOf(kageroJobId)).toHaveLength(1);
        expect(assassinKinds).toContain(kindsOf(kageroJobId)[0]);
        expect(ninjaJobIdsThatWieldTwo.map(kindsOf)).toEqual(ninjaJobIdsThatWieldTwo.map(() => kindsOf(kageroJobId)));
        expect(jobIdsThatWieldOne.map(kindsOf)).toEqual(jobIdsThatWieldOne.map(() => []));
        expect(kindsOf(999_999)).toEqual([]);
    });

    it("offers a job only left-hand items of its kinds, and a job that wields one weapon none", () => {
        for (const jobId of [guillotineCrossJobId, kageroJobId]) {
            const kinds = engine.catalog.leftHandItemKindsOfJob(jobId);
            const items = engine.catalog.itemsForSlot("leftHand", jobId);

            expect(items.length).toBeGreaterThan(0);
            expect(items.filter((item) => !kinds.includes(engine.itemKind(item.id)))).toEqual([]);
        }
        expect(new Set(engine.catalog.itemsForSlot("leftHand", guillotineCrossJobId).map((item) => engine.itemKind(item.id))).size).toBe(3);
        expect(jobIdsThatWieldOne.map((jobId) => engine.catalog.itemsForSlot("leftHand", jobId).length)).toEqual(jobIdsThatWieldOne.map(() => 0));
    });

    it("fits a left-hand kind into both hands and any other weapon into the right hand only", () => {
        const [dagger] = engine.catalog.itemsForSlot("leftHand", kageroJobId);
        const rightHandItemId = mechanicBuild.character.equipment.rightHand?.itemId ?? -1;

        expect(engine.catalog.slotsOfItem(dagger?.id ?? -1)).toEqual(["rightHand", "leftHand"]);
        expect(engine.catalog.slotsOfItem(rightHandItemId)).toEqual(["rightHand"]);
    });

    it("is taken away by one kind of right-hand weapon, a different one for each of the two groups", () => {
        const kindsThatTakeBothHands = (jobId: number) => [...new Set(rightHandWeaponsThatTakeBothHands(jobId).map((item) => engine.itemKind(item.id)))];
        const forAnAssassin = kindsThatTakeBothHands(guillotineCrossJobId);
        const forANinja = kindsThatTakeBothHands(kageroJobId);

        expect(forAnAssassin).toHaveLength(1);
        expect(forANinja).toHaveLength(1);
        expect(forAnAssassin).not.toEqual(forANinja);
    });

    it("lets the converter take the two daggers saved on the original, and reports every way of breaking the rule", () => {
        const [shield] = engine.catalog.itemsForSlot("shield", guillotineCrossJobId);
        const [weaponThatTakesBothHands] = rightHandWeaponsThatTakeBothHands(guillotineCrossJobId);
        const leftHandItemId = twoDaggers.character.equipment.leftHand?.itemId ?? -1;
        const bothHandsItemId = weaponThatTakesBothHands?.id ?? -1;

        expect(issuesOf(twoDaggers)).toEqual([]);
        expect(issuesOf(wearing(twoDaggers, { shield: { itemId: shield?.id ?? -1 } }))).toEqual([{ kind: "shieldWithLeftHandWeapon" }]);
        expect(issuesOf(wearing(twoDaggers, { rightHand: { itemId: bothHandsItemId } }))).toEqual([{ kind: "leftHandNotOfferedWithRightHand", rightHandItemId: bothHandsItemId }]);
        expect(issuesOf(wearing(mechanicBuild, { leftHand: { itemId: leftHandItemId } }))).toContainEqual({ kind: "leftHandNotOfferedToJob", itemId: leftHandItemId });
    });
});
