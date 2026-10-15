import { buildOf, parseTree, resolveTree } from "@ro-ratorio-branch/core/platform-neutral";
import exampleTreeFileContent from "@ro-ratorio-branch/core/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { exportContentOf, kilobytesOf, shareCodeInFragment, shareLinkOf } from "./share-export-model.ts";

const exampleTree = parseTree(exampleTreeFileContent);
const firstNodeId = exampleTree.nodes[0]?.id ?? "";

describe("exportContentOf", () => {
    it("gives the tree itself for the whole tree", () => {
        expect(exportContentOf(exampleTree, "wholeTree", null)).toBe(exampleTree);
    });

    it("gives the root as a build with the tree's scenario for the root only", () => {
        expect(exportContentOf(exampleTree, "rootOnly", firstNodeId)).toEqual(buildOf(exampleTree.root, exampleTree.scenario));
    });

    it("gives the selected node's character as a build", () => {
        const resolution = resolveTree(exampleTree).get(firstNodeId);
        const nodeCharacter = resolution?.state === "resolved" ? resolution.character : undefined;

        expect(nodeCharacter).toBeDefined();
        expect(nodeCharacter).not.toEqual(exampleTree.root);
        expect(exportContentOf(exampleTree, "selectedNode", firstNodeId)).toEqual({ formatVersion: 1, character: nodeCharacter, scenario: exampleTree.scenario });
    });

    it.each([
        { situation: "no node is selected", selectedNodeId: null },
        { situation: "the selected node is gone", selectedNodeId: "no-such-node" },
    ])("gives nothing for the selected node when $situation", ({ selectedNodeId }) => {
        expect(exportContentOf(exampleTree, "selectedNode", selectedNodeId)).toBeNull();
    });
});

describe("share links", () => {
    it("puts the code in the fragment and drops the query, and reads it back", () => {
        const link = shareLinkOf("https://example.org/branch/?utm=1#old", "B1.abc_DEF-123");

        expect(link).toBe("https://example.org/branch/#B1.abc_DEF-123");
        expect(shareCodeInFragment(new URL(link).hash)).toBe("B1.abc_DEF-123");
    });

    it.each(["", "#", "#tree", "#B1.", "#B1.abc def", "#xB1.abc"])("finds no share code in the fragment %j", (urlFragment) => {
        expect(shareCodeInFragment(urlFragment)).toBeNull();
    });
});

describe("kilobytesOf", () => {
    it("rounds to one decimal", () => {
        expect(kilobytesOf("a".repeat(1229))).toBe(1.2);
        expect(kilobytesOf("")).toBe(0);
    });
});
