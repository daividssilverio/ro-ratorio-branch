import { parseBuild } from "../build/parse-build.ts";
import mechanicArmsCannonBuild from "../build/golden-builds/mechanic-arms-cannon.build.json" with { type: "json" };
import type { Change, Tree, TreeNode } from "./tree-format.ts";

/** The golden Mechanic build, whose numbers the upstream page confirms. */
export const mechanicBuild = parseBuild(mechanicArmsCannonBuild);
export const mechanicDamageShownUpstream = { averageDamagePerAttack: 911001, averageDamagePerSecond: 6507149 };

export const maceItemId = 4411;
export const anotherWeaponItemId = 5476;

export const refineMaceToTen = {
    kind: "setRefine",
    slot: "rightHand",
    expectedItemId: maceItemId,
    refine: 10,
} satisfies Change;

export function treeNode(id: string, parentId: string | null, changes: Change[], zenyCost?: number): TreeNode {
    return zenyCost === undefined ? { id, parentId, label: id, changes } : { id, parentId, label: id, changes, zenyCost };
}

export function mechanicTreeWith(nodes: TreeNode[]): Tree {
    return { formatVersion: 1, scenario: mechanicBuild.scenario, root: mechanicBuild.character, nodes };
}
