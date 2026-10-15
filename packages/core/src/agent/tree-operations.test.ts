import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { calculatorOn, evaluateTree, type TreeEvaluation } from "../tree/evaluate-tree.ts";
import { InvalidTreeError } from "../tree/parse-tree.ts";
import type { Change } from "../tree/tree-format.ts";
import { anotherWeaponItemId, mechanicDamageShownUpstream, mechanicTreeWith, refineMaceToTen, treeNode } from "../tree/tree-test-support.ts";
import { compareNodePair, rankLeaves, withNode } from "./tree-operations.ts";

const raiseStrength = { kind: "setBaseStat", stat: "str", value: 130 } satisfies Change;
const lowerStrength = { kind: "setBaseStat", stat: "str", value: 1 } satisfies Change;
const tree = mechanicTreeWith([
    treeNode("stronger", null, [raiseStrength], 0),
    treeNode("stronger-then-weaker", "stronger", [lowerStrength], 1_000_000),
    treeNode("weaker", null, [lowerStrength]),
    treeNode("stale", null, [{ ...refineMaceToTen, expectedItemId: anotherWeaponItemId }]),
]);

describe("withNode", () => {
    it("adds a node at the end", () => {
        const added = withNode(tree, treeNode("new", "stronger", [lowerStrength]));

        expect(added.nodes.map((node) => node.id)).toEqual(["stronger", "stronger-then-weaker", "weaker", "stale", "new"]);
        expect(tree.nodes).toHaveLength(4);
    });

    it("puts a node in place of the one with its ID", () => {
        const replaced = withNode(tree, treeNode("weaker", "stronger", [raiseStrength], 5));

        expect(replaced.nodes.map((node) => node.id)).toEqual(["stronger", "stronger-then-weaker", "weaker", "stale"]);
        expect(replaced.nodes[2]).toEqual({ id: "weaker", parentId: "stronger", label: "weaker", changes: [raiseStrength], zenyCost: 5 });
    });

    it.each([
        { situation: "a parent the tree does not have", node: treeNode("new", "nobody", []) },
        { situation: "itself as its parent", node: treeNode("new", "new", []) },
        { situation: "a change of an unknown kind", node: { ...treeNode("new", null, []), changes: [{ kind: "notAChange" }] } },
    ])("refuses a node with $situation", ({ node }) => {
        expect(() => withNode(tree, node as never)).toThrow(InvalidTreeError);
    });
});

describe("with the tree calculated", () => {
    let evaluation: TreeEvaluation;

    beforeAll(async () => {
        evaluation = await evaluateTree(tree, calculatorOn(await loadRatorioEngine()));
    }, 60_000);

    describe("compareNodePair", () => {
        it("compares a node with the root, in the direction asked", () => {
            const gain = compareNodePair(tree, evaluation, null, "stronger");
            const loss = compareNodePair(tree, evaluation, "stronger", null);

            if (gain.state !== "compared" || loss.state !== "compared") {
                throw new Error("expected both to compare");
            }
            expect(gain.from).toMatchObject({ nodeId: null, label: null, battleSummary: mechanicDamageShownUpstream });
            expect(gain.to.nodeId).toBe("stronger");
            expect(gain.diff.damage.averageDamagePerSecond.after).toBeGreaterThan(gain.diff.damage.averageDamagePerSecond.before);
            expect(loss.diff.damage.averageDamagePerSecond).toEqual({ before: gain.diff.damage.averageDamagePerSecond.after, after: gain.diff.damage.averageDamagePerSecond.before });
        });

        it("compares two nodes with each other", () => {
            const comparison = compareNodePair(tree, evaluation, "weaker", "stronger-then-weaker");

            expect(comparison.state === "compared" && comparison.diff.damage.averageDamagePerSecond.before === comparison.diff.damage.averageDamagePerSecond.after).toBe(true);
        });

        it("says which node the tree does not have, and which has no numbers", () => {
            expect(compareNodePair(tree, evaluation, null, "nobody")).toEqual({ state: "unknownNode", nodeId: "nobody" });
            expect(compareNodePair(tree, evaluation, "stale", "stronger")).toEqual({ state: "notComparable", nodeId: "stale", reason: "stale" });
        });
    });

    describe("rankLeaves", () => {
        it("ranks only the nodes nothing builds on, and only those with numbers", () => {
            expect(rankLeaves(tree, evaluation, "damagePerSecondGain").map((rankedNode) => rankedNode.nodeId).sort()).toEqual(["stronger-then-weaker", "weaker"]);
            expect(rankLeaves(tree, evaluation, "cumulativeZenyCost")[0]?.nodeId).toBe("stronger-then-weaker");
        });
    });
});
