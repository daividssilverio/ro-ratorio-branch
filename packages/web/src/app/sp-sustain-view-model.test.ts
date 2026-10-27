import type { NodeEvaluation, SpSustain, SpSustainBasis } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { spSustainSettingsOf } from "@ro-ratorio-branch/core/platform-neutral";
import { formatBarSeconds, formatShareOfTime, formatSpPerSecond, spRowTextsOf, spSustainViewOf } from "./sp-sustain-view-model.ts";

const melonMace = { kind: "item", id: 4411 } as const;
const extremeMagic = { kind: "cardOrEnchant", id: 2098 } as const;

const sustain: SpSustain = {
    maxSp: 3890,
    spCostPerUse: 100,
    usesPerSecond: 2,
    spentPerSecond: 200,
    gains: [
        { from: { kind: "naturalRecovery" }, perSecond: 7.25 },
        { from: { kind: "worn", source: extremeMagic, name: "極限の魔力", slot: "armor", line: "一般装備に装備時、1秒毎にSP + 1%" }, perSecond: 38 },
        {
            from: { kind: "worn", source: melonMace, name: "メロンメイス", slot: "rightHand", line: "物理・魔法攻撃命中時、一定確率で5秒間、1秒毎にSP + 100" },
            perSecond: 12,
            chance: { percent: 1, origin: "assumed" },
            state: { shareOfTimeOn: 0.12, perSecondWhileOn: 100, onBecause: null },
        },
    ],
    gainedPerSecond: 57.25,
    netPerSecond: -142.75,
    fullBar: { seconds: 3890 / 142.75, uses: (2 * 3890) / 142.75 },
    uncounted: [{ source: { kind: "cardOrEnchant", id: 263 }, name: "マンドラゴラカード", slot: "garment", line: "近接物理攻撃で植物形モンスターを倒した時、SP5回復。" }],
};

describe("the SP card", () => {
    it("lists what gives SP back, the largest first, each effect that happens by chance with the source whose chance a user sets", () => {
        const view = spSustainViewOf(sustain);

        expect(view.gainRows.map((row) => [row.name, row.slot, row.perSecond])).toEqual([
            ["極限の魔力", "armor", 38],
            ["メロンメイス", "rightHand", 12],
            [null, null, 7.25],
        ]);
        expect(view.gainRows.map((row) => row.chance)).toEqual([null, { percent: 1, origin: "assumed", source: melonMace }, null]);
        expect(view.gainRows.map((row) => row.state)).toEqual([null, { shareOfTimeOn: 0.12, perSecondWhileOn: 100, onBecause: null, source: melonMace }, null]);
    });

    it("keeps the totals and the full bar, and lists what is not counted", () => {
        const view = spSustainViewOf(sustain);

        expect([view.spCostPerUse, view.usesPerSecond, view.spentPerSecond, view.gainedPerSecond, view.netPerSecond]).toEqual([100, 2, 200, 57.25, -142.75]);
        expect(view.fullBar).toBe(sustain.fullBar);
        expect(view.uncountedRows.map((row) => [row.name, row.slot])).toEqual([["マンドラゴラカード", "garment"]]);
    });

    it("writes SP a second and a bar's seconds to one decimal", () => {
        expect(formatSpPerSecond(38)).toBe("38.0");
        expect(formatSpPerSecond(-166.48)).toBe("−166.5");
        expect(formatBarSeconds(3890 / 154.75)).toBe("25.1");
        expect(formatShareOfTime(1 - 0.99 ** 20)).toBe("18%");
    });
});

describe("how long a full SP bar lasts, as a tree row shows it", () => {
    /** 1000 SP, 100 SP an attack at 2 a second, 5 SP a second of natural recovery. */
    const basis: SpSustainBasis = {
        maxSp: 1000,
        spCostPerUse: 100,
        usesPerSecond: 2,
        damagePerUse: 10_000,
        secondsToKill: 20,
        attackKind: "physical",
        naturalRecoveryPerSecond: 5,
        effects: [],
        uncounted: [],
    };
    const evaluationWith = (spSustainBasis: SpSustainBasis | null): NodeEvaluation => ({
        state: "ready",
        character: { jobId: 85, baseLevel: 200, jobLevel: 30, baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipment: {} },
        battleSummary: { targetMonsterId: 2373, averageDamagePerAttack: 10_000, averageDamagePerSecond: 20_000, averageTimeToKill: { seconds: 20, attacks: 40 } },
        statSnapshot: { stats: {}, bonuses: {} },
        spCostPerUse: 100,
        itemSets: [],
        spSustainBasis,
    });
    // A state set off by chance, during which 1000 SP come back every second.
    const withAProc: SpSustainBasis = {
        ...basis,
        effects: [
            {
                source: melonMace,
                name: "メロンメイス",
                slot: "rightHand",
                line: "物理・魔法攻撃命中時、一定確率で5秒間、1秒毎にSP + 1000",
                effect: { kind: "proc", attack: "physicalOrMagical", chancePercent: null, durationSeconds: 5, recovery: { seconds: 1, amount: 1000, unit: "sp" } },
                times: 1,
                isOnByTimedItem: false,
            },
        ],
    };

    it("gives the seconds a bar lasts and SP spent and gained a second, ∞ when SP keeps up, and — when the attack never kills", () => {
        expect(spRowTextsOf(evaluationWith(basis), {})).toEqual({ bar: "5.1 s", spent: "200", gained: "5" });
        expect(spRowTextsOf(evaluationWith(null), {})).toEqual({ bar: "—", spent: "—", gained: "—" });
        expect(spRowTextsOf(undefined, {})).toBeNull();
    });

    it("counts the chances the user set", () => {
        // At the assumed 1%, 10 attacks in 5 seconds keep the state on 1 - 0.99^10 of the time.
        const gainedAtOnePercent = 5 + (1 - 0.99 ** 10) * 1000;

        expect(spRowTextsOf(evaluationWith(withAProc), {})).toEqual({ bar: `${formatBarSeconds(1000 / (200 - gainedAtOnePercent))} s`, spent: "200", gained: "101" });
        expect(spRowTextsOf(evaluationWith(withAProc), spSustainSettingsOf({ items: { "4411": 50 } }, undefined))?.bar).toBe("∞");
        // Counted as on all the time: 1000 back a second against 200 spent.
        expect(spRowTextsOf(evaluationWith(withAProc), spSustainSettingsOf(undefined, { items: [4411] }))).toEqual({ bar: "∞", spent: "200", gained: "1,005" });
    });
});
