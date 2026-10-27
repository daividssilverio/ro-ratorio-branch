import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { diffEvaluations, type EvaluationDiff } from "./diff-evaluations.ts";
import { type BuildCalculator, calculatorOn, evaluateTree, type ReadyNodeEvaluation } from "./evaluate-tree.ts";
import type { Change } from "./tree-format.ts";
import { mechanicTreeWith, refineMaceToTen, treeNode } from "./tree-test-support.ts";

describe("diffEvaluations", () => {
    let calculate: BuildCalculator;

    beforeAll(async () => {
        calculate = calculatorOn(await loadRatorioEngine());
    }, 60_000);

    async function evaluateRootAndNodeWith(changes: Change[]): Promise<[ReadyNodeEvaluation, ReadyNodeEvaluation]> {
        const evaluation = await evaluateTree(mechanicTreeWith([treeNode("changed", null, changes)]), calculate);
        const changed = evaluation.nodes.get("changed");
        if (evaluation.root.state !== "ready" || changed?.state !== "ready") {
            throw new Error("expected the root and the node to be ready");
        }
        return [evaluation.root, changed];
    }

    async function diffRootAgainstNodeWith(changes: Change[]): Promise<EvaluationDiff> {
        return diffEvaluations(...(await evaluateRootAndNodeWith(changes)));
    }

    it("finds nothing between a character and itself", async () => {
        const [root] = await evaluateRootAndNodeWith([]);

        const diff = diffEvaluations(root, root);

        expect([diff.gear, diff.otherInputs, diff.stats, diff.bonuses]).toEqual([[], [], [], []]);
        expect(diff.damage.averageDamagePerSecond.after).toBe(diff.damage.averageDamagePerSecond.before);
    });

    it("tells the item sets one side completes and the other does not", async () => {
        const [root] = await evaluateRootAndNodeWith([]);
        const itemSet = { set: { kind: "item", id: 4360 }, members: [{ kind: "item", id: 4351 }], effects: ["攻撃命中時、SP + 5"] } as const;
        const withTheSet = { ...root, itemSets: [itemSet] };
        const withoutIt = { ...root, itemSets: [] };

        expect(diffEvaluations(withoutIt, withTheSet).itemSets).toEqual({ lost: [], gained: [itemSet] });
        expect(diffEvaluations(withTheSet, withoutIt).itemSets).toEqual({ lost: [itemSet], gained: [] });
        expect(diffEvaluations(withTheSet, withTheSet).itemSets).toEqual({ lost: [], gained: [] });
    });

    it("shows a refined weapon as the one gear slot that differs, with the piece before and after", async () => {
        const diff = await diffRootAgainstNodeWith([refineMaceToTen]);

        expect(diff.gear).toHaveLength(1);
        expect(diff.gear[0]?.slot).toBe("rightHand");
        expect(diff.gear[0]?.before?.refine).toBe(9);
        expect(diff.gear[0]?.after?.refine).toBe(10);
        expect(diff.otherInputs).toEqual([]);
    });

    it("shows the derived stats a refine moves, and only those", async () => {
        const diff = await diffRootAgainstNodeWith([refineMaceToTen]);

        expect(diff.stats).toContainEqual({ name: "REFINE_ATK", before: 63, after: 70 });
        expect(diff.stats.every((statDiff) => statDiff.before !== statDiff.after)).toBe(true);
        expect(diff.stats.map((statDiff) => statDiff.name)).not.toContain("HIT");
    });

    it("shows the damage before and after", async () => {
        const diff = await diffRootAgainstNodeWith([refineMaceToTen]);

        expect(diff.damage.averageDamagePerSecond.before).toBe(6507149);
        expect(diff.damage.averageDamagePerSecond.after).toBeGreaterThan(6507149);
        expect(diff.damage.secondsToKill.before).toBeCloseTo(2.1, 6);
    });

    it("shows an emptied slot with no piece after", async () => {
        const diff = await diffRootAgainstNodeWith([{ kind: "setGearPiece", slot: "shield", gearPiece: null }]);

        expect(diff.gear).toHaveLength(1);
        expect(diff.gear[0]?.slot).toBe("shield");
        expect(diff.gear[0]?.before?.itemId).toBe(4936);
        expect(diff.gear[0]?.after).toBeUndefined();
    });

    it("shows a changed base stat under other inputs, not under gear", async () => {
        const diff = await diffRootAgainstNodeWith([{ kind: "setBaseStat", stat: "str", value: 130 }]);

        expect(diff.gear).toEqual([]);
        expect(diff.otherInputs).toEqual([{ section: "baseStats", name: "str", before: 110, after: 130 }]);
    });

    it("counts a buff that was not active before as 0 before", async () => {
        const diff = await diffRootAgainstNodeWith([{ kind: "setSupportBuff", name: "BLESSING", value: 10 }]);

        expect(diff.otherInputs).toEqual([{ section: "supportBuffs", name: "BLESSING", before: 0, after: 10 }]);
    });
});
