import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serializePublishedSchema } from "../build/published-schema.ts";
import { InvalidTreeError, parseTree, type TreeIssue } from "./parse-tree.ts";
import { type Change, type ChangeKind, changeSchemaOfKind, treeJsonSchema, type TreeNode } from "./tree-format.ts";

const maceItemId = 4411;

function treeCandidateWith(nodes: readonly unknown[]) {
    return {
        formatVersion: 1,
        scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 850 },
        root: {
            jobId: 51,
            baseLevel: 200,
            jobLevel: 70,
            baseStats: { str: 110, agi: 110, vit: 100, int: 100, dex: 110, luk: 78 },
            equipment: { rightHand: { itemId: maceItemId, refine: 9 } },
        },
        nodes,
    };
}

function nodeWith(overrides: Omit<Partial<TreeNode>, "changes"> & { changes?: readonly unknown[] }) {
    return { id: "node", parentId: null, label: "a step", changes: [], ...overrides };
}

const oneChangeOfEveryKind: { readonly [Kind in ChangeKind]: Extract<Change, { kind: Kind }> } = {
    setGearPiece: { kind: "setGearPiece", slot: "shield", gearPiece: { itemId: 4936, refine: 7 } },
    setRefine: { kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId, refine: 10 },
    setTranscendence: { kind: "setTranscendence", slot: "rightHand", expectedItemId: maceItemId, transcendence: 4 },
    setSocket: { kind: "setSocket", slot: "rightHand", expectedItemId: maceItemId, socket: 1, cardOrEnchantId: 46 },
    setBaseStat: { kind: "setBaseStat", stat: "str", value: 120 },
    setTraitStat: { kind: "setTraitStat", stat: "pow", value: 10 },
    setLearnedSkill: { kind: "setLearnedSkill", skillId: 554, level: 5 },
    setSelfBuff: { kind: "setSelfBuff", skillId: 739, level: 1 },
    setSupportBuff: { kind: "setSupportBuff", name: "BLESSING", value: 10 },
    setPanelBuff: { kind: "setPanelBuff", panel: "itemBuffs", position: 9, value: 1 },
    setCustomization: { kind: "setCustomization", section: "attack", name: "ATK_PLUS", value: -50 },
    setTimedItems: { kind: "setTimedItems", timedItems: [79, 79, 3] },
    setAutoSpells: { kind: "setAutoSpells", autoSpells: [{ autoSpellId: 2, level: 3, chancePerMille: 100 }] },
    setSpeedPotion: { kind: "setSpeedPotion", speedPotion: 2 },
    setWeaponElement: { kind: "setWeaponElement", elementId: 3 },
    setArrow: { kind: "setArrow", arrowId: 1 },
};

function issuesOf(candidate: unknown): readonly TreeIssue[] {
    try {
        parseTree(candidate);
    } catch (error) {
        if (error instanceof InvalidTreeError) {
            return error.issues;
        }
        throw error;
    }
    return [];
}

