import { describe, expect, it } from "vitest";
import {
    addLockerPiece,
    descendantCountOf,
    lockerPieceUsage,
    removeCharacter,
    removeLockerPiece,
    removeTreeNode,
    replaceCharacter,
    replaceLockerPiece,
    replaceTreeScenario,
    wearLockerPiece,
} from "./edit-workspace.ts";
import { parseWorkspace } from "./parse-workspace.ts";
import { characterOf, treeOf, UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import { maceItemId, mechanicWorkspaceWith, shieldItemId, workspaceNode } from "./workspace-test-support.ts";

const workspace = mechanicWorkspaceWith([
    workspaceNode("with-shield", null, [{ kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" }]),
    workspaceNode("refined", "with-shield", [{ kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId, refine: 10 }]),
]);

describe("lockerPieceUsage", () => {
    it("names the characters that wear a piece and the nodes that equip it", () => {
        const usage = lockerPieceUsage(workspace);

        expect(usage.get("mace")).toEqual({ characterIds: ["mechanic"], nodes: [], gearLoadoutIds: [] });
        expect(usage.get("spare-shield")).toEqual({ characterIds: [], nodes: [{ treeId: "upgrades", nodeId: "with-shield" }], gearLoadoutIds: [] });
    });

    it("lists a piece nothing uses, with no usage", () => {
        const added = addLockerPiece(workspace, { itemId: shieldItemId, owned: false }, "shield");

        expect(lockerPieceUsage(added.workspace).get(added.gearPieceId)).toEqual({ characterIds: [], nodes: [], gearLoadoutIds: [] });
    });
});

describe("addLockerPiece", () => {
    it("adds the piece under an unused ID and leaves the rest as it was", () => {
        const first = addLockerPiece(workspace, { itemId: shieldItemId, owned: false }, "shield");
        const second = addLockerPiece(first.workspace, { itemId: shieldItemId, refine: 4, owned: true }, "shield");

        expect([first.gearPieceId, second.gearPieceId]).toEqual(["shield-1", "shield-2"]);
        expect(second.workspace.gearPieces["shield-2"]).toEqual({ itemId: shieldItemId, refine: 4, owned: true });
        expect(second.workspace.gearPieces.mace).toBe(workspace.gearPieces.mace);
        expect(parseWorkspace(second.workspace)).toEqual(second.workspace);
    });
});

describe("replaceLockerPiece", () => {
    it("changes the piece for the character that wears it", () => {
        const edited = replaceLockerPiece(workspace, "mace", { itemId: maceItemId, refine: 12, owned: true });

        expect(characterOf(edited, "mechanic").equipment.rightHand).toEqual({ itemId: maceItemId, refine: 12 });
        expect(characterOf(workspace, "mechanic").equipment.rightHand?.refine).toBe(9);
    });

    it("rejects a piece the locker does not have", () => {
        expect(() => replaceLockerPiece(workspace, "no-such-piece", { itemId: maceItemId, owned: true })).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("removeLockerPiece", () => {
    it("removes a piece nothing uses", () => {
        const added = addLockerPiece(workspace, { itemId: shieldItemId, owned: false }, "shield");

        const removal = removeLockerPiece(added.workspace, added.gearPieceId);

        expect(removal).toEqual({ removed: true, workspace });
    });

    it.each([
        { situation: "a character wears", gearPieceId: "mace", usage: { characterIds: ["mechanic"], nodes: [], gearLoadoutIds: [] } },
        { situation: "a node equips", gearPieceId: "spare-shield", usage: { characterIds: [], nodes: [{ treeId: "upgrades", nodeId: "with-shield" }], gearLoadoutIds: [] } },
    ])("keeps a piece that $situation, and says who uses it", ({ gearPieceId, usage }) => {
        expect(removeLockerPiece(workspace, gearPieceId)).toEqual({ removed: false, usage });
    });

    it("rejects a piece the locker does not have", () => {
        expect(() => removeLockerPiece(workspace, "no-such-piece")).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("wearLockerPiece", () => {
    it("puts a locker piece into a slot", () => {
        const worn = wearLockerPiece(workspace, "mechanic", "shield", "spare-shield");

        expect(characterOf(worn, "mechanic").equipment.shield).toEqual({ itemId: shieldItemId, refine: 7, zenyCost: 50_000_000 });
        expect(parseWorkspace(worn)).toEqual(worn);
    });

    it("takes the shield off for a left-hand weapon, and the left-hand weapon off for a shield", () => {
        const withShield = wearLockerPiece(workspace, "mechanic", "shield", "spare-shield");
        const rightHandPieceId = withShield.characters.mechanic?.equipment.rightHand ?? "";

        const withLeftHand = wearLockerPiece(withShield, "mechanic", "leftHand", rightHandPieceId);
        expect(withLeftHand.characters.mechanic?.equipment).toEqual({ rightHand: rightHandPieceId, leftHand: rightHandPieceId });

        const withShieldAgain = wearLockerPiece(withLeftHand, "mechanic", "shield", "spare-shield");
        expect(withShieldAgain.characters.mechanic?.equipment).toEqual({ rightHand: rightHandPieceId, shield: "spare-shield" });
        expect(wearLockerPiece(withShield, "mechanic", "leftHand", null).characters.mechanic?.equipment).toEqual(withShield.characters.mechanic?.equipment);
    });

    it("empties a slot for null", () => {
        const emptied = wearLockerPiece(workspace, "mechanic", "rightHand", null);

        expect(characterOf(emptied, "mechanic").equipment).toEqual({});
        expect(Object.keys(emptied.gearPieces)).toEqual(Object.keys(workspace.gearPieces));
    });

    it("rejects an unknown character or piece", () => {
        expect(() => wearLockerPiece(workspace, "nobody", "shield", "spare-shield")).toThrow(UnknownWorkspaceEntryError);
        expect(() => wearLockerPiece(workspace, "mechanic", "shield", "no-such-piece")).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("replaceCharacter and replaceTreeScenario", () => {
    it("changes what the tree is rooted in and what it attacks", () => {
        const mechanic = workspace.characters.mechanic;
        if (mechanic === undefined) {
            throw new Error("the test workspace has no mechanic");
        }
        const stronger = replaceCharacter(workspace, "mechanic", { ...mechanic, baseStats: { ...mechanic.baseStats, str: 130 } });
        const retargeted = replaceTreeScenario(stronger, "upgrades", { skillId: 554, skillLevel: 3, targetMonsterId: 851 });

        expect(treeOf(retargeted, "upgrades").root.baseStats.str).toBe(130);
        expect(treeOf(retargeted, "upgrades").scenario).toEqual({ skillId: 554, skillLevel: 3, targetMonsterId: 851 });
        expect(parseWorkspace(retargeted)).toEqual(retargeted);
    });

    it("rejects an unknown character or tree", () => {
        expect(() => replaceCharacter(workspace, "nobody", Object.values(workspace.characters)[0]!)).toThrow(UnknownWorkspaceEntryError);
        expect(() => replaceTreeScenario(workspace, "no-such-tree", { skillId: 554, skillLevel: 1, targetMonsterId: 850 })).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("removeCharacter", () => {
    const withSecondCharacter = (() => {
        const mechanic = workspace.characters.mechanic;
        const upgrades = workspace.trees.upgrades;
        if (mechanic === undefined || upgrades === undefined) {
            throw new Error("the test workspace has no mechanic");
        }
        return {
            ...workspace,
            characters: { ...workspace.characters, alt: { ...mechanic, name: "Alt" } },
            trees: { ...workspace.trees, "alt-upgrades": { ...upgrades, characterId: "alt" }, "mechanic-again": { ...upgrades, name: "Again" } },
        };
    })();

    it("removes the character and every tree it is the root of, and nothing else", () => {
        const removal = removeCharacter(withSecondCharacter, "mechanic");

        expect(Object.keys(removal.workspace.characters)).toEqual(["alt"]);
        expect(Object.keys(removal.workspace.trees)).toEqual(["alt-upgrades"]);
        expect(removal.removedTreeIds).toEqual(["upgrades", "mechanic-again"]);
        expect(parseWorkspace(removal.workspace)).toBeDefined();
    });

    it("keeps the locker, including the pieces the character wore and its trees equipped", () => {
        const removal = removeCharacter(withSecondCharacter, "mechanic");

        expect(removal.workspace.gearPieces).toEqual(withSecondCharacter.gearPieces);
        expect(Object.keys(removal.workspace.gearPieces)).toContain("mace");
        expect(Object.keys(removal.workspace.gearPieces)).toContain("spare-shield");
    });

    it("refuses a character the workspace does not have", () => {
        expect(() => removeCharacter(workspace, "nobody")).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("removeTreeNode", () => {
    const withNodes = mechanicWorkspaceWith([
        workspaceNode("grandchild", "child", []),
        workspaceNode("parent", null, []),
        workspaceNode("child", "parent", []),
        workspaceNode("sibling", null, []),
    ]);

    it("removes the node and every node that builds on it, wherever they stand in the list", () => {
        expect(removeTreeNode(withNodes, "upgrades", "parent").trees.upgrades?.nodes.map((node) => node.id)).toEqual(["sibling"]);
        expect(removeTreeNode(withNodes, "upgrades", "child").trees.upgrades?.nodes.map((node) => node.id)).toEqual(["parent", "sibling"]);
        expect(parseWorkspace(removeTreeNode(withNodes, "upgrades", "parent"))).toBeDefined();
    });

    it("leaves the tree as it is for a node it does not have", () => {
        expect(removeTreeNode(withNodes, "upgrades", "nobody").trees.upgrades?.nodes).toHaveLength(4);
    });

    it("counts what would go with a node", () => {
        expect(["parent", "child", "sibling", "nobody"].map((nodeId) => descendantCountOf(withNodes, "upgrades", nodeId))).toEqual([2, 1, 0, 0]);
    });

    it("refuses a tree the workspace does not have", () => {
        expect(() => removeTreeNode(withNodes, "nowhere", "parent")).toThrow(UnknownWorkspaceEntryError);
    });
});
