import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { type BuildCalculator, calculatorOn, evaluateTree, type NodeEvaluation } from "./evaluate-tree.ts";
import {
    anotherWeaponItemId,
    mechanicDamageShownUpstream,
    mechanicTreeWith,
    refineMaceToTen,
    treeNode,
} from "./tree-test-support.ts";

const idBeyondEveryUpstreamTable = 999_999;

function damagePerAttackOf(evaluation: NodeEvaluation | undefined): number {
    if (evaluation?.state !== "ready") {
        throw new Error(`expected a ready node, got ${evaluation?.state}`);
    }
    return evaluation.battleSummary.averageDamagePerAttack;
}

describe("evaluateTree", () => {
    let calculate: BuildCalculator;

    beforeAll(async () => {
        calculate = calculatorOn(await loadRatorioEngine());
    }, 60_000);

    it("calculates the root to the numbers the upstream page shows", async () => {
        const evaluation = await evaluateTree(mechanicTreeWith([]), calculate);

        expect(evaluation.root.state).toBe("ready");
        expect(evaluation.root.state === "ready" && evaluation.root.battleSummary).toMatchObject(mechanicDamageShownUpstream);
    });

    it("snapshots the root's stats under upstream's names, matching the upstream status screen", async () => {
        const evaluation = await evaluateTree(mechanicTreeWith([]), calculate);

        const stats = evaluation.root.state === "ready" ? evaluation.root.statSnapshot.stats : {};
        expect(stats).toMatchObject({ MAXHP: 115382, MAXSP: 5608, STATUS_ATK: 475, HIT: 631, FLEE: 498, CRI: 44.8, ASPD: 193 });
    });

    it("snapshots only the bonuses that are not 0", async () => {
        const evaluation = await evaluateTree(mechanicTreeWith([]), calculate);

        const bonuses = evaluation.root.state === "ready" ? evaluation.root.statSnapshot.bonuses : {};
        expect(bonuses["STR_PLUS"]).toBeGreaterThan(0);
        expect(Object.values(bonuses)).not.toContain(0);
    });

    it("calculates a node with its changes applied: a higher refine deals more damage", async () => {
        const evaluation = await evaluateTree(mechanicTreeWith([treeNode("refine", null, [refineMaceToTen])]), calculate);

        expect(damagePerAttackOf(evaluation.nodes.get("refine"))).toBeGreaterThan(damagePerAttackOf(evaluation.root));
    });

    it("uses the tree's scenario for every node", async () => {
        const evaluation = await evaluateTree(mechanicTreeWith([treeNode("refine", null, [refineMaceToTen])]), calculate);

        const refineEvaluation = evaluation.nodes.get("refine");
        expect(refineEvaluation?.state === "ready" && refineEvaluation.battleSummary.targetMonsterId).toBe(850);
    });

    it("does not calculate a stale node", async () => {
        const staleRefine = { ...refineMaceToTen, expectedItemId: anotherWeaponItemId };

        const evaluation = await evaluateTree(mechanicTreeWith([treeNode("stale", null, [staleRefine])]), calculate);

        expect(evaluation.nodes.get("stale")).toEqual({
            state: "stale",
            staleChanges: [{ nodeId: "stale", changeIndex: 0, reason: "slotHoldsAnotherItem" }],
        });
    });

    it("reports why the engine cannot calculate a node, without failing the others", async () => {
        const evaluation = await evaluateTree(
            mechanicTreeWith([
                treeNode("refine", null, [refineMaceToTen]),
                treeNode("impossible", null, [{ kind: "setLearnedSkill", skillId: idBeyondEveryUpstreamTable, level: 1 }]),
            ]),
            calculate,
        );

        const impossible = evaluation.nodes.get("impossible");
        expect(impossible?.state).toBe("notCalculable");
        expect(impossible?.state === "notCalculable" && impossible.issues).toEqual([
            { kind: "skillNotLearnableByJob", skillId: idBeyondEveryUpstreamTable },
        ]);
        expect(evaluation.nodes.get("refine")?.state).toBe("ready");
    });
});
