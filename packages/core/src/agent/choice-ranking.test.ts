import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { Build } from "../build/build-format.ts";
import { calculateBuild } from "../build/calculate-build.ts";
import { parseBuild } from "../build/parse-build.ts";
import { buildWearingItem, buildWithSocketFilled } from "../build/wear-item.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { calculatorOn, evaluateTree } from "../tree/evaluate-tree.ts";
import { parseTree } from "../tree/parse-tree.ts";
import { buildOfNode, NoPieceInSlotError, rankSlotCandidates, rankSocketChoices, refineLevelsStartingEffects, UnusableNodeError, withRankingUnder } from "./choice-ranking.ts";

const mechanicBuild = parseBuild(JSON.parse(readFileSync(new URL("../build/golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));
const wornShoesId = 4685;
const someShoeIds = [3976, 5366, 5375, 4124];
const onlyThese = (itemIds: readonly number[]) => (itemId: number) => itemIds.includes(itemId);

describe("rankSlotCandidates", () => {
    let engine: RatorioEngine;
    const damagePerSecondOf = (build: Build) => calculateBuild(build, engine).averageDamagePerSecond;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("ranks by damage per second, and measures each item against the piece worn now without its cards", () => {
        const ranking = rankSlotCandidates(mechanicBuild, "shoes", engine, { matchesName: onlyThese(someShoeIds), limit: 10, branchCount: 0 });
        const baseline = damagePerSecondOf(buildWearingItem(mechanicBuild, "shoes", wornShoesId));

        expect(ranking.choices.map((candidate) => candidate.id).sort()).toEqual([...someShoeIds].sort());
        expect(ranking.choices.map((candidate) => candidate.averageDamagePerSecond)).toEqual(ranking.choices.map((candidate) => candidate.averageDamagePerSecond).sort((first, second) => second - first));
        for (const candidate of ranking.choices) {
            expect(candidate.averageDamagePerSecond).toBe(damagePerSecondOf(buildWearingItem(mechanicBuild, "shoes", candidate.id)));
            expect(candidate.damagePerSecondGain).toBeCloseTo(candidate.averageDamagePerSecond / baseline - 1, 10);
        }
        expect(ranking.baseline.averageDamagePerSecond).toBe(baseline);
        expect(ranking.current).toMatchObject({ id: wornShoesId, averageDamagePerSecond: damagePerSecondOf(mechanicBuild) });
    });

    it("leaves out the piece worn now, counts what it considered, and gives no more than the limit", () => {
        const ranking = rankSlotCandidates(mechanicBuild, "shoes", engine, { matchesName: onlyThese([wornShoesId, ...someShoeIds]), limit: 2, branchCount: 0 });

        expect(ranking.consideredCount).toBe(someShoeIds.length);
        expect(ranking.notCalculableCount).toBe(0);
        expect(ranking.choices).toHaveLength(2);
        expect(ranking.choices.map((candidate) => candidate.id)).not.toContain(wornShoesId);
    });

    it("keeps the items whose effects have every word of the effect query, and gives the lines they were found in", () => {
        const everyGarment = engine.catalog.itemsForSlot("garment", mechanicBuild.character.jobId).length;
        const ranking = rankSlotCandidates(mechanicBuild, "garment", engine, { effectQuery: "物理 大型", limit: 100, branchCount: 0 });

        expect(ranking.consideredCount).toBeGreaterThan(0);
        expect(ranking.consideredCount).toBeLessThan(everyGarment);
        for (const candidate of ranking.choices) {
            const lines = candidate.matchedEffects.join(" ");
            expect(lines).toContain("物理");
            expect(lines).toContain("大型");
        }
    });

    it("measures against the build as it is when nothing is worn in the slot", () => {
        const { shoes: _worn, ...withoutShoes } = mechanicBuild.character.equipment;
        const barefoot: Build = { ...mechanicBuild, character: { ...mechanicBuild.character, equipment: withoutShoes } };
        const ranking = rankSlotCandidates(barefoot, "shoes", engine, { matchesName: onlyThese(someShoeIds), limit: 10, branchCount: 0 });

        expect(ranking.current.id).toBeNull();
        expect(ranking.baseline).toEqual({ averageDamagePerSecond: ranking.current.averageDamagePerSecond, secondsToKill: ranking.current.secondsToKill });
        expect(ranking.consideredCount).toBe(someShoeIds.length);
    });

    it("gives a tree with the best ones as branches, which calculates to the same numbers", async () => {
        const ranking = rankSlotCandidates(mechanicBuild, "shoes", engine, { matchesName: onlyThese(someShoeIds), limit: 10, branchCount: 2 });
        const tree = parseTree(ranking.tree);
        const evaluation = await evaluateTree(tree, calculatorOn(engine));

        expect(tree.root).toEqual(mechanicBuild.character);
        expect(tree.nodes.map((node) => node.parentId)).toEqual([null, null]);
        for (const [index, node] of tree.nodes.entries()) {
            const evaluated = evaluation.nodes.get(node.id);
            expect(evaluated?.state === "ready" && evaluated.battleSummary.averageDamagePerSecond).toBe(ranking.choices[index]?.averageDamagePerSecond);
        }
    });
});

describe("rankSocketChoices", () => {
    let engine: RatorioEngine;
    const shieldCardId = 231;
    const someCardIds = [1262, 3773, shieldCardId];
    const castingEnchantIds = [1179, 1246];
    const damagePerSecondOf = (build: Build | null) => (build === null ? Number.NaN : calculateBuild(build, engine).averageDamagePerSecond);

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("ranks what one socket takes, each against the socket left empty, and leaves out what is in it now", () => {
        const ranking = rankSocketChoices(mechanicBuild, "shield", 0, engine, { matchesName: onlyThese(someCardIds), limit: 10, branchCount: 0 });
        const baseline = damagePerSecondOf(buildWithSocketFilled(mechanicBuild, "shield", 0, null));

        expect(ranking).toMatchObject({ slot: "shield", socketIndex: 0, itemId: 4936, current: { id: shieldCardId } });
        expect(ranking.baseline.averageDamagePerSecond).toBe(baseline);
        expect(ranking.choices.map((choice) => choice.id).sort()).toEqual([1262, 3773]);
        for (const choice of ranking.choices) {
            expect(choice.averageDamagePerSecond).toBe(damagePerSecondOf(buildWithSocketFilled(mechanicBuild, "shield", 0, choice.id)));
            expect(choice.damagePerSecondGain).toBeCloseTo(choice.averageDamagePerSecond / baseline - 1, 10);
        }
    });

    it("keeps only the choices with the effect asked for, and gives the lines it was found in", () => {
        const ranking = rankSocketChoices(mechanicBuild, "shield", 3, engine, { effectQuery: "詠唱", limit: 10, branchCount: 0 });

        expect(ranking.choices.map((choice) => choice.id).sort()).toEqual([...castingEnchantIds].sort());
        expect(ranking.choices.every((choice) => choice.matchedEffects.some((line) => line.includes("詠唱")))).toBe(true);
    });

    it("gives branches that change only that socket of the piece", () => {
        const ranking = rankSocketChoices(mechanicBuild, "shield", 3, engine, { effectQuery: "詠唱", limit: 10, branchCount: 1 });
        const [branch] = parseTree(ranking.tree).nodes;

        expect(branch?.changes).toEqual([{ kind: "setGearPiece", slot: "shield", gearPiece: { itemId: 4936, refine: 7, sockets: [shieldCardId, null, null, ranking.choices[0]?.id] } }]);
    });

    it("ranks on the piece without any cards or enchants when asked, the one held now included", () => {
        const wornShoes = mechanicBuild.character.equipment.shoes;
        const ranking = rankSocketChoices(mechanicBuild, "shoes", 3, engine, { emptyOtherSockets: true, limit: 50, branchCount: 1 });
        const bareShoes: Build = { ...mechanicBuild, character: { ...mechanicBuild.character, equipment: { ...mechanicBuild.character.equipment, shoes: { itemId: wornShoesId, refine: 9 } } } };

        expect(wornShoes?.sockets?.[3]).not.toBeNull();
        expect(ranking.current.id).toBe(wornShoes?.sockets?.[3]);
        expect(ranking.choices.map((choice) => choice.id)).toContain(wornShoes?.sockets?.[3]);
        expect(ranking.baseline.averageDamagePerSecond).toBe(damagePerSecondOf(bareShoes));
        const [best] = ranking.choices;
        expect(best?.averageDamagePerSecond).toBe(damagePerSecondOf(buildWithSocketFilled(bareShoes, "shoes", 3, best?.id ?? 0)));
        expect(parseTree(ranking.tree).nodes[0]?.changes).toEqual([{ kind: "setGearPiece", slot: "shoes", gearPiece: { itemId: wornShoesId, refine: 9, sockets: [null, null, null, best?.id] } }]);
    });

    it("refuses a slot with nothing worn in it", () => {
        const { shield: _worn, ...withoutShield } = mechanicBuild.character.equipment;
        const withoutAShield: Build = { ...mechanicBuild, character: { ...mechanicBuild.character, equipment: withoutShield } };

        expect(() => rankSocketChoices(withoutAShield, "shield", 0, engine, { limit: 10, branchCount: 0 })).toThrow(NoPieceInSlotError);
    });
});

describe("starting from a node of a tree", () => {
    let engine: RatorioEngine;
    const tree = {
        formatVersion: 1 as const,
        scenario: mechanicBuild.scenario,
        root: mechanicBuild.character,
        nodes: [
            { id: "branch-1", parentId: null, label: "STR 130", changes: [{ kind: "setBaseStat" as const, stat: "str" as const, value: 130 }] },
            { id: "stale", parentId: null, label: "old", changes: [{ kind: "setRefine" as const, slot: "shoes" as const, expectedItemId: 1, refine: 10 }] },
        ],
    };

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("takes the build the node stands for, with the tree's scenario", () => {
        expect(buildOfNode(tree, "branch-1").character.baseStats.str).toBe(130);
        expect(buildOfNode(tree, "branch-1").scenario).toEqual(mechanicBuild.scenario);
        expect(buildOfNode(tree, null).character).toEqual(mechanicBuild.character);
    });

    it("refuses a node the tree does not have, and one that names an item its parent does not wear", () => {
        expect(() => buildOfNode(tree, "nobody")).toThrow(UnusableNodeError);
        expect(() => buildOfNode(tree, "stale")).toThrow(UnusableNodeError);
    });

    it("puts the ranking's branches under the node, and they calculate to the ranking's numbers", async () => {
        const ranking = rankSlotCandidates(buildOfNode(tree, "branch-1"), "shoes", engine, { matchesName: onlyThese(someShoeIds), limit: 10, branchCount: 2 });
        const grown = parseTree(withRankingUnder(tree, "branch-1", ranking));
        const evaluation = await evaluateTree(grown, calculatorOn(engine));
        const added = grown.nodes.slice(tree.nodes.length);

        expect(added.map((node) => node.parentId)).toEqual(["branch-1", "branch-1"]);
        for (const [index, node] of added.entries()) {
            const evaluated = evaluation.nodes.get(node.id);
            expect(evaluated?.state === "ready" && evaluated.battleSummary.averageDamagePerSecond).toBe(ranking.choices[index]?.averageDamagePerSecond);
        }
    });
});

describe("refine levels", () => {
    let engine: RatorioEngine;
    const shieldId = 4936;
    const damagePerSecondOf = (build: Build) => calculateBuild(build, engine).averageDamagePerSecond;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("reads the levels at which an item's effects start, and none for one that cannot be refined", () => {
        expect(refineLevelsStartingEffects(engine.catalog.effectsOfItem(shieldId))).toEqual([6, 8, 10]);
        expect(refineLevelsStartingEffects(["精錬値9以上の時、ATK + 10", "精錬値が11の時、MATK + 5", "精錬値が1上がる度に追加でATK + 2"])).toEqual([9, 11]);
        expect(refineLevelsStartingEffects(["精錬不可能", "精錬値が7以上の時、ATK + 10"])).toBeNull();
    });

    it("tries the best items at the levels asked for and where their effects start, leaving out the refine they already have", () => {
        const { shield: _shield, ...withoutShield } = mechanicBuild.character.equipment;
        const withPlainShield: Build = { ...mechanicBuild, character: { ...mechanicBuild.character, equipment: { ...withoutShield, shield: { itemId: 2101, refine: 7 } } } };
        const ranking = rankSlotCandidates(withPlainShield, "shield", engine, { matchesName: onlyThese([shieldId]), limit: 1, branchCount: 0, refineLevels: [7, 9] });
        const [choice] = ranking.choices;

        expect(choice?.id).toBe(shieldId);
        expect(choice?.byRefine?.map((option) => [option.refine, option.startsAnEffect])).toEqual([
            [6, true],
            [8, true],
            [9, false],
            [10, true],
        ]);
        for (const option of choice?.byRefine ?? []) {
            const atRefine: Build = { ...withPlainShield, character: { ...withPlainShield.character, equipment: { ...withPlainShield.character.equipment, shield: { itemId: shieldId, refine: option.refine } } } };
            expect(option.averageDamagePerSecond).toBe(damagePerSecondOf(atRefine));
        }
    });

    it("gives each branch a child per refine level, which calculates to the same numbers", async () => {
        const ranking = rankSlotCandidates(mechanicBuild, "shoes", engine, { matchesName: onlyThese(someShoeIds), limit: 1, branchCount: 1, refineLevels: [7] });
        const tree = parseTree(ranking.tree);
        const evaluation = await evaluateTree(tree, calculatorOn(engine));
        const [branch, ...refineChildren] = tree.nodes;
        const [choice] = ranking.choices;

        expect(refineChildren.length).toBe(choice?.byRefine?.length);
        expect(refineChildren.every((child) => child.parentId === branch?.id)).toBe(true);
        for (const [index, child] of refineChildren.entries()) {
            const evaluated = evaluation.nodes.get(child.id);
            expect(evaluated?.state === "ready" && evaluated.battleSummary.averageDamagePerSecond).toBe(choice?.byRefine?.[index]?.averageDamagePerSecond);
        }
    });

    it("keeps to the highest refine asked for: compares at it when the piece worn now is higher, and tries nothing above it", () => {
        const ranking = rankSlotCandidates(mechanicBuild, "shoes", engine, { matchesName: onlyThese(someShoeIds), limit: 4, branchCount: 1, refineLevels: [4, 7, 9], highestRefine: 7 });
        const wornAtSeven: Build = { ...mechanicBuild, character: { ...mechanicBuild.character, equipment: { ...mechanicBuild.character.equipment, shoes: { itemId: wornShoesId, refine: 7 } } } };

        expect(ranking.baseline.averageDamagePerSecond).toBe(damagePerSecondOf(wornAtSeven));
        for (const choice of ranking.choices) {
            expect(choice.averageDamagePerSecond).toBe(damagePerSecondOf({ ...wornAtSeven, character: { ...wornAtSeven.character, equipment: { ...wornAtSeven.character.equipment, shoes: { itemId: choice.id, refine: 7 } } } }));
            expect((choice.byRefine ?? []).every((option) => option.refine <= 7 && option.refine !== 7)).toBe(true);
            expect(choice.byRefine?.map((option) => option.refine)).toContain(4);
        }
        expect(parseTree(ranking.tree).nodes[0]?.changes).toEqual([{ kind: "setGearPiece", slot: "shoes", gearPiece: { itemId: ranking.choices[0]?.id, refine: 7 } }]);
    });

    it("tries no other levels for a slot that takes no refine", () => {
        const ranking = rankSlotCandidates(mechanicBuild, "accessory1", engine, { effectQuery: "物理 大型", limit: 2, branchCount: 0, refineLevels: [7] });

        expect(ranking.choices.every((choice) => choice.byRefine === undefined)).toBe(true);
    });
});
