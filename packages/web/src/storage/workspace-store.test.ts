import { addTreeToWorkspace, emptyWorkspace, parseTree, treeOf, type Workspace } from "@ro-ratorio-branch/core/platform-neutral";
import exampleTreeFileContent from "@ro-ratorio-branch/core/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { openWorkspace, type WorkspaceStore } from "./workspace-store.ts";

const exampleTree = parseTree(exampleTreeFileContent);
const treeWithoutNodes = { ...exampleTree, nodes: [] };

function storeHolding(storedDocument: unknown): WorkspaceStore & { saved: Workspace[] } {
    const saved: Workspace[] = [];
    return {
        saved,
        load: async () => storedDocument,
        save: async (workspace) => {
            saved.push(workspace);
        },
    };
}

describe("openWorkspace", () => {
    it("opens the stored workspace and its first tree", async () => {
        const stored = addTreeToWorkspace(emptyWorkspace(), treeWithoutNodes, "stored tree");

        const opened = await openWorkspace(storeHolding(stored.workspace), null, exampleTree);

        expect(opened).toEqual({ workspace: stored.workspace, activeTreeId: stored.treeId, origin: "stored" });
    });

    it("opens the tree that was open last time, or the first when that one is gone", async () => {
        const first = addTreeToWorkspace(emptyWorkspace(), treeWithoutNodes, "first tree");
        const second = addTreeToWorkspace(first.workspace, treeWithoutNodes, "second tree");

        expect((await openWorkspace(storeHolding(second.workspace), null, exampleTree, second.treeId)).activeTreeId).toBe(second.treeId);
        expect((await openWorkspace(storeHolding(second.workspace), null, exampleTree, "a tree that was removed")).activeTreeId).toBe(first.treeId);
    });

    it("starts from the example tree when nothing is stored", async () => {
        const opened = await openWorkspace(storeHolding(undefined), null, exampleTree);

        expect(opened.origin).toBe("example");
        expect(treeOf(opened.workspace, opened.activeTreeId)).toEqual(exampleTree);
    });

    it("carries over the tree an earlier version kept, in preference to the example", async () => {
        const opened = await openWorkspace(storeHolding(undefined), JSON.stringify(treeWithoutNodes), exampleTree);

        expect(opened.origin).toBe("earlierVersionTree");
        expect(treeOf(opened.workspace, opened.activeTreeId)).toEqual(treeWithoutNodes);
    });

    it("starts from the example when the stored document is not a workspace", async () => {
        const opened = await openWorkspace(storeHolding({ formatVersion: 99 }), null, exampleTree);

        expect(opened.origin).toBe("example");
    });

    it("ignores an earlier version's tree that no longer parses", async () => {
        const opened = await openWorkspace(storeHolding(undefined), "{ not json", exampleTree);

        expect(opened.origin).toBe("example");
    });

    it("gives a stored workspace without trees the example tree, keeping what it holds", async () => {
        const stored = addTreeToWorkspace(emptyWorkspace(), treeWithoutNodes, "to be removed");
        const withoutTrees = { ...stored.workspace, trees: {} };

        const opened = await openWorkspace(storeHolding(withoutTrees), null, exampleTree);

        expect(opened.origin).toBe("example");
        expect(Object.keys(opened.workspace.characters)).toHaveLength(2);
    });
});
