import { describe, expect, it } from "vitest";
import type { Build } from "../build/build-format.ts";
import { type BuildCalculator, type BuildOutcome, evaluateTree } from "../tree/evaluate-tree.ts";
import type { Change } from "../tree/tree-format.ts";
import { mechanicBuild, mechanicTreeWith, refineMaceToTen, treeNode } from "../tree/tree-test-support.ts";
import { canonicalJson, rememberOutcomes } from "./remember-outcomes.ts";

const raiseStrength = { kind: "setBaseStat", stat: "str", value: 130 } satisfies Change;

function countingCalculator() {
    const calculatedBuilds: Build[] = [];
    const calculate: BuildCalculator = (build) => {
        calculatedBuilds.push(build);
        const outcome: BuildOutcome = {
            state: "ready",
            battleSummary: {
                targetMonsterId: build.scenario.targetMonsterId,
                averageDamagePerAttack: build.character.baseStats.str,
                averageDamagePerSecond: build.character.baseStats.str,
                averageTimeToKill: null,
            },
            statSnapshot: { stats: {}, bonuses: {} },
        };
        return outcome;
    };
    return { calculate, calculatedBuilds };
}

describe("rememberOutcomes", () => {
    it("calculates a build once, however often it is asked for", async () => {
        const { calculate, calculatedBuilds } = countingCalculator();
        const remembering = rememberOutcomes(calculate);

        const first = await remembering(mechanicBuild);
        const second = await remembering(mechanicBuild);

        expect(calculatedBuilds).toHaveLength(1);
        expect(second).toBe(first);
    });

    it("recognises an equal build whose fields were assembled in another order", async () => {
        const { calculate, calculatedBuilds } = countingCalculator();
        const remembering = rememberOutcomes(calculate);
        const { scenario, character, formatVersion } = mechanicBuild;

        await remembering(mechanicBuild);
        await remembering({ scenario, character, formatVersion });

        expect(calculatedBuilds).toHaveLength(1);
    });

    it("after an edit, calculates only the edited node and the nodes below it", async () => {
        const { calculate, calculatedBuilds } = countingCalculator();
        const remembering = rememberOutcomes(calculate);
        const tree = mechanicTreeWith([
            treeNode("refine", null, [refineMaceToTen]),
            treeNode("below-refine", "refine", [raiseStrength]),
            treeNode("untouched", null, [{ kind: "setBaseStat", stat: "agi", value: 120 }]),
        ]);
        await evaluateTree(tree, remembering);
        const buildsBeforeTheEdit = calculatedBuilds.length;

        const editedTree = mechanicTreeWith([
            treeNode("refine", null, [{ ...refineMaceToTen, refine: 11 }]),
            ...tree.nodes.slice(1),
        ]);
        await evaluateTree(editedTree, remembering);

        expect(buildsBeforeTheEdit).toBe(4);
        const recalculated = calculatedBuilds.slice(buildsBeforeTheEdit);
        expect(recalculated.map((build) => build.character.equipment.rightHand?.refine)).toEqual([11, 11]);
    });

    it("calculates everything again when the scenario changes", async () => {
        const { calculate, calculatedBuilds } = countingCalculator();
        const remembering = rememberOutcomes(calculate);
        const tree = mechanicTreeWith([treeNode("refine", null, [refineMaceToTen])]);
        await evaluateTree(tree, remembering);

        await evaluateTree({ ...tree, scenario: { ...tree.scenario, targetMonsterId: 837 } }, remembering);

        expect(calculatedBuilds).toHaveLength(4);
    });

    it("forgets the least recently used build beyond its limit", async () => {
        const { calculate, calculatedBuilds } = countingCalculator();
        const remembering = rememberOutcomes(calculate, 2);
        const buildWithStrength = (str: number): Build => ({
            ...mechanicBuild,
            character: { ...mechanicBuild.character, baseStats: { ...mechanicBuild.character.baseStats, str } },
        });

        await remembering(buildWithStrength(1));
        await remembering(buildWithStrength(2));
        await remembering(buildWithStrength(1));
        await remembering(buildWithStrength(3));
        await remembering(buildWithStrength(1));
        await remembering(buildWithStrength(2));

        expect(calculatedBuilds.map((build) => build.character.baseStats.str)).toEqual([1, 2, 3, 2]);
    });

    it("does not remember a calculation that failed", async () => {
        let attempts = 0;
        const remembering = rememberOutcomes(() => {
            attempts += 1;
            throw new RangeError("engine host lost");
        });

        await expect(remembering(mechanicBuild)).rejects.toThrow(RangeError);
        await expect(remembering(mechanicBuild)).rejects.toThrow(RangeError);

        expect(attempts).toBe(2);
    });
});

describe("canonicalJson", () => {
    it("orders object keys and keeps array order", () => {
        expect(canonicalJson({ b: [2, 1], a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":[2,1]}');
    });
});
