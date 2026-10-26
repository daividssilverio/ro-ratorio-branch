import type { Workspace } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { managedCharactersOf, treeToOpenAfterRemoval } from "./character-manager-model.ts";

const character = { name: "メカニック", jobId: 51, baseLevel: 200, jobLevel: 70, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment: {} };
const tree = (characterId: string, name: string, nodeCount: number) => ({
    name,
    characterId,
    scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 850 },
    nodes: Array.from({ length: nodeCount }, (_, index) => ({ id: `node-${index}`, parentId: null, label: "", changes: [] })),
});
const workspace: Workspace = {
    formatVersion: 1,
    gearPieces: {},
    characters: { mechanic: character, imported: { ...character, name: "読み込んだツリー", jobId: 85, baseLevel: 180 }, unseen: character },
    trees: { upgrades: tree("mechanic", "upgrades", 3), "imported-tree": tree("imported", "読み込んだツリー", 190), again: tree("mechanic", "again", 0) },
};

describe("the list of characters and trees", () => {
    it("gives every character with its job, level and trees, and marks the open tree", () => {
        expect(managedCharactersOf(workspace, "imported-tree")).toEqual([
            {
                id: "mechanic",
                name: "メカニック",
                jobId: 51,
                baseLevel: 200,
                trees: [
                    { id: "upgrades", name: "upgrades", nodeCount: 3, isOpen: false },
                    { id: "again", name: "again", nodeCount: 0, isOpen: false },
                ],
            },
            { id: "imported", name: "読み込んだツリー", jobId: 85, baseLevel: 180, trees: [{ id: "imported-tree", name: "読み込んだツリー", nodeCount: 190, isOpen: true }] },
            { id: "unseen", name: "メカニック", jobId: 51, baseLevel: 200, trees: [] },
        ]);
    });

    it("keeps the open tree open after a removal while it is there, and opens the first one otherwise", () => {
        expect(treeToOpenAfterRemoval(workspace, "again")).toBe("again");
        expect(treeToOpenAfterRemoval(workspace, "gone")).toBe("upgrades");
    });
});
