import type { NodeComparison, Tree, TreeComparison, TreeNode } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { formatSignedInteger, formatSignedPercent, formatSignedSeconds, formatZeny } from "./format.ts";
import { doubleTapWindowInMilliseconds, idsShownIn, isSecondTapOfDouble, rankingCardsOf, staleNodesOf, treeLinesOf, treeRowsOf, withoutCollapsedBranches } from "./tree-view-model.ts";

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
        expect(treeLinesOf(tree, comparison)).toEqual([
            { nodeId: "small", label: "label of small", depth: 1, guides: ["branch"], state: "ready", damagePerSecondGain: 100 },
            { nodeId: "large", label: "label of large", depth: 1, guides: ["branch"], state: "ready", damagePerSecondGain: 400 },
            { nodeId: "under-large", label: "label of under-large", depth: 2, guides: ["through", "last"], state: "ready", damagePerSecondGain: 500 },
            { nodeId: "old", label: "label of old", depth: 1, guides: ["last"], state: "stale" },
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

    it("lists the nodes before they are calculated", () => {
        expect(treeLinesOf(tree, null).map((line) => [line.nodeId, line.depth, line.state])).toEqual([
            ["small", 1, "pending"],
            ["large", 1, "pending"],
            ["under-large", 2, "pending"],
            ["old", 1, "pending"],
        ]);
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
