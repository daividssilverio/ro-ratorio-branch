import type { Workspace, WorkspaceChange, WorkspaceTreeNode } from "./workspace-format.ts";

export const maceItemId = 4411;
export const shieldItemId = 4936;

export function workspaceNode(id: string, parentId: string | null, changes: WorkspaceChange[]): WorkspaceTreeNode {
    return { id, parentId, label: id, changes };
}

/** A Mechanic wearing a +9 mace from the locker, with a spare shield in the locker and one tree. */
export function mechanicWorkspaceWith(nodes: WorkspaceTreeNode[]): Workspace {
    return {
        formatVersion: 1,
        gearPieces: {
            mace: { itemId: maceItemId, refine: 9, transcendence: 4, sockets: [null, 659, 1381, 1297], owned: true },
            "spare-shield": { itemId: shieldItemId, refine: 7, owned: false, zenyCost: 50_000_000 },
        },
        characters: {
            mechanic: {
                name: "メカニック",
                jobId: 51,
                baseLevel: 200,
                jobLevel: 70,
                baseStats: { str: 110, agi: 110, vit: 100, int: 100, dex: 110, luk: 78 },
                equipment: { rightHand: "mace" },
            },
        },
        trees: {
            upgrades: {
                name: "upgrades",
                characterId: "mechanic",
                scenario: { skillId: 554, skillLevel: 5, skillOptions: [1], targetMonsterId: 850 },
                nodes,
            },
        },
    };
}
