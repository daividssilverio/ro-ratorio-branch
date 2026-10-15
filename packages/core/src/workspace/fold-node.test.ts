import { describe, expect, it } from "vitest";
import { resolveTree } from "../tree/resolve-tree.ts";
import { foldNodeIntoParent, makeNodeTheRoot } from "./fold-node.ts";
import { parseWorkspace } from "./parse-workspace.ts";
import { characterOf, treeOf } from "./resolve-workspace.ts";
import type { Workspace, WorkspaceTreeNode } from "./workspace-format.ts";
import { maceItemId, mechanicWorkspaceWith, shieldItemId, workspaceNode } from "./workspace-test-support.ts";

const priced = (node: WorkspaceTreeNode, zenyCost: number): WorkspaceTreeNode => ({ ...node, zenyCost });
const workspace = mechanicWorkspaceWith([
    priced(workspaceNode("refined", null, [{ kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId, refine: 10 }]), 300),
    priced(workspaceNode("shielded", "refined", [{ kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" }]), 50),
    workspaceNode("stronger", "shielded", [{ kind: "setBaseStat", stat: "str", value: 130 }]),
    workspaceNode("carded", "refined", [{ kind: "setSocket", slot: "rightHand", expectedItemId: maceItemId, socket: 1, cardOrEnchantId: 46 }]),
    workspaceNode("agile", null, [{ kind: "setBaseStat", stat: "agi", value: 120 }]),
    workspaceNode("another-weapon", null, [{ kind: "setGearPiece", slot: "rightHand", gearPiece: { itemId: maceItemId + 1 } }]),
    workspaceNode("stale", null, [{ kind: "setRefine", slot: "rightHand", expectedItemId: shieldItemId, refine: 10 }]),
]);
const folded = (ofWorkspace: Workspace, nodeId: string) => {
    const result = foldNodeIntoParent(ofWorkspace, "upgrades", nodeId);
    if (result.state !== "folded") {
        throw new Error(`node ${nodeId} was not folded: ${result.state}`);
    }
    return result;
};
const rooted = (ofWorkspace: Workspace, nodeId: string) => {
    const result = makeNodeTheRoot(ofWorkspace, "upgrades", nodeId);
    if (result.state !== "folded") {
        throw new Error(`node ${nodeId} was not made the root: ${result.state}`);
    }
    return result;
};
const buildOfNode = (ofWorkspace: Workspace, nodeId: string) => {
    const resolution = resolveTree(treeOf(ofWorkspace, "upgrades")).get(nodeId);
    if (resolution?.state !== "resolved") {
        throw new Error(`node ${nodeId} did not resolve`);
    }
    return resolution.character;
};
const nodeOf = (ofWorkspace: Workspace, nodeId: string) => ofWorkspace.trees.upgrades?.nodes.find((node) => node.id === nodeId);
const idsOf = (ofWorkspace: Workspace) => ofWorkspace.trees.upgrades?.nodes.map((node) => node.id);

describe("folding a node into the node it builds on", () => {
    const result = folded(workspace, "shielded");

    it("gives the parent the changes of both, in order, and removes the node", () => {
        expect(result.parentNodeId).toBe("refined");
        expect(idsOf(result.workspace)).toEqual(["refined", "stronger", "carded", "agile", "another-weapon", "stale"]);
        expect(nodeOf(result.workspace, "refined")?.changes).toEqual([
            { kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId, refine: 10 },
            { kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" },
        ]);
        expect(buildOfNode(result.workspace, "refined")).toEqual(buildOfNode(workspace, "shielded"));
        expect(parseWorkspace(result.workspace)).toEqual(result.workspace);
    });

    it("adds up the costs of the two steps, and keeps a cost only one of them has", () => {
        expect(nodeOf(result.workspace, "refined")?.zenyCost).toBe(350);
        expect(nodeOf(folded(workspace, "stronger").workspace, "shielded")?.zenyCost).toBe(50);
        expect(nodeOf(folded(mechanicWorkspaceWith([workspaceNode("a", null, []), workspaceNode("b", "a", [])]), "b").workspace, "a")).toEqual(workspaceNode("a", null, []));
    });

    it("hands the node's children to the parent with their builds unchanged", () => {
        expect(nodeOf(result.workspace, "stronger")?.parentId).toBe("refined");
        expect(buildOfNode(result.workspace, "stronger")).toEqual(buildOfNode(workspace, "stronger"));
    });

    it("leaves the changes of the nodes beside it as written, so that they now build on what was folded in", () => {
        expect(nodeOf(result.workspace, "carded")).toEqual(nodeOf(workspace, "carded"));
        expect(buildOfNode(result.workspace, "carded").equipment.shield).toEqual(buildOfNode(workspace, "shielded").equipment.shield);
        expect(result.workspace.gearPieces).toEqual(workspace.gearPieces);
        expect(result.workspace.characters).toEqual(workspace.characters);
    });
});

describe("making a node the root", () => {
    const result = rooted(workspace, "shielded");
    const wornPieceIds = result.workspace.characters.mechanic?.equipment ?? {};

    it("gives the character the node's build without changing a piece in the locker", () => {
        expect(result.parentNodeId).toBeNull();
        expect(characterOf(result.workspace, "mechanic")).toEqual(buildOfNode(workspace, "shielded"));
        expect(result.workspace.gearPieces.mace).toEqual(workspace.gearPieces.mace);
        expect(result.workspace.gearPieces["spare-shield"]).toEqual(workspace.gearPieces["spare-shield"]);
        expect(parseWorkspace(result.workspace)).toEqual(result.workspace);
    });

    it("wears the locker piece that is the node's piece, and adds what the locker does not have as not owned", () => {
        expect(wornPieceIds.shield).toBe("spare-shield");
        expect(wornPieceIds.rightHand).not.toBe("mace");
        expect(result.workspace.gearPieces[wornPieceIds.rightHand ?? ""]).toMatchObject({ itemId: maceItemId, refine: 10, owned: false });
        expect(Object.keys(result.workspace.gearPieces)).toHaveLength(Object.keys(workspace.gearPieces).length + 1);
    });

    it("removes the node and the nodes it built on, and puts what built on any of them under the root", () => {
        expect(idsOf(result.workspace)).toEqual(["stronger", "carded", "agile", "another-weapon", "stale"]);
        expect(result.workspace.trees.upgrades?.nodes.every((node) => node.parentId === null)).toBe(true);
    });

    it("keeps the build of what built on the node", () => {
        expect(buildOfNode(result.workspace, "stronger")).toEqual(buildOfNode(workspace, "stronger"));
    });

    it("leaves the other nodes' changes as written, so that they now build on the new root", () => {
        expect(nodeOf(result.workspace, "carded")?.changes).toEqual(nodeOf(workspace, "carded")?.changes);
        expect(buildOfNode(result.workspace, "carded").equipment.shield).toEqual(buildOfNode(workspace, "shielded").equipment.shield);
        expect(buildOfNode(result.workspace, "agile").equipment.rightHand?.refine).toBe(10);
        expect(buildOfNode(result.workspace, "agile").baseStats.agi).toBe(120);
    });

    it("takes stats and settings as well as gear", () => {
        expect(rooted(workspace, "agile").workspace.characters.mechanic?.baseStats.agi).toBe(120);
        expect(rooted(workspace, "agile").workspace.gearPieces).toEqual(workspace.gearPieces);
    });

    it("is what folding a node directly under the root does", () => {
        expect(folded(workspace, "refined")).toEqual(rooted(workspace, "refined"));
    });
});

describe("what cannot be folded", () => {
    it("is a node whose changes no longer fit, when the root would have to take its build", () => {
        expect(foldNodeIntoParent(workspace, "upgrades", "stale")).toEqual({ state: "stale" });
        expect(makeNodeTheRoot(workspace, "upgrades", "stale")).toEqual({ state: "stale" });
    });

    it("is a node the tree does not have", () => {
        expect(foldNodeIntoParent(workspace, "upgrades", "nobody")).toEqual({ state: "unknownNode" });
        expect(makeNodeTheRoot(workspace, "upgrades", "nobody")).toEqual({ state: "unknownNode" });
    });
});
