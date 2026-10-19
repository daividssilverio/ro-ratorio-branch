import { describe, expect, it } from "vitest";
import { graftNodes } from "./graft-nodes.ts";

const node = (id: string, parentId: string | null) => ({ id, parentId, label: id });

describe("graftNodes", () => {
    const existing = [node("branch-1", null), node("branch-2", "branch-1")];

    it("puts the attached nodes that built on their root under the node asked for, and keeps their own links", () => {
        const { nodes } = graftNodes(existing, "branch-2", [node("shoes-1", null), node("shoes-1-refine-9", "shoes-1")]);

        expect(nodes.map((grafted) => [grafted.id, grafted.parentId])).toEqual([
            ["branch-1", null],
            ["branch-2", "branch-1"],
            ["shoes-1", "branch-2"],
            ["shoes-1-refine-9", "shoes-1"],
        ]);
    });

    it("gives a taken ID a free one, and the nodes that build on it follow", () => {
        const { nodes, idOf } = graftNodes(existing, null, [node("branch-1", null), node("branch-2", "branch-1"), node("branch-1-2", null)]);

        expect(idOf.get("branch-1")).toBe("branch-1-2");
        expect(idOf.get("branch-2")).toBe("branch-2-2");
        expect(idOf.get("branch-1-2")).toBe("branch-1-2-2");
        expect(nodes.slice(2).map((grafted) => [grafted.id, grafted.parentId])).toEqual([
            ["branch-1-2", null],
            ["branch-2-2", "branch-1-2"],
            ["branch-1-2-2", null],
        ]);
        expect(new Set(nodes.map((grafted) => grafted.id)).size).toBe(nodes.length);
    });

    it("attaches under the root for no parent", () => {
        expect(graftNodes([], null, [node("a", null)]).nodes).toEqual([node("a", null)]);
    });
});
