import type { Build, BuildOutcome } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { type DamagePreview, damagePreviewOf, orderedByPreview } from "./damage-preview-model.ts";

const build: Build = {
    formatVersion: 1,
    character: {
        jobId: 51,
        baseLevel: 200,
        jobLevel: 70,
        baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
        equipment: { rightHand: { itemId: 4411, refine: 10, transcendence: 2, sockets: [1262, null] }, accessory1: { itemId: 9, refine: 3 } },
    },
    scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 100 },
};
const outcomeDealing = (averageDamagePerSecond: number) =>
    ({ state: "ready", battleSummary: { targetMonsterId: 100, averageDamagePerAttack: 1, averageDamagePerSecond, averageTimeToKill: null } }) as unknown as BuildOutcome;
const notCalculable: BuildOutcome = { state: "notCalculable", issues: [] };

describe("damagePreviewOf", () => {
    it("gives both numbers when both builds calculate", () => {
        expect(damagePreviewOf(outcomeDealing(1000), outcomeDealing(1059))).toEqual({ state: "ready", damagePerSecond: 1059, baselineDamagePerSecond: 1000 });
    });

    it.each([
        { situation: "the build with the choice does not calculate", baseline: outcomeDealing(1000), withChoice: notCalculable },
        { situation: "the build without it does not calculate", baseline: notCalculable, withChoice: outcomeDealing(1000) },
        { situation: "the build without it deals no damage", baseline: outcomeDealing(0), withChoice: outcomeDealing(1000) },
    ])("has nothing to show when $situation", ({ baseline, withChoice }) => {
        expect(damagePreviewOf(baseline, withChoice)).toEqual({ state: "unavailable" });
    });
});

describe("orderedByPreview", () => {
    const ready = (damagePerSecond: number): DamagePreview => ({ state: "ready", damagePerSecond, baselineDamagePerSecond: 1000 });

    it("puts the highest damage first once every row has a preview, rows without a number last in their order", () => {
        const previews: Record<string, DamagePreview> = { a: ready(900), b: { state: "unavailable" }, c: ready(1200), d: ready(900), e: { state: "unavailable" } };

        expect(orderedByPreview(["a", "b", "c", "d", "e"], (row) => previews[row])).toEqual(["c", "a", "d", "b", "e"]);
    });

    it("keeps the order while a preview is still missing or being calculated", () => {
        expect(orderedByPreview(["a", "b"], (row) => (row === "a" ? ready(1) : undefined))).toEqual(["a", "b"]);
        expect(orderedByPreview(["a", "b"], (row) => (row === "a" ? ready(1) : { state: "calculating" }))).toEqual(["a", "b"]);
    });
});
