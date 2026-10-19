import {
    addTreeToWorkspace,
    emptyWorkspace,
    parseBuild,
    parseTree,
    resolveTree,
    treeOf,
} from "@ro-ratorio-branch/core/platform-neutral";
import exampleTreeFileContent from "@ro-ratorio-branch/core/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyImport, importModesFor } from "./share-import-model.ts";

const exampleTree = parseTree(exampleTreeFileContent);
const goldenBuild = (goldenBuildName: string) =>
    parseBuild(JSON.parse(readFileSync(new URL(`../../../core/src/build/golden-builds/${goldenBuildName}.build.json`, import.meta.url), "utf8")));
const otherMechanicBuild = goldenBuild("mechanic-arms-cannon-soul-cannonball");

describe("importModesFor", () => {
    it("lets a workspace backup only replace, and anything else only add", async () => {
        const workspace = addTreeToWorkspace(emptyWorkspace(), exampleTree, "tree").workspace;

        expect(importModesFor({ kind: "workspace", source: "json", workspace })).toEqual(["replaceEverything"]);
        expect(importModesFor({ kind: "tree", source: "json", tree: exampleTree })).toEqual(["addAsNew", "addAsBranch"]);
    });
});

describe("applyImport", () => {
    const start = addTreeToWorkspace(emptyWorkspace(), exampleTree, "mine");

    it("adds a tree as a new tree and shows it, leaving the open one as it was", () => {
        const applied = applyImport(start.workspace, start.treeId, { kind: "tree", source: "json", tree: exampleTree }, "addAsNew", "theirs");

        expect(applied.activeTreeId).not.toBe(start.treeId);
        expect(treeOf(applied.workspace, applied.activeTreeId)).toEqual(exampleTree);
        expect(treeOf(applied.workspace, start.treeId)).toEqual(exampleTree);
    });

    it("adds a character with a scenario as a new character with an empty tree", () => {
        const character = { kind: "character", source: "json", character: otherMechanicBuild.character, scenario: otherMechanicBuild.scenario, notImported: [] } as const;

        const applied = applyImport(start.workspace, start.treeId, character, "addAsNew", "theirs");

        expect(treeOf(applied.workspace, applied.activeTreeId)).toEqual({
            formatVersion: 1,
            scenario: otherMechanicBuild.scenario,
            root: otherMechanicBuild.character,
            nodes: [],
        });
    });

    it("adds a tree's branches to the open tree under its root, when the two roots are the same", () => {
        const applied = applyImport(start.workspace, start.treeId, { kind: "tree", source: "json", tree: exampleTree }, "addAsBranch", "theirs");
        const tree = treeOf(applied.workspace, start.treeId);

        expect(applied.activeTreeId).toBe(start.treeId);
        expect(tree.nodes).toHaveLength(exampleTree.nodes.length * 2);
        const added = tree.nodes.slice(exampleTree.nodes.length);
        expect(added.map((node) => node.label)).toEqual(exampleTree.nodes.map((node) => node.label));
        expect(new Set(tree.nodes.map((node) => node.id)).size).toBe(tree.nodes.length);
        const resolutions = resolveTree(tree);
        for (const [index, node] of added.entries()) {
            const original = resolveTree(exampleTree).get(exampleTree.nodes[index]?.id ?? "");
            const resolved = resolutions.get(node.id);
            expect(resolved?.state === "resolved" && resolved.character).toEqual(original?.state === "resolved" && original.character);
        }
    });

    it("adds a tree with another root as one node that turns the root into it, with its branches under that node", () => {
        const otherRooted = { ...exampleTree, root: otherMechanicBuild.character };
        const applied = applyImport(start.workspace, start.treeId, { kind: "tree", source: "json", tree: otherRooted }, "addAsBranch", "theirs");
        const tree = treeOf(applied.workspace, start.treeId);
        const bridge = tree.nodes[exampleTree.nodes.length];
        const added = tree.nodes.slice(exampleTree.nodes.length + 1);

        expect(bridge).toMatchObject({ label: "theirs", parentId: null });
        expect(added.filter((node) => exampleTree.nodes.find((original) => original.label === node.label)?.parentId === null).every((node) => node.parentId === bridge?.id)).toBe(true);
        const resolvedBridge = resolveTree(tree).get(bridge?.id ?? "");
        expect(resolvedBridge?.state === "resolved" && resolvedBridge.character.equipment).toEqual(otherMechanicBuild.character.equipment);
    });

    it("adds a character as a branch of the open tree whose node turns the root into that character", () => {
        const character = { kind: "character", source: "json", character: otherMechanicBuild.character, scenario: null, notImported: [] } as const;

        const applied = applyImport(start.workspace, start.treeId, character, "addAsBranch", "theirs");

        expect(applied.activeTreeId).toBe(start.treeId);
        const tree = treeOf(applied.workspace, start.treeId);
        const branch = tree.nodes.at(-1);
        expect(branch?.label).toBe("theirs");
        const resolution = resolveTree(tree).get(branch?.id ?? "");
        expect(resolution?.state === "resolved" && resolution.character.equipment).toEqual(otherMechanicBuild.character.equipment);
        expect(resolution?.state === "resolved" && resolution.character.timedItems).toEqual(otherMechanicBuild.character.timedItems);
        expect(applied.inexpressible).toEqual([]);
    });

    it("replaces everything with a workspace backup and shows its first tree", () => {
        const backup = addTreeToWorkspace(emptyWorkspace(), { ...exampleTree, nodes: [] }, "backup");

        const applied = applyImport(start.workspace, start.treeId, { kind: "workspace", source: "json", workspace: backup.workspace }, "replaceEverything", "ignored");

        expect(applied).toEqual({ workspace: backup.workspace, activeTreeId: backup.treeId, inexpressible: [] });
    });
});
