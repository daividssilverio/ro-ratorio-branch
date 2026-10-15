import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serializePublishedSchema } from "../build/published-schema.ts";
import { resolveTree } from "../tree/resolve-tree.ts";
import { commitNodeToLocker } from "./commit-to-locker.ts";
import { InvalidWorkspaceError, parseWorkspace, type WorkspaceIssue } from "./parse-workspace.ts";
import { characterOf, treeOf, UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import { workspaceJsonSchema, type WorkspaceChange } from "./workspace-format.ts";
import { maceItemId, mechanicWorkspaceWith, shieldItemId, workspaceNode } from "./workspace-test-support.ts";

const refineMaceToTen = { kind: "setRefine", slot: "rightHand", expectedItemId: maceItemId, refine: 10 } satisfies WorkspaceChange;
const refineMaceToEleven = { ...refineMaceToTen, refine: 11 } satisfies WorkspaceChange;
const equipSpareShield = { kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" } satisfies WorkspaceChange;
const raiseStrength = { kind: "setBaseStat", stat: "str", value: 130 } satisfies WorkspaceChange;

function issuesOf(candidate: unknown): readonly WorkspaceIssue[] {
    try {
        parseWorkspace(candidate);
    } catch (error) {
        if (error instanceof InvalidWorkspaceError) {
            return error.issues;
        }
        throw error;
    }
    return [];
}

describe("parseWorkspace", () => {
    it("accepts a workspace with a locker, a character and a tree that equips a locker piece", () => {
        const candidate = mechanicWorkspaceWith([workspaceNode("shield", null, [equipSpareShield, refineMaceToTen])]);

        expect(parseWorkspace(candidate)).toBe(candidate);
    });

    it("rejects a locker piece that does not say whether it is owned", () => {
        const candidate = mechanicWorkspaceWith([]);
        Reflect.deleteProperty(candidate.gearPieces["mace"] ?? {}, "owned");

        expect(issuesOf(candidate)).toEqual([{ path: "/gearPieces/mace/owned", kind: "missing", rule: "required" }]);
    });

    it("rejects a character wearing a piece that is not in the locker", () => {
        const candidate = mechanicWorkspaceWith([]);
        Object.assign(candidate.characters["mechanic"]?.equipment ?? {}, { shield: "gone" });

        expect(issuesOf(candidate)).toEqual([
            { kind: "unknownGearPiece", gearPieceId: "gone", path: "/characters/mechanic/equipment/shield" },
        ]);
    });

    it("rejects a node equipping a piece that is not in the locker", () => {
        const candidate = mechanicWorkspaceWith([workspaceNode("shield", null, [{ ...equipSpareShield, gearPieceId: "gone" }])]);

        expect(issuesOf(candidate)).toEqual([
            { kind: "unknownGearPiece", gearPieceId: "gone", path: "/trees/upgrades/nodes/0/changes/0" },
        ]);
    });

    it("rejects a tree whose character is missing", () => {
        const candidate = mechanicWorkspaceWith([]);
        Object.assign(candidate.trees["upgrades"] ?? {}, { characterId: "nobody" });

        expect(issuesOf(candidate)).toEqual([{ kind: "unknownCharacter", characterId: "nobody", treeId: "upgrades" }]);
    });

    it("names the tree when its nodes do not hang together", () => {
        const candidate = mechanicWorkspaceWith([workspaceNode("orphan", "gone", [])]);

        expect(issuesOf(candidate)).toEqual([{ kind: "unknownParent", nodeId: "orphan", parentId: "gone", treeId: "upgrades" }]);
    });

    it("reports a wrong change once, with its place in the workspace", () => {
        const candidate = mechanicWorkspaceWith([workspaceNode("refine", null, [{ ...refineMaceToTen, refine: -1 }])]);

        expect(issuesOf(candidate)).toEqual([
            { path: "/trees/upgrades/nodes/0/changes/0/refine", kind: "invalid", rule: "minimum" },
        ]);
    });
});

describe("characterOf and treeOf", () => {
    it("writes out the pieces a character wears, without the locker's bookkeeping", () => {
        const character = characterOf(mechanicWorkspaceWith([]), "mechanic");

        expect(character.equipment).toEqual({
            rightHand: { itemId: maceItemId, refine: 9, transcendence: 4, sockets: [null, 659, 1381, 1297] },
        });
        expect(Object.hasOwn(character, "name")).toBe(false);
    });

    it("turns equipping a locker piece into a change that carries the piece itself", () => {
        const tree = treeOf(mechanicWorkspaceWith([workspaceNode("shield", null, [equipSpareShield])]), "upgrades");

        expect(tree.nodes[0]?.changes).toEqual([
            { kind: "setGearPiece", slot: "shield", gearPiece: { itemId: shieldItemId, refine: 7, zenyCost: 50_000_000 } },
        ]);
    });

    it("gives a tree the tree functions can resolve", () => {
        const tree = treeOf(mechanicWorkspaceWith([workspaceNode("refine", null, [refineMaceToTen])]), "upgrades");

        const resolution = resolveTree(tree).get("refine");

        expect(resolution?.state === "resolved" && resolution.character.equipment.rightHand?.refine).toBe(10);
    });

    it("refuses a tree or character the workspace does not have", () => {
        const workspace = mechanicWorkspaceWith([]);

        expect(() => treeOf(workspace, "nothing")).toThrow(UnknownWorkspaceEntryError);
        expect(() => characterOf(workspace, "nobody")).toThrow(expect.objectContaining({ entryKind: "character", entryId: "nobody" }));
    });
});

describe("commitNodeToLocker", () => {
    it("writes a node's refine into the locker piece and removes the change from the node", () => {
        const workspace = mechanicWorkspaceWith([workspaceNode("refine", null, [refineMaceToTen, raiseStrength])]);

        const commit = commitNodeToLocker(workspace, "upgrades", "refine");

        expect(commit.workspace.gearPieces["mace"]?.refine).toBe(10);
        expect(commit.workspace.trees["upgrades"]?.nodes[0]?.changes).toEqual([raiseStrength]);
        expect(commit.committedChanges).toEqual([refineMaceToTen]);
        expect(commit.skippedChanges).toEqual([]);
    });

    it("leaves the workspace it was given untouched", () => {
        const workspace = mechanicWorkspaceWith([workspaceNode("refine", null, [refineMaceToTen])]);

        commitNodeToLocker(workspace, "upgrades", "refine");

        expect(workspace.gearPieces["mace"]?.refine).toBe(9);
        expect(workspace.trees["upgrades"]?.nodes[0]?.changes).toEqual([refineMaceToTen]);
    });

    it("commits the whole path, so a later step still builds on the earlier ones", () => {
        const workspace = mechanicWorkspaceWith([
            workspaceNode("ten", null, [refineMaceToTen]),
            workspaceNode("eleven", "ten", [refineMaceToEleven]),
            workspaceNode("elsewhere", null, [raiseStrength]),
        ]);

        const commit = commitNodeToLocker(workspace, "upgrades", "eleven");

        expect(commit.workspace.gearPieces["mace"]?.refine).toBe(11);
        expect(commit.workspace.trees["upgrades"]?.nodes.map((node) => node.changes)).toEqual([[], [], [raiseStrength]]);
        const afterCommit = resolveTree(treeOf(commit.workspace, "upgrades")).get("eleven");
        expect(afterCommit?.state === "resolved" && afterCommit.character.equipment.rightHand?.refine).toBe(11);
    });

    it("writes into the piece a node equipped from the locker, not the one the character wore before", () => {
        const refineSpareShield = { kind: "setRefine", slot: "shield", expectedItemId: shieldItemId, refine: 9 } satisfies WorkspaceChange;
        const workspace = mechanicWorkspaceWith([workspaceNode("shield", null, [equipSpareShield, refineSpareShield])]);

        const commit = commitNodeToLocker(workspace, "upgrades", "shield");

        expect(commit.workspace.gearPieces["spare-shield"]?.refine).toBe(9);
        expect(commit.workspace.gearPieces["spare-shield"]?.owned).toBe(false);
        expect(commit.workspace.trees["upgrades"]?.nodes[0]?.changes).toEqual([equipSpareShield]);
    });

    it("writes a whole piece of the same item into the locker piece the slot holds", () => {
        const refinedMace = { kind: "setGearPiece", slot: "rightHand", gearPiece: { itemId: maceItemId, refine: 12, sockets: [46] } } satisfies WorkspaceChange;
        const workspace = mechanicWorkspaceWith([workspaceNode("refined", null, [refinedMace, raiseStrength])]);

        const commit = commitNodeToLocker(workspace, "upgrades", "refined");

        expect(commit.workspace.gearPieces["mace"]).toEqual({ itemId: maceItemId, refine: 12, sockets: [46], owned: true });
        expect(commit.workspace.trees["upgrades"]?.nodes[0]?.changes).toEqual([raiseStrength]);
        expect(commit.committedChanges).toEqual([refinedMace]);
        expect(parseWorkspace(commit.workspace)).toEqual(commit.workspace);
    });

    it("adds a whole piece of another item to the locker as owned, and has the node wear it from there", () => {
        const anotherWeapon = { kind: "setGearPiece", slot: "rightHand", gearPiece: { itemId: maceItemId + 1, refine: 4 } } satisfies WorkspaceChange;
        const workspace = mechanicWorkspaceWith([workspaceNode("swapped", null, [anotherWeapon])]);
        const before = resolveTree(treeOf(workspace, "upgrades")).get("swapped");

        const commit = commitNodeToLocker(workspace, "upgrades", "swapped");
        const [change] = commit.workspace.trees["upgrades"]?.nodes[0]?.changes ?? [];
        const addedPieceId = change?.kind === "equipLockerPiece" ? change.gearPieceId : "";

        expect(commit.workspace.gearPieces[addedPieceId]).toEqual({ itemId: maceItemId + 1, refine: 4, owned: true });
        expect(commit.workspace.gearPieces["mace"]).toEqual(workspace.gearPieces["mace"]);
        expect(resolveTree(treeOf(commit.workspace, "upgrades")).get("swapped")).toEqual(before);
        expect(parseWorkspace(commit.workspace)).toEqual(commit.workspace);
    });

    it("skips a change made for another item and keeps it in the node", () => {
        const changeForAnotherItem = { ...refineMaceToTen, expectedItemId: shieldItemId } satisfies WorkspaceChange;
        const workspace = mechanicWorkspaceWith([workspaceNode("mismatch", null, [changeForAnotherItem])]);

        const commit = commitNodeToLocker(workspace, "upgrades", "mismatch");

        expect(commit.skippedChanges).toEqual([{ change: changeForAnotherItem, reason: "slotHoldsAnotherItem" }]);
        expect(commit.workspace.gearPieces["mace"]?.refine).toBe(9);
        expect(commit.workspace.trees["upgrades"]?.nodes[0]?.changes).toEqual([changeForAnotherItem]);
    });

    it("skips a change to a slot that holds no locker piece", () => {
        const refineEmptySlot = { kind: "setRefine", slot: "shoes", expectedItemId: 4685, refine: 9 } satisfies WorkspaceChange;
        const workspace = mechanicWorkspaceWith([workspaceNode("shoes", null, [refineEmptySlot])]);

        expect(commitNodeToLocker(workspace, "upgrades", "shoes").skippedChanges).toEqual([
            { change: refineEmptySlot, reason: "slotHoldsNoLockerPiece" },
        ]);
    });
});

describe("published workspace schema", () => {
    it("is the schema the parser checks against (run `pnpm --filter @ro-ratorio-branch/core run schema` after a change)", () => {
        const publishedSchemaText = readFileSync(new URL("../../schema/workspace.v1.schema.json", import.meta.url), "utf8");

        expect(publishedSchemaText).toBe(serializePublishedSchema(workspaceJsonSchema));
    });
});
