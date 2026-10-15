import { describe, expect, it } from "vitest";
import { resolveTree } from "../tree/resolve-tree.ts";
import { replaceCharacter, replaceLockerPiece, replaceTreeScenario, wearLockerPiece } from "./edit-workspace.ts";
import { addEmptyTreeNode, startNodeEdit, storeNodeEdit } from "./node-edit.ts";
import { parseWorkspace } from "./parse-workspace.ts";
import { characterOf, treeOf } from "./resolve-workspace.ts";
import type { Workspace } from "./workspace-format.ts";
import { maceItemId, mechanicWorkspaceWith, workspaceNode } from "./workspace-test-support.ts";

const workspace = mechanicWorkspaceWith([
    workspaceNode("shield", null, [{ kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" }]),
    workspaceNode("stronger", "shield", [{ kind: "setBaseStat", stat: "str", value: 130 }]),
    workspaceNode("refined", null, [{ kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId, refine: 10 }]),
    workspaceNode("stale", null, [{ kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId + 1, refine: 10 }]),
]);
const editOf = (ofWorkspace: Workspace, nodeId: string) => {
    const edit = startNodeEdit(ofWorkspace, "upgrades", nodeId);
    if (edit === undefined) {
        throw new Error(`node ${nodeId} cannot be edited`);
    }
    return edit;
};
const mechanicOf = (ofWorkspace: Workspace) => {
    const character = ofWorkspace.characters.mechanic;
    if (character === undefined) {
        throw new Error("the test workspace has no mechanic");
    }
    return character;
};
const buildOfNode = (ofWorkspace: Workspace, nodeId: string) => {
    const resolution = resolveTree(treeOf(ofWorkspace, "upgrades")).get(nodeId);
    if (resolution?.state !== "resolved") {
        throw new Error(`node ${nodeId} did not resolve`);
    }
    return resolution.character;
};
const changesOfNode = (ofWorkspace: Workspace, nodeId: string) => ofWorkspace.trees.upgrades?.nodes.find((node) => node.id === nodeId)?.changes;

describe("startNodeEdit", () => {
    it("lays out the node's build on the character, wearing locker pieces where the locker has them", () => {
        const edit = editOf(workspace, "stronger");

        expect(characterOf(edit.workspace, "mechanic")).toEqual(buildOfNode(workspace, "stronger"));
        expect(edit.parentCharacter).toEqual(buildOfNode(workspace, "shield"));
        expect(mechanicOf(edit.workspace).equipment).toEqual({ rightHand: "mace", shield: "spare-shield" });
        expect(edit.workspace.gearPieces).toEqual(workspace.gearPieces);
        expect(parseWorkspace(edit.workspace)).toEqual(edit.workspace);
    });

    it("counts a node under the root from the root", () => {
        expect(editOf(workspace, "shield").parentCharacter).toEqual(characterOf(workspace, "mechanic"));
    });

    it("adds a piece the locker does not hold as one that is not owned, under the same ID every time", () => {
        const edit = editOf(workspace, "refined");
        const wornPieceId = mechanicOf(edit.workspace).equipment.rightHand ?? "";

        expect(wornPieceId).not.toBe("mace");
        expect(edit.workspace.gearPieces[wornPieceId]).toMatchObject({ itemId: maceItemId, refine: 10, owned: false });
        expect(edit.workspace.gearPieces.mace).toEqual(workspace.gearPieces.mace);
        expect(mechanicOf(editOf(workspace, "refined").workspace).equipment.rightHand).toBe(wornPieceId);
    });

    it("has nothing to lay out for a stale node or a node the tree does not have", () => {
        expect(startNodeEdit(workspace, "upgrades", "stale")).toBeUndefined();
        expect(startNodeEdit(workspace, "upgrades", "nobody")).toBeUndefined();
    });
});

describe("storeNodeEdit", () => {
    it("stores nothing new when the copy was not changed", () => {
        const edit = editOf(workspace, "stronger");
        const stored = storeNodeEdit(workspace, edit, edit.workspace);

        expect(buildOfNode(stored.workspace, "stronger")).toEqual(buildOfNode(workspace, "stronger"));
        expect(stored.inexpressible).toEqual([]);
    });

    it("writes what the copy changed into the node, and leaves the locker and the character alone", () => {
        const edit = editOf(workspace, "stronger");
        const edited = replaceLockerPiece(wearLockerPiece(edit.workspace, "mechanic", "shield", null), "mace", { itemId: maceItemId, refine: 12, owned: true });
        const stored = storeNodeEdit(workspace, edit, edited).workspace;

        expect(buildOfNode(stored, "stronger")).toEqual(characterOf(edited, "mechanic"));
        expect(buildOfNode(stored, "stronger").equipment.shield).toBeUndefined();
        expect(buildOfNode(stored, "shield")).toEqual(buildOfNode(workspace, "shield"));
        expect(stored.gearPieces).toEqual(workspace.gearPieces);
        expect(stored.characters).toEqual(workspace.characters);
        expect(parseWorkspace(stored)).toEqual(stored);
    });

    it("points at a locker piece the copy wears unchanged, and holds a copy of one it changed", () => {
        const edit = editOf(workspace, "refined");
        const withShield = wearLockerPiece(edit.workspace, "mechanic", "shield", "spare-shield");
        const stored = storeNodeEdit(workspace, edit, withShield).workspace;

        expect(changesOfNode(stored, "refined")).toEqual([
            { kind: "setGearPiece", slot: "rightHand", gearPiece: { itemId: maceItemId, refine: 10, transcendence: 4, sockets: [null, 659, 1381, 1297] } },
            { kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" },
        ]);
    });

    it("can be edited again from what was stored, to the same build", () => {
        const first = editOf(workspace, "refined");
        const wornPieceId = mechanicOf(first.workspace).equipment.rightHand ?? "";
        const stored = storeNodeEdit(workspace, first, replaceLockerPiece(first.workspace, wornPieceId, { itemId: maceItemId, refine: 11, owned: false })).workspace;
        const second = editOf(stored, "refined");

        expect(characterOf(second.workspace, "mechanic").equipment.rightHand).toEqual({ itemId: maceItemId, refine: 11 });
        expect(mechanicOf(second.workspace).equipment.rightHand).toBe(wornPieceId);
    });

    it("gives the scenario to the tree, since every node shares it", () => {
        const edit = editOf(workspace, "shield");
        const scenario = { skillId: 554, skillLevel: 3, targetMonsterId: 850 };
        const stored = storeNodeEdit(workspace, edit, replaceTreeScenario(edit.workspace, "upgrades", scenario)).workspace;

        expect(stored.trees.upgrades?.scenario).toEqual(scenario);
        expect(changesOfNode(stored, "shield")).toEqual(changesOfNode(workspace, "shield"));
    });

    it("says what a node cannot hold and leaves the node as it was in that respect", () => {
        const edit = editOf(workspace, "shield");
        const stored = storeNodeEdit(workspace, edit, replaceCharacter(edit.workspace, "mechanic", { ...mechanicOf(edit.workspace), baseLevel: 199 }));

        expect(stored.inexpressible).toEqual(["baseLevel"]);
        expect(buildOfNode(stored.workspace, "shield").baseLevel).toBe(200);
    });

    it("gives back the workspace when the node is gone meanwhile", () => {
        const edit = editOf(workspace, "stronger");
        const withoutNodes = mechanicWorkspaceWith([]);

        expect(storeNodeEdit(withoutNodes, edit, edit.workspace).workspace).toBe(withoutNodes);
    });
});

describe("addEmptyTreeNode", () => {
    it("adds a node that changes nothing under the root or under a node", () => {
        const underRoot = addEmptyTreeNode(workspace, "upgrades", null, "variation");
        const underNode = addEmptyTreeNode(workspace, "upgrades", "stronger", "variation");

        expect(underRoot?.nodeId).toBe("branch-1");
        expect(underRoot?.workspace.trees.upgrades?.nodes.at(-1)).toEqual({ id: "branch-1", parentId: null, label: "variation", changes: [] });
        expect(underNode?.workspace.trees.upgrades?.nodes.at(-1)?.parentId).toBe("stronger");
        expect(buildOfNode(underNode?.workspace ?? workspace, "branch-1")).toEqual(buildOfNode(workspace, "stronger"));
        expect(parseWorkspace(underNode?.workspace)).toBeDefined();
    });

    it("adds nothing under a node the tree does not have", () => {
        expect(addEmptyTreeNode(workspace, "upgrades", "nobody", "variation")).toBeUndefined();
    });
});
