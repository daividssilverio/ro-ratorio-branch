import type { NodeComparison, Tree, TreeComparison, TreeNode } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { formatSignedInteger, formatSignedPercent, formatSignedSeconds, formatZeny } from "./format.ts";
import {
    doubleTapWindowInMilliseconds,
    gainsOf,
    idsShownIn,
    isSecondTapOfDouble,
    linesShown,
    rankingCardsOf,
    staleNodesOf,
    treeLinesOf,
    treeRowsOf,
    withoutCollapsedBranches,
} from "./tree-view-model.ts";

function node(id: string, parentId: string | null, changes: TreeNode["changes"] = []): TreeNode {
    return { id, parentId, label: `label of ${id}`, changes };
}

function ready(id: string, parentId: string | null, damagePerSecondGain: number, isLeaf: boolean): NodeComparison {
    return {
        id,
        label: `label of ${id}`,
        parentId,
        state: "ready",
        battleSummary: {
            targetMonsterId: 850,
            averageDamagePerAttack: 1,
            averageDamagePerSecond: 1000 + damagePerSecondGain,
            averageTimeToKill: null,
        },
        isLeaf,
        damagePerSecondGain,
        cumulativeZenyCost: null,
        valueForMoney: { kind: "unpriced" },
        diffFromParent: null,
    };
}

const stale = (id: string): NodeComparison => ({ id, label: `label of ${id}`, parentId: null, state: "stale", staleChanges: [] });

const tree: Tree = {
    formatVersion: 1,
    scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 850 },
    root: {
        jobId: 51,
        baseLevel: 200,
        jobLevel: 70,
        baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
        equipment: { rightHand: { itemId: 4411, sockets: [null, 659] } },
    },
    nodes: [
        node("small", null),
        node("large", null),
        node("under-large", "large", [
            { kind: "setSocket", slot: "rightHand", expectedItemId: 4411, socket: 1, cardOrEnchantId: 46 },
            { kind: "setGearPiece", slot: "shield", gearPiece: { itemId: 4936, sockets: [1262] } },
        ]),
        node("old", null),
    ],
};

const comparison: TreeComparison = {
    root: { state: "ready", battleSummary: { targetMonsterId: 850, averageDamagePerAttack: 1, averageDamagePerSecond: 1000, averageTimeToKill: null } },
    nodes: [ready("small", null, 100, true), ready("large", null, 400, false), ready("under-large", "large", 500, true), stale("old")],
    rankings: {
        damagePerSecondGain: ["under-large", "large", "small"],
        secondsToKill: ["under-large", "large", "small"],
        cumulativeZenyCost: ["small", "large", "under-large"],
        valueForMoney: ["small", "large", "under-large"],
    },
};

describe("treeRowsOf", () => {
    it("lists each node right before its descendants, siblings best first", () => {
        const rows = treeRowsOf(tree, comparison, "damagePerSecondGain");

        expect(rows.map((row) => [row.node.id, row.depth])).toEqual([
            ["large", 1],
            ["under-large", 2],
            ["small", 1],
            ["old", 1],
        ]);
    });

    it("orders siblings by the chosen metric", () => {
        const rows = treeRowsOf(tree, comparison, "cumulativeZenyCost");

        expect(rows.map((row) => row.node.id)).toEqual(["small", "large", "under-large", "old"]);
    });

    it("knows which nodes have nodes under them", () => {
        const rows = treeRowsOf(tree, comparison, "damagePerSecondGain");

        expect(Object.fromEntries(rows.map((row) => [row.node.id, row.hasChildren]))).toEqual({
            large: true,
            "under-large": false,
            small: false,
            old: false,
        });
    });
});

describe("withoutCollapsedBranches", () => {
    it("hides everything below a collapsed node and keeps the node itself", () => {
        const rows = treeRowsOf(tree, comparison, "damagePerSecondGain");

        const visibleRows = withoutCollapsedBranches(rows, new Set(["large"]));

        expect(visibleRows.map((row) => row.node.id)).toEqual(["large", "small", "old"]);
    });

    it("keeps every row when nothing is collapsed", () => {
        const rows = treeRowsOf(tree, comparison, "damagePerSecondGain");

        expect(withoutCollapsedBranches(rows, new Set())).toEqual(rows);
    });
});

describe("rankingCardsOf", () => {
    it("ranks only leaves with numbers", () => {
        const cards = rankingCardsOf(tree, comparison, "damagePerSecondGain");

        expect(cards.map((card) => [card.rank, card.comparison.id])).toEqual([
            [1, "under-large"],
            [2, "small"],
        ]);
    });

    it("gives each card the labels on its path and its gain as a share of the best", () => {
        const cards = rankingCardsOf(tree, comparison, "damagePerSecondGain");

        expect(cards[0]?.pathLabels).toEqual(["label of large", "label of under-large"]);
        expect(cards.map((card) => card.gainShareOfBest)).toEqual([1, 0.2]);
    });
});

