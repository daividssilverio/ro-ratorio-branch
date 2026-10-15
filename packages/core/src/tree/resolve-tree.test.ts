import { describe, expect, it } from "vitest";
import { resolveTree } from "./resolve-tree.ts";
import type { Change } from "./tree-format.ts";
import { anotherWeaponItemId, maceItemId, mechanicTreeWith, refineMaceToTen, treeNode } from "./tree-test-support.ts";

const addCardToMace: Change = { kind: "setSocket", slot: "rightHand", expectedItemId: maceItemId, socket: 1, cardOrEnchantId: 46 };
const refineAnotherWeapon: Change = { ...refineMaceToTen, expectedItemId: anotherWeaponItemId };

function resolvedCharacterOf(resolutions: ReturnType<typeof resolveTree>, nodeId: string) {
    const resolution = resolutions.get(nodeId);
    if (resolution?.state !== "resolved") {
        throw new Error(`node ${nodeId} is not resolved`);
    }
    return resolution.character;
}

describe("resolveTree", () => {
    it("applies a node's changes on top of the root", () => {
        const resolutions = resolveTree(mechanicTreeWith([treeNode("refine", null, [refineMaceToTen])]));

        expect(resolvedCharacterOf(resolutions, "refine").equipment.rightHand?.refine).toBe(10);
    });

    it("gives a child its parent's changes as well as its own", () => {
        const resolutions = resolveTree(
            mechanicTreeWith([treeNode("refine", null, [refineMaceToTen]), treeNode("card", "refine", [addCardToMace])]),
        );

        const mace = resolvedCharacterOf(resolutions, "card").equipment.rightHand;
        expect(mace?.refine).toBe(10);
        expect(mace?.sockets?.[0]).toBe(46);
    });

    it("resolves a child listed before its parent", () => {
        const resolutions = resolveTree(
            mechanicTreeWith([treeNode("card", "refine", [addCardToMace]), treeNode("refine", null, [refineMaceToTen])]),
        );

        expect(resolvedCharacterOf(resolutions, "card").equipment.rightHand?.refine).toBe(10);
    });

    it("keeps siblings independent of each other", () => {
        const resolutions = resolveTree(
            mechanicTreeWith([treeNode("refine", null, [refineMaceToTen]), treeNode("card", null, [addCardToMace])]),
        );

        expect(resolvedCharacterOf(resolutions, "card").equipment.rightHand?.refine).toBe(9);
    });

    it("marks a node stale and names the change that no longer fits", () => {
        const resolutions = resolveTree(
            mechanicTreeWith([treeNode("mismatch", null, [refineMaceToTen, refineAnotherWeapon])]),
        );

        expect(resolutions.get("mismatch")).toEqual({
            state: "stale",
            staleChanges: [{ nodeId: "mismatch", changeIndex: 1, reason: "slotHoldsAnotherItem" }],
        });
    });

    it("marks the descendants of a stale node stale for the same change", () => {
        const resolutions = resolveTree(
            mechanicTreeWith([
                treeNode("mismatch", null, [refineAnotherWeapon]),
                treeNode("below", "mismatch", [addCardToMace]),
            ]),
        );

        expect(resolutions.get("below")).toEqual({
            state: "stale",
            staleChanges: [{ nodeId: "mismatch", changeIndex: 0, reason: "slotHoldsAnotherItem" }],
        });
    });

    it("turns a node stale when the root's weapon is replaced under it", () => {
        const tree = mechanicTreeWith([treeNode("refine", null, [refineMaceToTen])]);
        const treeWithNewRootWeapon = {
            ...tree,
            root: { ...tree.root, equipment: { ...tree.root.equipment, rightHand: { itemId: anotherWeaponItemId } } },
        };

        expect(resolveTree(tree).get("refine")?.state).toBe("resolved");
        expect(resolveTree(treeWithNewRootWeapon).get("refine")?.state).toBe("stale");
    });
});
