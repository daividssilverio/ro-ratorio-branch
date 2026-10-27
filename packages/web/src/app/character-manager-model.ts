import type { Workspace } from "@ro-ratorio-branch/core/platform-neutral";

export interface ManagedTree {
    readonly id: string;
    readonly name: string;
    readonly nodeCount: number;
    readonly isOpen: boolean;
}

export interface ManagedCharacter {
    readonly id: string;
    readonly name: string;
    readonly jobId: number;
    readonly baseLevel: number;
    /** Its trees in the workspace's order; none for a character nothing shows. */
    readonly trees: readonly ManagedTree[];
}

/** Every character of the workspace with its trees, in the workspace's order, to look over and clear out. */
export function managedCharactersOf(workspace: Workspace, openTreeId: string): ManagedCharacter[] {
    const treeEntries = Object.entries(workspace.trees);
    return Object.entries(workspace.characters).map(([characterId, character]) => ({
        id: characterId,
        name: character.name,
        jobId: character.jobId,
        baseLevel: character.baseLevel,
        trees: treeEntries
            .filter(([, tree]) => tree.characterId === characterId)
            .map(([treeId, tree]) => ({ id: treeId, name: tree.name, nodeCount: tree.nodes.length, isOpen: treeId === openTreeId })),
    }));
}

/** The tree to open after a removal: the one that was open while it is still there, else the first. */
export function treeToOpenAfterRemoval(workspace: Workspace, openTreeId: string): string | undefined {
    return Object.hasOwn(workspace.trees, openTreeId) ? openTreeId : Object.keys(workspace.trees)[0];
}
