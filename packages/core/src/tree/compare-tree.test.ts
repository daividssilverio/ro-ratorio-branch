import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { compareTree, type NodeComparison, type TreeComparison } from "./compare-tree.ts";
import { type BuildCalculator, calculatorOn } from "./evaluate-tree.ts";
import type { Change } from "./tree-format.ts";
import { anotherWeaponItemId, mechanicDamageShownUpstream, mechanicTreeWith, refineMaceToTen, treeNode } from "./tree-test-support.ts";

const raiseStrength = { kind: "setBaseStat", stat: "str", value: 130 } satisfies Change;
const staleRefine = { ...refineMaceToTen, expectedItemId: anotherWeaponItemId };

function nodeOf(comparison: TreeComparison, nodeId: string): NodeComparison {
    const node = comparison.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
        throw new Error(`no node ${nodeId}`);
    }
    return node;
}

describe("compareTree", () => {
    let calculate: BuildCalculator;
    let comparison: TreeComparison;

    beforeAll(async () => {
        calculate = calculatorOn(await loadRatorioEngine());
        comparison = await compareTree(
            mechanicTreeWith([
                treeNode("refine", null, [refineMaceToTen], 300_000_000),
                treeNode("refine-then-strength", "refine", [raiseStrength], 0),
                treeNode("strength", null, [raiseStrength]),
                treeNode("stale", null, [staleRefine]),
            ]),
            calculate,
        );
    }, 60_000);

    it("reports the root with the numbers the upstream page shows", () => {
        expect(comparison.root.state === "ready" && comparison.root.battleSummary).toMatchObject(mechanicDamageShownUpstream);
    });

    it("lists every node in the order of the tree file", () => {
        expect(comparison.nodes.map((node) => node.id)).toEqual(["refine", "refine-then-strength", "strength", "stale"]);
    });

    it("gives a ready node its gain, cumulative cost and value for money", () => {
        const refineThenStrength = nodeOf(comparison, "refine-then-strength");

        expect(refineThenStrength.state).toBe("ready");
        if (refineThenStrength.state === "ready") {
            expect(refineThenStrength.damagePerSecondGain).toBeGreaterThan(0);
            expect(refineThenStrength.cumulativeZenyCost).toBe(300_000_000);
            expect(refineThenStrength.valueForMoney.kind).toBe("priced");
            expect(refineThenStrength.isLeaf).toBe(true);
        }
    });

    it("diffs a node against its parent, not against the root", () => {
        const refineThenStrength = nodeOf(comparison, "refine-then-strength");

        expect(refineThenStrength.state === "ready" && refineThenStrength.diffFromParent?.gear).toEqual([]);
        expect(refineThenStrength.state === "ready" && refineThenStrength.diffFromParent?.otherInputs).toEqual([
            { section: "baseStats", name: "str", before: 110, after: 130 },
        ]);
    });

    it("keeps a stale node in the list with the change that no longer fits", () => {
        expect(nodeOf(comparison, "stale")).toEqual({
            id: "stale",
            label: "stale",
            parentId: null,
            state: "stale",
            staleChanges: [{ nodeId: "stale", changeIndex: 0, reason: "slotHoldsAnotherItem" }],
        });
    });

    it("ranks only the nodes with numbers, for every metric", () => {
        expect(Object.keys(comparison.rankings).sort()).toEqual([
            "cumulativeZenyCost",
            "damagePerSecondGain",
            "secondsToKill",
            "valueForMoney",
        ]);
        expect(comparison.rankings.damagePerSecondGain).toEqual(["refine-then-strength", "refine", "strength"]);
        expect(comparison.rankings.valueForMoney.at(-1)).toBe("strength");
    });
});
