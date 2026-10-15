import { addCharacterToWorkspace, parseWorkspace, type Workspace } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import type { GearFacts } from "../engine-host/host-protocol.ts";
import { idsInWorkspace, lockerPiecesForSlot, lockerRowsOf, withPieceField, withRandomOptionAt, withSocket, socketStateOf } from "./locker-view-model.ts";

const mechanicJobId = 51;
const archMageJobId = 73;
const maceItemId = 4411;
const shieldItemId = 4936;

const mechanicWorkspace: Workspace = parseWorkspace({
    formatVersion: 1,
    gearPieces: {
        mace: { itemId: maceItemId, refine: 9, sockets: [null, 659], owned: true },
        "spare-shield": { itemId: shieldItemId, owned: false, zenyCost: 50_000_000 },
    },
    characters: {
        mechanic: { name: "メカニック", jobId: mechanicJobId, baseLevel: 200, jobLevel: 70, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment: { rightHand: "mace" } },
    },
    trees: {
        upgrades: {
            name: "upgrades",
            characterId: "mechanic",
            scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 850 },
            nodes: [{ id: "with-shield", parentId: null, label: "shield", changes: [{ kind: "equipLockerPiece", slot: "shield", gearPieceId: "spare-shield" }] }],
        },
    },
});
/** A second character, of a job that may not wear maces, wearing its own copy of the mace. */
const withArchMage = addCharacterToWorkspace(
    mechanicWorkspace,
    { jobId: archMageJobId, baseLevel: 200, jobLevel: 70, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment: { rightHand: { itemId: maceItemId } } },
    "アークメイジ",
);

const gearFacts: GearFacts = {
    slotsOfItem: { [maceItemId]: ["rightHand", "leftHand"], [shieldItemId]: ["shield"] },
    wearingJobIdsOfItem: { [maceItemId]: [mechanicJobId], [shieldItemId]: [mechanicJobId, archMageJobId] },
};
const everything = { characterId: null, slotGroup: null };
const idsOf = (rows: readonly { gearPieceId: string }[]) => rows.map((row) => row.gearPieceId);

describe("lockerRowsOf", () => {
    it("lists every piece with its slots and who uses it", () => {
        const rows = lockerRowsOf(mechanicWorkspace, gearFacts, everything);

        expect(rows).toEqual([
            { gearPieceId: "mace", lockerPiece: mechanicWorkspace.gearPieces.mace, slots: ["rightHand", "leftHand"], usage: { characterIds: ["mechanic"], nodes: [], gearLoadoutIds: [] }, wearersBarredByJob: [] },
            {
                gearPieceId: "spare-shield",
                lockerPiece: mechanicWorkspace.gearPieces["spare-shield"],
                slots: ["shield"],
                usage: { characterIds: [], nodes: [{ treeId: "upgrades", nodeId: "with-shield" }], gearLoadoutIds: [] },
                wearersBarredByJob: [],
            },
        ]);
    });

    it("keeps for a character what it wears and what its trees equip", () => {
        expect(idsOf(lockerRowsOf(withArchMage.workspace, gearFacts, { characterId: "mechanic", slotGroup: null }))).toEqual(["mace", "spare-shield"]);
        expect(idsOf(lockerRowsOf(withArchMage.workspace, gearFacts, { characterId: withArchMage.characterId, slotGroup: null }))).toEqual(["rightHand-1"]);
    });

    it("keeps for a slot group the pieces that fit one of its slots", () => {
        expect(idsOf(lockerRowsOf(mechanicWorkspace, gearFacts, { characterId: null, slotGroup: "shield" }))).toEqual(["spare-shield"]);
        expect(idsOf(lockerRowsOf(mechanicWorkspace, gearFacts, { characterId: null, slotGroup: "head" }))).toEqual([]);
    });

    it("keeps for a gear loadout the pieces it holds", () => {
        const withLoadout = { ...mechanicWorkspace, gearLoadouts: { hunting: { name: "狩り", equipment: { shield: "spare-shield" } } } };

        expect(idsOf(lockerRowsOf(withLoadout, gearFacts, { characterId: null, slotGroup: null, gearLoadoutId: "hunting" }))).toEqual(["spare-shield"]);
        expect(idsOf(lockerRowsOf(withLoadout, gearFacts, { characterId: null, slotGroup: null, gearLoadoutId: null }))).toEqual(["mace", "spare-shield"]);
    });

    it("names the wearers whose job may not wear the piece", () => {
        const rows = lockerRowsOf(withArchMage.workspace, gearFacts, everything);

        expect(rows.map((row) => row.wearersBarredByJob)).toEqual([[], [], [withArchMage.characterId]]);
    });

    it("bars nobody while the engine has not said who may wear what", () => {
        const rows = lockerRowsOf(withArchMage.workspace, { slotsOfItem: {}, wearingJobIdsOfItem: {} }, everything);

        expect(rows.flatMap((row) => row.wearersBarredByJob)).toEqual([]);
    });
});