describe("staleNodesOf", () => {
    it("returns the nodes whose changes no longer fit", () => {
        expect(staleNodesOf(comparison).map((nodeComparison) => nodeComparison.id)).toEqual(["old"]);
    });
});

describe("idsShownIn", () => {
    it("collects the job, the scenario and every item and card in the root and the changes", () => {
        const ids = idsShownIn(tree);

        expect(ids.jobIds).toEqual([51]);
        expect(ids.skillIds).toEqual([554]);
        expect(ids.monsterIds).toEqual([850]);
        expect([...ids.itemIds].sort()).toEqual([4411, 4936]);
        expect([...ids.cardOrEnchantIds].sort((first, second) => first - second)).toEqual([46, 659, 1262]);
    });
});

describe("number formats", () => {
    it.each([
        { value: 91_700, expected: "+91,700" },
        { value: -1200, expected: "−1,200" },
        { value: 0, expected: "±0" },
    ])("signs a whole number: $expected", ({ value, expected }) => {
        expect(formatSignedInteger(value)).toBe(expected);
    });

    it("shows a difference as a share of its base, to one decimal", () => {
        expect(formatSignedPercent(91_700, 386_420)).toBe("+23.7%");
        expect(formatSignedPercent(-50, 1000)).toBe("−5.0%");
        expect(formatSignedPercent(10, 0)).toBe("");
    });

    it("signs a difference in seconds", () => {
        expect(formatSignedSeconds(-3.97)).toBe("−3.97s");
        expect(formatSignedSeconds(0.004)).toBe("±0s");
    });

    it.each([
        { zeny: 335_000_000, expected: "335M" },
        { zeny: 2_500_000, expected: "2.5M" },
        { zeny: 450_000, expected: "450k" },
        { zeny: 0, expected: "0" },
    ])("writes zeny as $expected", ({ zeny, expected }) => {
        expect(formatZeny(zeny)).toBe(expected);
    });
});

describe("treeLinesOf", () => {
    it("gives every node a line under its parent, in the order the tree holds them, whatever their numbers", () => {
        const gain = (damagePerSecondChange: number, damagePerSecondBase: number) => ({ damagePerSecondChange, damagePerSecondBase, secondsToKillChange: null });

        expect(treeLinesOf(tree, comparison)).toEqual([
            { nodeId: "small", label: "label of small", depth: 1, guides: ["branch"], state: "ready", hasChildren: false, gains: { total: gain(100, 1000), step: gain(100, 1000) } },
            { nodeId: "large", label: "label of large", depth: 1, guides: ["branch"], state: "ready", hasChildren: true, gains: { total: gain(400, 1000), step: gain(400, 1000) } },
            { nodeId: "under-large", label: "label of under-large", depth: 2, guides: ["through", "last"], state: "ready", hasChildren: false, gains: { total: gain(500, 1000), step: gain(100, 1400) } },
            { nodeId: "old", label: "label of old", depth: 1, guides: ["last"], state: "stale", hasChildren: false, gains: { total: null, step: null } },
        ]);
    });

    it("ends the line of a level under its last node, so that nothing is drawn past it", () => {
        const deep: Tree = { ...tree, nodes: [node("a", null), node("a1", "a"), node("a1x", "a1"), node("a2", "a"), node("b", null), node("b1", "b")] };

        expect(treeLinesOf(deep, null).map((line) => [line.nodeId, ...line.guides])).toEqual([
            ["a", "branch"],
            ["a1", "through", "branch"],
            ["a1x", "through", "through", "last"],
            ["a2", "through", "last"],
            ["b", "last"],
            ["b1", "none", "last"],
        ]);
    });

    it("orders each node's branches best first by a ranking when asked, with the guides drawn for that order", () => {
        expect(treeLinesOf(tree, comparison, "damagePerSecondGain").map((line) => [line.nodeId, ...line.guides])).toEqual([
            ["large", "branch"],
            ["under-large", "through", "last"],
            ["small", "branch"],
            ["old", "last"],
        ]);
        expect(treeLinesOf(tree, comparison, "cumulativeZenyCost").map((line) => line.nodeId)).toEqual(["small", "large", "under-large", "old"]);
    });

    it("keeps the tree's order before the tree is calculated, whatever order is asked", () => {
        expect(treeLinesOf(tree, null, "damagePerSecondGain").map((line) => line.nodeId)).toEqual(["small", "large", "under-large", "old"]);
    });

    it("lists the nodes before they are calculated", () => {
        expect(treeLinesOf(tree, null).map((line) => [line.nodeId, line.depth, line.state])).toEqual([
            ["small", 1, "pending"],
            ["large", 1, "pending"],
            ["under-large", 2, "pending"],
            ["old", 1, "pending"],
        ]);
    });
});

