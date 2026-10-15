import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { type BuildCalculator, calculatorOn, evaluateTree } from "./evaluate-tree.ts";
import { breakDownPath, pathToNode, type PathStep } from "./path-breakdown.ts";
import type { Change, Tree } from "./tree-format.ts";
import { anotherWeaponItemId, mechanicTreeWith, refineMaceToTen, treeNode } from "./tree-test-support.ts";

const raiseStrength = { kind: "setBaseStat", stat: "str", value: 130 } satisfies Change;
const mechanicRootDamagePerSecond = 6507149;

const gainOf = (step: PathStep | undefined) => (step?.damagePerSecondAfter ?? NaN) - (step?.damagePerSecondBefore ?? NaN);

describe("pathToNode", () => {
    it("lists the nodes from just under the root down to the node itself", () => {
        const tree = mechanicTreeWith([
            treeNode("first", null, []),
            treeNode("second", "first", []),
            treeNode("elsewhere", null, []),
        ]);

        expect(pathToNode(tree, "second").map((node) => node.id)).toEqual(["first", "second"]);
    });
});

describe("breakDownPath", () => {
    let calculate: BuildCalculator;

    beforeAll(async () => {
        calculate = calculatorOn(await loadRatorioEngine());
    }, 60_000);

    async function breakDown(tree: Tree, nodeId: string) {
        return breakDownPath(tree, await evaluateTree(tree, calculate), nodeId);
    }

    it("measures each step against the step before it, starting from the root", async () => {
        const tree = mechanicTreeWith([
            treeNode("refine", null, [refineMaceToTen], 300_000_000),
            treeNode("refine-then-strength", "refine", [raiseStrength]),
        ]);

        const steps = await breakDown(tree, "refine-then-strength");

        expect(steps?.map((step) => step.nodeId)).toEqual(["refine", "refine-then-strength"]);
        expect(steps?.[0]?.damagePerSecondBefore).toBe(mechanicRootDamagePerSecond);
        expect(steps?.[1]?.damagePerSecondBefore).toBe(steps?.[0]?.damagePerSecondAfter);
        expect(steps?.[0]?.zenyCost).toBe(300_000_000);
        expect(steps?.[1]?.zenyCost).toBeUndefined();
    });

    it("gives the same step a larger gain later on the path, while the end result is the same either way", async () => {
        const tree = mechanicTreeWith([
            treeNode("refine", null, [refineMaceToTen]),
            treeNode("refine-then-strength", "refine", [raiseStrength]),
            treeNode("strength", null, [raiseStrength]),
            treeNode("strength-then-refine", "strength", [refineMaceToTen]),
        ]);
        const evaluation = await evaluateTree(tree, calculate);

        const refineFirst = breakDownPath(tree, evaluation, "refine-then-strength");
        const strengthFirst = breakDownPath(tree, evaluation, "strength-then-refine");

        expect(refineFirst?.[1]?.damagePerSecondAfter).toBe(strengthFirst?.[1]?.damagePerSecondAfter);
        const refineGainOnTheRoot = gainOf(refineFirst?.[0]);
        const refineGainAfterStrength = gainOf(strengthFirst?.[1]);
        const strengthGainOnTheRoot = gainOf(strengthFirst?.[0]);
        const strengthGainAfterRefine = gainOf(refineFirst?.[1]);
        expect(refineGainAfterStrength).toBeGreaterThan(refineGainOnTheRoot);
        expect(strengthGainAfterRefine).toBeGreaterThan(strengthGainOnTheRoot);
        expect(gainOf(refineFirst?.[0]) + gainOf(refineFirst?.[1])).toBe(
            gainOf(strengthFirst?.[0]) + gainOf(strengthFirst?.[1]),
        );
    });

    it("has no breakdown for a path through a stale node", async () => {
        const staleRefine = { ...refineMaceToTen, expectedItemId: anotherWeaponItemId };
        const tree = mechanicTreeWith([treeNode("stale", null, [staleRefine]), treeNode("below", "stale", [raiseStrength])]);

        expect(await breakDown(tree, "below")).toBeUndefined();
    });
});
