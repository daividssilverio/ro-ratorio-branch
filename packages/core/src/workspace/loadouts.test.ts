import { describe, expect, it } from "vitest";
import { addLockerPiece, lockerPieceUsage, removeLockerPiece, wearLockerPiece } from "./edit-workspace.ts";
import {
    addBranchToTree,
    applyGearLoadout,
    applyStatLoadout,
    gearLoadoutChanges,
    removeGearLoadout,
    removeStatLoadout,
    renameGearLoadout,
    renameStatLoadout,
    saveGearLoadout,
    saveStatLoadout,
    statLoadoutChanges,
} from "./loadouts.ts";
import { InvalidWorkspaceError, parseWorkspace } from "./parse-workspace.ts";
import { characterOf, treeOf, UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import type { Workspace } from "./workspace-format.ts";
import { maceItemId, mechanicWorkspaceWith, shieldItemId } from "./workspace-test-support.ts";

const workspace = mechanicWorkspaceWith([]);
const mechanic = (ofWorkspace: Workspace) => {
    const character = ofWorkspace.characters.mechanic;
    if (character === undefined) {
        throw new Error("the test workspace has no mechanic");
    }
    return character;
};

describe("gear loadouts", () => {
    const withShield = wearLockerPiece(workspace, "mechanic", "shield", "spare-shield");
    const saved = saveGearLoadout(withShield, "mechanic", "mace and shield");

    it("keeps what the character wears under a new ID, in a workspace that still parses", () => {
        expect(saved.loadoutId).toBe("gear-loadout-1");
        expect(saved.workspace.gearLoadouts).toEqual({ "gear-loadout-1": { name: "mace and shield", equipment: { rightHand: "mace", shield: "spare-shield" } } });
        expect(parseWorkspace(saved.workspace)).toEqual(saved.workspace);
        expect(saveGearLoadout(saved.workspace, "mechanic", "again").loadoutId).toBe("gear-loadout-2");
    });

    it("does not follow the character after it was saved", () => {
        const undressed = wearLockerPiece(saved.workspace, "mechanic", "shield", null);

        expect(undressed.gearLoadouts?.[saved.loadoutId]?.equipment.shield).toBe("spare-shield");
    });

    it("puts its pieces back on, and leaves the slots it does not list", () => {
        const otherMace = addLockerPiece(saved.workspace, { itemId: maceItemId, owned: true }, "mace");
        const changed = wearLockerPiece(wearLockerPiece(wearLockerPiece(otherMace.workspace, "mechanic", "rightHand", otherMace.gearPieceId), "mechanic", "shield", null), "mechanic", "leftHand", otherMace.gearPieceId);

        const applied = applyGearLoadout(changed, "mechanic", saved.loadoutId);

        expect(mechanic(applied).equipment).toEqual({ rightHand: "mace", shield: "spare-shield", leftHand: otherMace.gearPieceId });
    });

    it("gives one equip change per slot that differs, for trying it as a branch", () => {
        const withoutShield = wearLockerPiece(saved.workspace, "mechanic", "shield", null);

        expect(gearLoadoutChanges(withoutShield, "mechanic", saved.loadoutId)).toEqual([{ kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" }]);
        expect(gearLoadoutChanges(saved.workspace, "mechanic", saved.loadoutId)).toEqual([]);
    });

    it("keeps its pieces in the locker: a piece a loadout holds cannot be removed", () => {
        const withoutShield = wearLockerPiece(saved.workspace, "mechanic", "shield", null);

        expect(lockerPieceUsage(withoutShield).get("spare-shield")?.gearLoadoutIds).toEqual([saved.loadoutId]);
        expect(removeLockerPiece(withoutShield, "spare-shield").removed).toBe(false);
        expect(removeLockerPiece(removeGearLoadout(withoutShield, saved.loadoutId), "spare-shield").removed).toBe(true);
    });

    it("leaves no empty loadout list behind when the last one is removed", () => {
        expect(removeGearLoadout(saved.workspace, saved.loadoutId)).toEqual(withShield);
    });

    it("is refused by the parser when it names a piece the locker does not have", () => {
        const broken = { ...saved.workspace, gearLoadouts: { broken: { name: "broken", equipment: { shield: "no-such-piece" } } } };

        let issues: InvalidWorkspaceError["issues"] = [];
        try {
            parseWorkspace(broken);
        } catch (error) {
            issues = error instanceof InvalidWorkspaceError ? error.issues : [];
        }

        expect(issues).toEqual([{ kind: "unknownGearPiece", gearPieceId: "no-such-piece", path: "/gearLoadouts/broken/equipment/shield" }]);
    });

    it("rejects an unknown character or loadout", () => {
        expect(() => saveGearLoadout(workspace, "nobody", "x")).toThrow(UnknownWorkspaceEntryError);
        expect(() => applyGearLoadout(workspace, "mechanic", "no-such-loadout")).toThrow(UnknownWorkspaceEntryError);
        expect(() => gearLoadoutChanges(workspace, "mechanic", "no-such-loadout")).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("stat loadouts", () => {
    const saved = saveStatLoadout(workspace, "mechanic", "balanced");
    const strong: Workspace = {
        ...saved.workspace,
        characters: {
            mechanic: { ...mechanic(saved.workspace), baseStats: { ...mechanic(saved.workspace).baseStats, str: 130, luk: 1 }, traitStats: { pow: 100, sta: 0, wis: 0, spl: 0, con: 60, crt: 0 } },
        },
    };

    it("keeps the base stats, and the trait stats only when the character has them", () => {
        expect(saved.workspace.statLoadouts).toEqual({ "stat-loadout-1": { name: "balanced", baseStats: mechanic(workspace).baseStats } });
        expect(saveStatLoadout(strong, "mechanic", "strong").workspace.statLoadouts?.["stat-loadout-2"]?.traitStats?.pow).toBe(100);
        expect(parseWorkspace(saved.workspace)).toEqual(saved.workspace);
    });

    it("gives the stats back, clearing trait stats the loadout does not have", () => {
        const applied = applyStatLoadout(strong, "mechanic", saved.loadoutId);

        expect(mechanic(applied).baseStats).toEqual(mechanic(workspace).baseStats);
        expect("traitStats" in mechanic(applied)).toBe(false);
        expect(characterOf(applied, "mechanic").equipment).toEqual(characterOf(strong, "mechanic").equipment);
    });

    it("gives one change per stat that differs, for trying it as a branch", () => {
        expect(statLoadoutChanges(strong, "mechanic", saved.loadoutId)).toEqual([
            { kind: "setBaseStat", stat: "str", value: 110 },
            { kind: "setBaseStat", stat: "luk", value: 78 },
            { kind: "setTraitStat", stat: "pow", value: 0 },
            { kind: "setTraitStat", stat: "con", value: 0 },
        ]);
        expect(statLoadoutChanges(saved.workspace, "mechanic", saved.loadoutId)).toEqual([]);
    });

    it("is removed without a trace", () => {
        expect(removeStatLoadout(saved.workspace, saved.loadoutId)).toEqual(workspace);
    });
});

describe("addBranchToTree", () => {
    it("adds a node under the root whose changes resolve to the loadout's gear", () => {
        const saved = saveGearLoadout(wearLockerPiece(workspace, "mechanic", "shield", "spare-shield"), "mechanic", "with shield");
        const withoutShield = wearLockerPiece(saved.workspace, "mechanic", "shield", null);

        const added = addBranchToTree(withoutShield, "upgrades", "with shield", gearLoadoutChanges(withoutShield, "mechanic", saved.loadoutId));

        expect(added.nodeId).toBe("branch-1");
        expect(treeOf(added.workspace, "upgrades").nodes).toEqual([
            { id: "branch-1", parentId: null, label: "with shield", changes: [{ kind: "setGearPiece", slot: "shield", gearPiece: { itemId: shieldItemId, refine: 7, zenyCost: 50_000_000 } }] },
        ]);
        expect(parseWorkspace(added.workspace)).toEqual(added.workspace);
    });

    it("rejects an unknown tree", () => {
        expect(() => addBranchToTree(workspace, "no-such-tree", "x", [])).toThrow(UnknownWorkspaceEntryError);
    });
});

describe("renaming a loadout", () => {
    it("changes the name and nothing else, for a gear loadout and for a stat loadout", () => {
        const [characterId] = Object.keys(workspace.characters);
        const gear = saveGearLoadout(workspace, characterId ?? "", "Hunting");
        const stats = saveStatLoadout(gear.workspace, characterId ?? "", "Str build");

        const renamed = renameStatLoadout(renameGearLoadout(stats.workspace, gear.loadoutId, "Boss"), stats.loadoutId, "Str 130");

        expect(renamed.gearLoadouts?.[gear.loadoutId]).toEqual({ ...stats.workspace.gearLoadouts?.[gear.loadoutId], name: "Boss" });
        expect(renamed.statLoadouts?.[stats.loadoutId]).toEqual({ ...stats.workspace.statLoadouts?.[stats.loadoutId], name: "Str 130" });
        expect(parseWorkspace(renamed)).toEqual(renamed);
    });

    it("rejects a loadout the workspace does not have", () => {
        expect(() => renameGearLoadout(workspace, "no-such-loadout", "x")).toThrow(UnknownWorkspaceEntryError);
        expect(() => renameStatLoadout(workspace, "no-such-loadout", "x")).toThrow(UnknownWorkspaceEntryError);
    });
});