describe("lockerPiecesForSlot", () => {
    it("offers the pieces that fit the slot and that the job may wear", () => {
        expect(idsOf(lockerPiecesForSlot(mechanicWorkspace, gearFacts, "leftHand", mechanicJobId))).toEqual(["mace"]);
        expect(idsOf(lockerPiecesForSlot(mechanicWorkspace, gearFacts, "rightHand", archMageJobId))).toEqual([]);
        expect(idsOf(lockerPiecesForSlot(mechanicWorkspace, gearFacts, "shield", archMageJobId))).toEqual(["spare-shield"]);
    });
});

describe("idsInWorkspace", () => {
    it("collects the IDs of the locker, the characters and the scenarios", () => {
        expect(idsInWorkspace(mechanicWorkspace)).toEqual({
            jobIds: [mechanicJobId],
            skillIds: [554],
            monsterIds: [850],
            itemIds: [maceItemId, shieldItemId],
            cardOrEnchantIds: [659],
            randomOptionIds: [],
        });
    });
});

describe("editing a piece", () => {
    const mace = { itemId: maceItemId, refine: 9, sockets: [null, 659], owned: true };

    it("sets a field, and drops it at the format's default", () => {
        expect(withPieceField(mace, "refine", 10)).toEqual({ ...mace, refine: 10 });
        expect(withPieceField(mace, "refine", 0)).toEqual({ itemId: maceItemId, sockets: [null, 659], owned: true });
        expect(withPieceField(mace, "note", "メイン武器")).toEqual({ ...mace, note: "メイン武器" });
        expect(withPieceField({ ...mace, note: "x" }, "note", "")).toEqual(mace);
    });

    it("fills a socket, keeping the others where they are", () => {
        expect(withSocket(mace, 3, 1297, 4).sockets).toEqual([null, 659, null, 1297]);
        expect(withSocket(mace, 0, 1381, 4).sockets).toEqual([1381, 659]);
    });

    it("sets a random option at its position, and drops trailing empty positions and an empty list", () => {
        const attack = { optionId: 20, value: 100 };
        const atThird = withRandomOptionAt(mace, 2, attack);

        expect(atThird.randomOptions).toEqual([null, null, attack]);
        expect(withRandomOptionAt(atThird, 0, attack).randomOptions).toEqual([attack, null, attack]);
        expect(withRandomOptionAt(withRandomOptionAt(atThird, 0, attack), 2, null).randomOptions).toEqual([attack]);
        expect(withRandomOptionAt(atThird, 2, null)).toEqual(mace);
        expect(idsInWorkspace({ ...mechanicWorkspace, gearPieces: { mace: atThird } }).randomOptionIds).toEqual([20]);
    });

    it("empties a socket and drops trailing empty ones", () => {
        expect(withSocket(mace, 1, null, 4)).toEqual({ itemId: maceItemId, refine: 9, owned: true });
    });
});

describe("socketStateOf", () => {
    const choices = [{ id: 4001 }, { id: 4002 }];

    it("is unknown until the choices are in", () => {
        expect(socketStateOf(undefined, null)).toBe("unknown");
        expect(socketStateOf(undefined, 4001)).toBe("unknown");
    });

    it("is closed for a socket that takes nothing and holds nothing", () => {
        expect(socketStateOf([], null)).toBe("closed");
    });

    it("is open where the item takes something, empty or filled with one of those", () => {
        expect(socketStateOf(choices, null)).toBe("open");
        expect(socketStateOf(choices, 4002)).toBe("open");
    });

    it("is misfilled when it holds what the item does not take there, so that it can still be emptied", () => {
        expect(socketStateOf(choices, 4999)).toBe("misfilled");
        expect(socketStateOf([], 4001)).toBe("misfilled");
    });
});