describe("linesShown", () => {
    const deep: Tree = { ...tree, nodes: [node("a", null), node("a1", "a"), node("a1x", "a1"), node("a2", "a"), node("b", null), node("b1", "b")] };
    const lines = treeLinesOf(deep, null);

    it("leaves out everything below a folded node, and keeps the folded node itself", () => {
        expect(linesShown(lines, new Set(["a1"])).map((line) => line.nodeId)).toEqual(["a", "a1", "a2", "b", "b1"]);
        expect(linesShown(lines, new Set(["a"])).map((line) => line.nodeId)).toEqual(["a", "b", "b1"]);
        expect(linesShown(lines, new Set(["a", "b"])).map((line) => line.nodeId)).toEqual(["a", "b"]);
    });

    it("shows every line with nothing folded, and says which lines have something to fold", () => {
        expect(linesShown(lines, new Set()).map((line) => line.nodeId)).toEqual(lines.map((line) => line.nodeId));
        expect(lines.filter((line) => line.hasChildren).map((line) => line.nodeId)).toEqual(["a", "a1", "b"]);
    });
});

describe("isSecondTapOfDouble", () => {
    const first = { target: "node-a", timeInMilliseconds: 1000 };

    it.each([
        { situation: "a tap on the same thing soon after", tap: { target: "node-a", timeInMilliseconds: 1000 + doubleTapWindowInMilliseconds - 1 }, isSecond: true },
        { situation: "a tap on the same thing too late", tap: { target: "node-a", timeInMilliseconds: 1000 + doubleTapWindowInMilliseconds }, isSecond: false },
        { situation: "a tap on something else", tap: { target: "node-b", timeInMilliseconds: 1100 }, isSecond: false },
    ])("says for $situation: $isSecond", ({ tap, isSecond }) => {
        expect(isSecondTapOfDouble(first, tap)).toBe(isSecond);
    });

    it("takes a tap with none before it as a first one", () => {
        expect(isSecondTapOfDouble(null, first)).toBe(false);
    });
});

describe("gainsOf", () => {
    const summary = (averageDamagePerSecond: number, seconds: number | null) => ({
        targetMonsterId: 1,
        averageDamagePerAttack: 1,
        averageDamagePerSecond,
        averageTimeToKill: seconds === null ? null : { seconds, attacks: 1 },
    });
    const ready = (id: string, damagePerSecond: number, seconds: number | null) =>
        ({ id, label: id, state: "ready", battleSummary: summary(damagePerSecond, seconds) }) as unknown as TreeComparison["nodes"][number];
    const node = (id: string, parentId: string | null) => ({ id, parentId, label: id, changes: [] });
    const comparison = {
        root: { state: "ready", battleSummary: summary(1000, 10) },
        nodes: [ready("x", 1100, 9), ready("x1", 1133, 8.5), { id: "broken", label: "broken", state: "notCalculable", issues: [] }, ready("under-broken", 1200, 8)],
        rankings: { damagePerSecondGain: [], secondsToKill: [], cumulativeZenyCost: [], valueForMoney: [] },
    } as unknown as TreeComparison;

    it("measures a top-level node against the root both ways", () => {
        const gains = gainsOf(node("x", null), comparison);

        expect(gains.total).toEqual({ damagePerSecondChange: 100, damagePerSecondBase: 1000, secondsToKillChange: -1 });
        expect(gains.step).toEqual(gains.total);
    });

    it("measures a deeper node against its parent for the step and against the root for the total", () => {
        const gains = gainsOf(node("x1", "x"), comparison);

        expect(gains.step).toEqual({ damagePerSecondChange: 33, damagePerSecondBase: 1100, secondsToKillChange: -0.5 });
        expect(gains.total).toEqual({ damagePerSecondChange: 133, damagePerSecondBase: 1000, secondsToKillChange: -1.5 });
    });

    it("has no step under a parent without numbers, and nothing for a node without numbers", () => {
        expect(gainsOf(node("under-broken", "broken"), comparison)).toEqual({ total: { damagePerSecondChange: 200, damagePerSecondBase: 1000, secondsToKillChange: -2 }, step: null });
        expect(gainsOf(node("broken", null), comparison)).toEqual({ total: null, step: null });
    });
});
