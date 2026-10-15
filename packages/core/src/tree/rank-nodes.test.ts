import { describe, expect, it } from "vitest";
import type { NodeEvaluation, TreeEvaluation } from "./evaluate-tree.ts";
import { rankNodes, type RankingMetric } from "./rank-nodes.ts";
import type { Tree, TreeNode } from "./tree-format.ts";
import { mechanicBuild, mechanicTreeWith, treeNode } from "./tree-test-support.ts";

const rootDamagePerSecond = 1000;

function readyWith(damagePerSecond: number, secondsToKill: number | null = 10): NodeEvaluation {
    return {
        state: "ready",
        character: mechanicBuild.character,
        battleSummary: {
            targetMonsterId: 850,
            averageDamagePerAttack: damagePerSecond,
            averageDamagePerSecond: damagePerSecond,
            averageTimeToKill: secondsToKill === null ? null : { seconds: secondsToKill, attacks: 1 },
        },
        statSnapshot: { stats: {}, bonuses: {} },
    };
}

const stale: NodeEvaluation = { state: "stale", staleChanges: [{ nodeId: "stale", changeIndex: 0, reason: "slotIsEmpty" }] };

function evaluationOf(tree: Tree, evaluationOfNodeId: Record<string, NodeEvaluation>): TreeEvaluation {
    const root = readyWith(rootDamagePerSecond);
    if (root.state !== "ready") {
        throw new Error("unreachable");
    }
    return { root, nodes: new Map(tree.nodes.map((node) => [node.id, evaluationOfNodeId[node.id] ?? stale])) };
}

function rankedIds(nodes: TreeNode[], evaluationOfNodeId: Record<string, NodeEvaluation>, metric: RankingMetric) {
    const tree = mechanicTreeWith(nodes);
    return rankNodes(tree, evaluationOf(tree, evaluationOfNodeId), metric).map((rankedNode) => rankedNode.nodeId);
}

describe("rankNodes by damage gain", () => {
    it("puts the largest gain over the root first", () => {
        const nodes = [treeNode("small", null, []), treeNode("large", null, []), treeNode("worse", null, [])];
        const evaluations = { small: readyWith(1100), large: readyWith(1500), worse: readyWith(900) };

        expect(rankedIds(nodes, evaluations, "damagePerSecondGain")).toEqual(["large", "small", "worse"]);
    });

    it("reports the gain against the root, also for a node deep in the tree", () => {
        const tree = mechanicTreeWith([treeNode("first", null, []), treeNode("second", "first", [])]);
        const evaluation = evaluationOf(tree, { first: readyWith(1200), second: readyWith(1500) });

        const second = rankNodes(tree, evaluation, "damagePerSecondGain").find((node) => node.nodeId === "second");

        expect(second?.damagePerSecondGain).toBe(500);
    });

    it("leaves out stale nodes", () => {
        const nodes = [treeNode("ready", null, []), treeNode("stale", null, [])];

        expect(rankedIds(nodes, { ready: readyWith(1100), stale }, "damagePerSecondGain")).toEqual(["ready"]);
    });

    it("leaves out nodes the engine cannot calculate", () => {
        const nodes = [treeNode("ready", null, []), treeNode("impossible", null, [])];
        const impossible: NodeEvaluation = {
            state: "notCalculable",
            character: mechanicBuild.character,
            issues: [{ kind: "unknownSupportBuff", name: "NOT_A_BUFF" }],
        };

        expect(rankedIds(nodes, { ready: readyWith(1100), impossible }, "damagePerSecondGain")).toEqual(["ready"]);
    });

    it("marks which nodes are leaves", () => {
        const tree = mechanicTreeWith([treeNode("parent", null, []), treeNode("child", "parent", [])]);
        const evaluation = evaluationOf(tree, { parent: readyWith(1100), child: readyWith(1200) });

        const leafFlags = Object.fromEntries(
            rankNodes(tree, evaluation, "damagePerSecondGain").map((node) => [node.nodeId, node.isLeaf]),
        );

        expect(leafFlags).toEqual({ parent: false, child: true });
    });
});

describe("rankNodes by time to kill", () => {
    it("puts the fastest kill first and a node that cannot kill last", () => {
        const nodes = [treeNode("slow", null, []), treeNode("never", null, []), treeNode("fast", null, [])];
        const evaluations = { slow: readyWith(1100, 30), never: readyWith(0, null), fast: readyWith(1500, 5) };

        expect(rankedIds(nodes, evaluations, "secondsToKill")).toEqual(["fast", "slow", "never"]);
    });
});

