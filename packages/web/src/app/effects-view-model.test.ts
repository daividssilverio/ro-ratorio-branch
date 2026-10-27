import type { Character, CompletedItemSetEffects } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { noDescriptions } from "../engine-host/host-protocol.ts";
import { bonusRowsOf, effectLinesOf, effectSourcesOf, pieceEffectSourcesOf } from "./effects-view-model.ts";

describe("bonusRowsOf", () => {
    it("lists every bonus as it is, in the order given, when there is nothing to compare with", () => {
        expect(bonusRowsOf({ DEX_PLUS: 5, ATK_PLUS: 30 }, null)).toEqual([
            { name: "DEX_PLUS", value: 5, before: null, change: "same" },
            { name: "ATK_PLUS", value: 30, before: null, change: "same" },
        ]);
    });

    it("puts what came, what changed and what went before what stayed, against the parent", () => {
        const rows = bonusRowsOf({ ATK_PLUS: 50, DEX_PLUS: 5, HIT_PLUS: 12 }, { ATK_PLUS: 30, DEX_PLUS: 5, ASPD_UP: 10 });

        expect(rows).toEqual([
            { name: "HIT_PLUS", value: 12, before: null, change: "added" },
            { name: "ATK_PLUS", value: 50, before: 30, change: "changed" },
            { name: "ASPD_UP", value: 10, before: 10, change: "lost" },
            { name: "DEX_PLUS", value: 5, before: 5, change: "same" },
        ]);
    });
});

describe("effectLinesOf", () => {
    it("takes everything the piece does, and upstream's note alone only when that is missing", () => {
        expect(effectLinesOf({ name: "Dex+7", effectText: "0", effects: ["DEX + 7"] })).toEqual(["DEX + 7"]);
        expect(effectLinesOf({ name: "古い", effectText: "ATK + 1<br>DEF + 1", effects: [] })).toEqual(["ATK + 1", "DEF + 1"]);
        expect(effectLinesOf(undefined)).toEqual([]);
    });
});

describe("effectSourcesOf", () => {
    const descriptions = {
        ...noDescriptions,
        items: { 4411: { name: "メロンメイス", effectText: "ATK + 10<br>MATK + 5" }, 2101: { name: "ガード", effectText: "" } },
        cardsOrEnchants: { 1262: { name: "戦車のカード", effectText: "DEF + 1" } },
        randomOptionNames: { 20: "Atk+" },
    } as unknown as typeof noDescriptions;
    const character = (equipment: Character["equipment"]): Character => ({ jobId: 51, baseLevel: 200, jobLevel: 70, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment });
    const worn = (equipment: Character["equipment"], itemSets: readonly CompletedItemSetEffects[] = []) => ({ character: character(equipment), itemSets });
    /** The mace worn with the tank card: a set whose effects upstream keeps on an item of its own. */
    const maceWithTheCard: CompletedItemSetEffects = {
        set: { kind: "item", id: 9001 },
        members: [
            { kind: "item", id: 4411 },
            { kind: "cardOrEnchant", id: 1262 },
        ],
        effects: ["攻撃命中時、SP + 5"],
    };

    it("lists each worn item, then its cards and enchants and its options, with their effect lines", () => {
        const sources = effectSourcesOf(worn({ rightHand: { itemId: 4411, refine: 9, sockets: [1262, null], randomOptions: [{ optionId: 20, value: 30 }] } }), null, descriptions);

        expect(sources.map(({ kind, name, lines, change }) => ({ kind, name, lines, change }))).toEqual([
            { kind: "item", name: "メロンメイス", lines: ["ATK + 10", "MATK + 5"], change: "same" },
            { kind: "cardOrEnchant", name: "戦車のカード", lines: ["DEF + 1"], change: "same" },
            { kind: "randomOption", name: "Atk+ 30", lines: [], change: "same" },
        ]);
        expect(new Set(sources.map((source) => source.key)).size).toBe(sources.length);
    });

    it("marks what the parent did not wear as added and what it wore that is gone as lost, counting the same card twice", () => {
        const parent = worn({ rightHand: { itemId: 4411, sockets: [1262, null] }, shield: { itemId: 2101 } });
        const now = worn({ rightHand: { itemId: 4411, refine: 10, sockets: [1262, 1262] } });

        expect(effectSourcesOf(now, parent, descriptions).map(({ name, change }) => [name, change])).toEqual([
            ["メロンメイス", "same"],
            ["戦車のカード", "same"],
            ["戦車のカード", "added"],
            ["ガード", "lost"],
        ]);
    });

    it("lists the sets a build completes after what is worn, named after their members, in the slot of the first one", () => {
        const sources = effectSourcesOf(worn({ rightHand: { itemId: 4411, sockets: [1262] } }, [maceWithTheCard]), null, descriptions);

        expect(sources.at(-1)).toMatchObject({ kind: "itemSet", slot: "rightHand", name: "メロンメイス + 戦車のカード", lines: ["攻撃命中時、SP + 5"], change: "same" });
    });

    it("marks a set the parent did not complete as added, and one it completed that is gone as lost", () => {
        const withTheSet = worn({ rightHand: { itemId: 4411, sockets: [1262] } }, [maceWithTheCard]);
        const withoutIt = worn({ rightHand: { itemId: 4411 } });

        expect(effectSourcesOf(withTheSet, withoutIt, descriptions).filter((source) => source.kind === "itemSet").map(({ change }) => change)).toEqual(["added"]);
        expect(effectSourcesOf(withoutIt, withTheSet, descriptions).filter((source) => source.kind === "itemSet").map(({ change }) => change)).toEqual(["lost"]);
    });

    it("adds to one piece's effects the completed sets it is part of, and no other", () => {
        const sources = pieceEffectSourcesOf({ itemId: 4411, sockets: [1262] }, "rightHand", descriptions, [maceWithTheCard, { ...maceWithTheCard, set: { kind: "item", id: 9002 }, members: [{ kind: "item", id: 2101 }] }]);

        expect(sources.map(({ kind, name }) => [kind, name])).toEqual([
            ["item", "メロンメイス"],
            ["cardOrEnchant", "戦車のカード"],
            ["itemSet", "メロンメイス + 戦車のカード"],
        ]);
    });
});
