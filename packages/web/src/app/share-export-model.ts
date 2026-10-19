import { type Build, buildOf, resolveTree, type Tree } from "@ro-ratorio-branch/core/platform-neutral";

/** How much of the open tree a share code carries. */
export type ExportScope = "rootOnly" | "wholeTree" | "selectedNode";

export const exportScopes: readonly ExportScope[] = ["rootOnly", "wholeTree", "selectedNode"];

/**
 * What a share code of the open tree carries for a scope: the root as a build,
 * the tree, or one node's character as a build. `null` when the scope asks for
 * a node that is not selected, no longer exists, or is stale.
 */
export function exportContentOf(tree: Tree, scope: ExportScope, selectedNodeId: string | null): Build | Tree | null {
    if (scope === "wholeTree") {
        return tree;
    }
    if (scope === "rootOnly") {
        return buildOf(tree.root, tree.scenario);
    }
    const resolution = selectedNodeId === null ? undefined : resolveTree(tree).get(selectedNodeId);
    return resolution?.state === "resolved" ? buildOf(resolution.character, tree.scenario) : null;
}

const bytesPerKilobyte = 1024;

/** A text's size in kilobytes, to one decimal. Share codes are plain ASCII, so one character is one byte. */
export function kilobytesOf(asciiText: string): number {
    return Math.round((asciiText.length / bytesPerKilobyte) * 10) / 10;
}