describe("rankNodes by cost", () => {
    it("adds up the step costs along the path", () => {
        const tree = mechanicTreeWith([treeNode("first", null, [], 100), treeNode("second", "first", [], 250)]);
        const evaluation = evaluationOf(tree, { first: readyWith(1100), second: readyWith(1200) });

        const costs = Object.fromEntries(
            rankNodes(tree, evaluation, "cumulativeZenyCost").map((node) => [node.nodeId, node.cumulativeZenyCost]),
        );

        expect(costs).toEqual({ first: 100, second: 350 });
    });

    it("has no cumulative cost when a step on the path is unpriced", () => {
        const tree = mechanicTreeWith([treeNode("unpriced", null, []), treeNode("priced-below", "unpriced", [], 250)]);
        const evaluation = evaluationOf(tree, { unpriced: readyWith(1100), "priced-below": readyWith(1200) });

        const pricedBelow = rankNodes(tree, evaluation, "cumulativeZenyCost").find((node) => node.nodeId === "priced-below");

        expect(pricedBelow?.cumulativeZenyCost).toBeNull();
        expect(pricedBelow?.valueForMoney).toEqual({ kind: "unpriced" });
    });

    it("puts the cheapest first and unpriced nodes last", () => {
        const nodes = [treeNode("dear", null, [], 900), treeNode("unpriced", null, []), treeNode("cheap", null, [], 100)];
        const evaluations = { dear: readyWith(1100), unpriced: readyWith(1100), cheap: readyWith(1100) };

        expect(rankedIds(nodes, evaluations, "cumulativeZenyCost")).toEqual(["cheap", "dear", "unpriced"]);
    });
});

describe("rankNodes by value for money", () => {
    it("divides the damage gain by the cost in millions of zeny", () => {
        const tree = mechanicTreeWith([treeNode("upgrade", null, [], 50_000_000)]);
        const evaluation = evaluationOf(tree, { upgrade: readyWith(rootDamagePerSecond + 500) });

        expect(rankNodes(tree, evaluation, "valueForMoney")[0]?.valueForMoney).toEqual({
            kind: "priced",
            damagePerSecondGainPerMillionZeny: 10,
        });
    });

    it("puts the most gain per zeny first, even when another node gains more in total", () => {
        const nodes = [treeNode("big-and-dear", null, [], 100_000_000), treeNode("small-and-cheap", null, [], 1_000_000)];
        const evaluations = { "big-and-dear": readyWith(2000), "small-and-cheap": readyWith(1100) };

        expect(rankedIds(nodes, evaluations, "valueForMoney")).toEqual(["small-and-cheap", "big-and-dear"]);
    });

    it("puts unpriced nodes last, however much they gain", () => {
        const nodes = [treeNode("unpriced-huge", null, []), treeNode("priced-small", null, [], 1_000_000)];
        const evaluations = { "unpriced-huge": readyWith(9000), "priced-small": readyWith(1001) };

        expect(rankedIds(nodes, evaluations, "valueForMoney")).toEqual(["priced-small", "unpriced-huge"]);
    });

    it("puts a node that costs nothing before every priced one", () => {
        const tree = mechanicTreeWith([treeNode("priced", null, [], 1_000_000), treeNode("free", null, [], 0)]);
        const evaluation = evaluationOf(tree, { priced: readyWith(5000), free: readyWith(1100) });

        const ranked = rankNodes(tree, evaluation, "valueForMoney");

        expect(ranked.map((node) => node.nodeId)).toEqual(["free", "priced"]);
        expect(ranked[0]?.valueForMoney).toEqual({ kind: "free", damagePerSecondGain: 100 });
    });
});

describe("rankNodes without a calculable root", () => {
    it("ranks nothing, since every gain is measured against the root", () => {
        const tree = mechanicTreeWith([treeNode("upgrade", null, [])]);
        const evaluation: TreeEvaluation = {
            root: { state: "notCalculable", character: mechanicBuild.character, issues: [{ kind: "unknownJob", jobId: 1 }] },
            nodes: new Map([["upgrade", readyWith(1100)]]),
        };

        expect(rankNodes(tree, evaluation, "damagePerSecondGain")).toEqual([]);
    });
});