describe("parseTree", () => {
    it("accepts a tree that is only a root and a scenario", () => {
        const candidate = treeCandidateWith([]);

        expect(parseTree(candidate)).toBe(candidate);
    });

    it("accepts a node holding one change of every kind", () => {
        const candidate = treeCandidateWith([nodeWith({ changes: Object.values(oneChangeOfEveryKind) })]);

        expect(parseTree(candidate)).toBe(candidate);
        expect(Object.keys(oneChangeOfEveryKind).sort()).toEqual(Object.keys(changeSchemaOfKind).sort());
    });

    it("accepts a child node, a priced step and a favorite", () => {
        const candidate = treeCandidateWith([
            nodeWith({ id: "refine", zenyCost: 300_000_000, favorite: true }),
            nodeWith({ id: "refine-then-card", parentId: "refine" }),
        ]);

        expect(parseTree(candidate)).toBe(candidate);
    });

    it("throws InvalidTreeError for something that is not a tree", () => {
        expect(() => parseTree([])).toThrow(InvalidTreeError);
    });

    it("names a missing node field by its path", () => {
        const { label: _removed, ...nodeWithoutLabel } = nodeWith({});

        expect(issuesOf(treeCandidateWith([nodeWithoutLabel]))).toEqual([
            { path: "/nodes/0/label", kind: "missing", rule: "required" },
        ]);
    });

    it("reports a wrong value in a change once, against the kind the change names", () => {
        const candidate = treeCandidateWith([
            nodeWith({ changes: [{ ...oneChangeOfEveryKind.setRefine, refine: -1 }] }),
        ]);

        expect(issuesOf(candidate)).toEqual([{ path: "/nodes/0/changes/0/refine", kind: "invalid", rule: "minimum" }]);
    });

    it("reports a change without the item it was made for", () => {
        const { expectedItemId: _removed, ...refineWithoutExpectedItem } = oneChangeOfEveryKind.setRefine;
        const candidate = treeCandidateWith([nodeWith({ changes: [refineWithoutExpectedItem] })]);

        expect(issuesOf(candidate)).toEqual([
            { path: "/nodes/0/changes/0/expectedItemId", kind: "missing", rule: "required" },
        ]);
    });

    it("reports a change of a kind that does not exist", () => {
        const candidate = treeCandidateWith([
            nodeWith({ changes: [oneChangeOfEveryKind.setBaseStat, { kind: "toggleBuff", buffId: 1 }] }),
        ]);

        expect(issuesOf(candidate)).toEqual([{ kind: "unknownChangeKind", path: "/nodes/0/changes/1" }]);
    });

    it("rejects a change on an equipment slot that does not exist", () => {
        const candidate = treeCandidateWith([
            nodeWith({ changes: [{ ...oneChangeOfEveryKind.setRefine, slot: "tail" }] }),
        ]);

        expect(issuesOf(candidate)).toEqual([{ path: "/nodes/0/changes/0/slot", kind: "invalid", rule: "enum" }]);
    });

    it("rejects a socket number beyond the fourth", () => {
        const candidate = treeCandidateWith([
            nodeWith({ changes: [{ ...oneChangeOfEveryKind.setSocket, socket: 5 }] }),
        ]);

        expect(issuesOf(candidate)).toEqual([{ path: "/nodes/0/changes/0/socket", kind: "invalid", rule: "maximum" }]);
    });

    it("applies the build format's rules to the root character", () => {
        const candidate = treeCandidateWith([]);
        candidate.root.baseStats.str = 0;

        expect(issuesOf(candidate)).toEqual([{ path: "/root/baseStats/str", kind: "invalid", rule: "minimum" }]);
    });
});

describe("parseTree node structure", () => {
    it("rejects two nodes with the same ID", () => {
        const candidate = treeCandidateWith([nodeWith({ id: "twin" }), nodeWith({ id: "twin" })]);

        expect(issuesOf(candidate)).toEqual([{ kind: "duplicateNodeId", nodeId: "twin" }]);
    });

    it("rejects a node whose parent is not in the tree", () => {
        const candidate = treeCandidateWith([nodeWith({ id: "orphan", parentId: "gone" })]);

        expect(issuesOf(candidate)).toEqual([{ kind: "unknownParent", nodeId: "orphan", parentId: "gone" }]);
    });

    it("rejects nodes that are each other's ancestors", () => {
        const candidate = treeCandidateWith([
            nodeWith({ id: "first", parentId: "second" }),
            nodeWith({ id: "second", parentId: "first" }),
        ]);

        expect(issuesOf(candidate)).toEqual([
            { kind: "parentCycle", nodeId: "first" },
            { kind: "parentCycle", nodeId: "second" },
        ]);
    });

    it("rejects a node that is its own parent", () => {
        const candidate = treeCandidateWith([nodeWith({ id: "loop", parentId: "loop" })]);

        expect(issuesOf(candidate)).toEqual([{ kind: "parentCycle", nodeId: "loop" }]);
    });
});

describe("published tree schema", () => {
    it("is the schema the parser checks against (run `pnpm --filter @ro-ratorio-branch/core run schema` after a change)", () => {
        const publishedSchemaText = readFileSync(new URL("../../schema/tree.v1.schema.json", import.meta.url), "utf8");

        expect(publishedSchemaText).toBe(serializePublishedSchema(treeJsonSchema));
    });
});
