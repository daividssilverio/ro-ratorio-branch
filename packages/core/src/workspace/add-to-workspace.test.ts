import { describe, expect, it } from "vitest";
import exampleTreeFileContent from "../tree/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { parseTree } from "../tree/parse-tree.ts";
import { addCharacterToWorkspace, addEmptyTreeToWorkspace, addTreeToWorkspace, emptyWorkspace, firstUnusedId } from "./add-to-workspace.ts";
import { parseWorkspace } from "./parse-workspace.ts";
import { treeOf } from "./resolve-workspace.ts";

const exampleTree = parseTree(exampleTreeFileContent);

describe("addTreeToWorkspace", () => {
    it("gives back the same tree when the added tree is resolved again", () => {
        const { workspace, treeId } = addTreeToWorkspace(emptyWorkspace(), exampleTree, "ブーツ検討");

        expect(treeOf(workspace, treeId)).toEqual(exampleTree);
    });

    it("puts every piece the root wears into the locker as owned", () => {
        const { workspace, characterId } = addTreeToWorkspace(emptyWorkspace(), exampleTree, "ブーツ検討");

        const wornPieceIds = Object.values(workspace.characters[characterId]?.equipment ?? {});
        expect(wornPieceIds).toHaveLength(Object.keys(exampleTree.root.equipment).length);
        expect(wornPieceIds.map((gearPieceId) => workspace.gearPieces[gearPieceId]?.owned)).toEqual(wornPieceIds.map(() => true));
    });

    it("produces a workspace the parser accepts", () => {
        const { workspace } = addTreeToWorkspace(emptyWorkspace(), exampleTree, "ブーツ検討");

        expect(parseWorkspace(workspace)).toBe(workspace);
    });

    it("keeps what is already there when a second tree is added", () => {
        const first = addTreeToWorkspace(emptyWorkspace(), exampleTree, "first");

        const second = addTreeToWorkspace(first.workspace, exampleTree, "second");

        expect(second.treeId).not.toBe(first.treeId);
        expect(second.characterId).not.toBe(first.characterId);
        expect(treeOf(second.workspace, first.treeId)).toEqual(exampleTree);
        expect(Object.keys(second.workspace.gearPieces)).toHaveLength(2 * Object.keys(first.workspace.gearPieces).length);
    });
});

describe("addCharacterToWorkspace and addEmptyTreeToWorkspace", () => {
    it("adds a character under its name and an empty tree for it", () => {
        const added = addCharacterToWorkspace(emptyWorkspace(), exampleTree.root, "メカニック");

        const withTree = addEmptyTreeToWorkspace(added.workspace, added.characterId, exampleTree.scenario, "new plan");

        expect(withTree.workspace.characters[added.characterId]?.name).toBe("メカニック");
        expect(treeOf(withTree.workspace, withTree.treeId)).toEqual({ ...exampleTree, nodes: [] });
    });
});

describe("firstUnusedId", () => {
    it("skips the IDs that are taken", () => {
        expect(firstUnusedId({ "tree-1": true, "tree-2": true }, "tree")).toBe("tree-3");
    });
});
