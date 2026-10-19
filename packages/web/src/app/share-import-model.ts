import {
    addCharacterToWorkspace,
    addEmptyTreeToWorkspace,
    addTreeToWorkspace,
    changesBetween,
    characterOf,
    firstUnusedId,
    graftNodes,
    type InexpressibleDifference,
    type RecognizedImport,
    type Workspace,
} from "@ro-ratorio-branch/core/platform-neutral";

/** How to take a recognized import into the workspace. */
export type ImportMode = "addAsNew" | "addAsBranch" | "replaceEverything";

/** The modes that make sense for what was recognized. A whole workspace can only replace; nothing else can. */
export function importModesFor(recognized: RecognizedImport): ImportMode[] {
    return recognized.kind === "workspace" ? ["replaceEverything"] : ["addAsNew", "addAsBranch"];
}

export interface AppliedImport {
    readonly workspace: Workspace;
    /** The tree to show afterwards. */
    readonly activeTreeId: string;
    /** Differences a branch could not express. Empty for the other modes. */
    readonly inexpressible: readonly InexpressibleDifference[];
}

/** Takes a recognized import into the workspace in the chosen mode, and says which tree to show. */
export function applyImport(workspace: Workspace, activeTreeId: string, recognized: RecognizedImport, mode: ImportMode, name: string): AppliedImport {
    if (recognized.kind === "workspace") {
        return { workspace: recognized.workspace, activeTreeId: Object.keys(recognized.workspace.trees)[0] ?? activeTreeId, inexpressible: [] };
    }
    const importedCharacter = recognized.kind === "tree" ? recognized.tree.root : recognized.character;

    if (mode === "addAsBranch") {
        const activeTree = workspace.trees[activeTreeId];
        if (activeTree !== undefined) {
            const { changes, inexpressible } = changesBetween(characterOf(workspace, activeTree.characterId), importedCharacter);
            // A tree's branches come along. They build on its root: on the open tree's root when the two are the same, else on a node that makes it so.
            const importedBranches = recognized.kind === "tree" ? recognized.tree.nodes : [];
            const needsBridge = changes.length > 0 || importedBranches.length === 0;
            const bridgeId = firstUnusedId(Object.fromEntries(activeTree.nodes.map((node) => [node.id, node])), "imported");
            const withBridge = needsBridge ? [...activeTree.nodes, { id: bridgeId, parentId: null, label: name, changes: [...changes] }] : activeTree.nodes;
            const { nodes } = graftNodes(withBridge, needsBridge ? bridgeId : null, importedBranches);
            return {
                workspace: { ...workspace, trees: { ...workspace.trees, [activeTreeId]: { ...activeTree, nodes } } },
                activeTreeId,
                inexpressible,
            };
        }
    }

    if (recognized.kind === "tree") {
        const added = addTreeToWorkspace(workspace, recognized.tree, name);
        return { workspace: added.workspace, activeTreeId: added.treeId, inexpressible: [] };
    }
    const addedCharacter = addCharacterToWorkspace(workspace, recognized.character, name);
    if (recognized.scenario === null) {
        return { workspace: addedCharacter.workspace, activeTreeId, inexpressible: [] };
    }
    const addedTree = addEmptyTreeToWorkspace(addedCharacter.workspace, addedCharacter.characterId, recognized.scenario, name);
    return { workspace: addedTree.workspace, activeTreeId: addedTree.treeId, inexpressible: [] };
}
