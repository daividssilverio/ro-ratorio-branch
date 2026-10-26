import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { calculateBuildInDetail } from "../build/calculate-build.ts";
import { parseBuild } from "../build/parse-build.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { spSustainOfBuild } from "./sp-sustain-of-build.ts";
import { type SpSustainInput, spSustainFrom, spSustainOf, type WornEffects } from "./sp-sustain.ts";

const extremeMagicEnchantId = 2098;
/** The item upstream keeps the effects of アビスセイバーガーブ worn with 極限の魔力 on. */
const abyssGarbWithExtremeMagicSetId = 5486;

const worn = (id: number, lines: string[], placement: Partial<WornEffects> = {}): WornEffects => ({
    source: { kind: "cardOrEnchant", id },
    name: "",
    slot: "armor",
    refine: 0,
    transcendence: 0,
    onShadowGear: false,
    lines,
    ...placement,
});

/** 1000 SP, 100 SP an attack at 2 attacks a second, 10000 damage an attack, a kill every 20 seconds. */
const physicalAttacker: SpSustainInput = {
    maxSp: 1000,
    naturalRecoveryPerTick: 40,
    naturalRecoveryStopped: false,
    spCostPerUse: 100,
    usesPerSecond: 2,
    damagePerUse: 10_000,
    secondsToKill: 20,
    attackKind: "physical",
    character: { baseLevel: 200, jobName: "スピリットハンドラー", pureStats: {}, learnedSkillLevel: () => 0 },
    worn: [],
};

describe("how SP holds up using one attack again and again", () => {
    it("counts natural recovery once every 8 seconds, against what the attack spends", () => {
        const sustain = spSustainOf(physicalAttacker);

        expect(sustain.spentPerSecond).toBe(200);
        expect(sustain.gains).toEqual([{ from: { kind: "naturalRecovery" }, perSecond: 5 }]);
        expect(sustain.netPerSecond).toBe(-195);
        expect(sustain.fullBar?.seconds).toBeCloseTo(1000 / 195);
        expect(sustain.fullBar?.uses).toBeCloseTo((2 * 1000) / 195);
    });

    it("counts what worn effects give back, each in SP per second, where their conditions hold", () => {
        const sustain = spSustainOf({
            ...physicalAttacker,
            worn: [
                worn(extremeMagicEnchantId, ["一般装備に装備時、1秒毎にSP + 1%"]),
                worn(extremeMagicEnchantId, ["一般装備に装備時、1秒毎にSP + 1%"], { slot: "shadowArmor", onShadowGear: true }),
                worn(1, ["物理攻撃命中時、一定確率で敵に与えたダメージの5%をSPとして吸収。"]),
                worn(2, ["モンスターを倒した時、SP+50"]),
                worn(3, ["魔法攻撃命中時、SP+5"]),
                worn(4, ["精錬値が9以上の時、追加で5秒毎にSP + 20"], { refine: 8 }),
            ],
        });

        expect(sustain.gains.map((gain) => [gain.from.kind === "worn" ? gain.from.source.id : "natural", gain.perSecond, gain.chance])).toEqual([
            ["natural", 5, undefined],
            // 1% of 1000 every second, on regular gear only.
            [extremeMagicEnchantId, 10, undefined],
            // An assumed 1% chance of draining 5% of 10000, at 2 attacks a second.
            [1, 10, { percent: 1, origin: "assumed" }],
            // 50 a kill, a kill every 20 seconds.
            [2, 2.5, undefined],
        ]);
        expect(sustain.gainedPerSecond).toBe(27.5);
        expect(sustain.netPerSecond).toBe(-172.5);
    });

    it("takes the chance the user set over the one assumed, and counts the SP a cheaper attack saves while a state is on", () => {
        const melonWording = "物理・魔法攻撃命中時、一定確率で5秒間、スキル使用時の消費SP - 100%、1秒毎にSP + 100";
        const sustain = spSustainOf({
            ...physicalAttacker,
            naturalRecoveryStopped: true,
            worn: [worn(4404, [melonWording], { source: { kind: "item", id: 4404 } })],
            chancePercentOf: (source) => (source.kind === "item" && source.id === 4404 ? 5 : undefined),
        });
        // 10 attacks within the 5 seconds; the state is on while one of them set it off.
        const shareOfTimeOn = 1 - 0.95 ** 10;

        expect(sustain.gains).toHaveLength(1);
        expect(sustain.gains[0]?.chance).toEqual({ percent: 5, origin: "yours" });
        // 100 SP a second, and the 200 SP a second the attacks would cost.
        expect(sustain.gains[0]?.perSecond).toBeCloseTo(shareOfTimeOn * 300);
    });

    it("gives a state's share of the time on and what it gives while on, and counts it as on all the time where the user says so", () => {
        const melonWording = "物理・魔法攻撃命中時、一定確率で5秒間、1秒毎にSP + 100";
        const withAMelonMace = { ...physicalAttacker, naturalRecoveryStopped: true, worn: [worn(4404, [melonWording], { source: { kind: "item", id: 4404 } })] };
        const onAverage = spSustainOf(withAMelonMace);
        const whileOn = spSustainOf({ ...withAMelonMace, isOn: (source) => source.id === 4404 });

        // 10 attacks within the 5 seconds, each setting it off at the assumed 1%.
        expect(onAverage.gains[0]?.state).toEqual({ shareOfTimeOn: 1 - 0.99 ** 10, perSecondWhileOn: 100, onBecause: null });
        expect(whileOn.gains[0]).toMatchObject({ perSecond: 100, state: { shareOfTimeOn: 1, perSecondWhileOn: 100, onBecause: "yours" } });
    });

    it("counts a state as on all the time where one of the character's timed items says it is", () => {
        const melonWording = "物理・魔法攻撃命中時、一定確率で5秒間、1秒毎にSP + 100";
        const sustain = spSustainOf({
            ...physicalAttacker,
            naturalRecoveryStopped: true,
            worn: [worn(4404, [melonWording], { source: { kind: "item", id: 4404 } })],
            onByTimedItems: [{ kind: "item", id: 4404 }],
        });

        expect(sustain.gains[0]).toMatchObject({ perSecond: 100, state: { shareOfTimeOn: 1, onBecause: "timedItem" } });
    });

    it("has no end to a full bar when SP comes back as fast as it goes", () => {
        const sustain = spSustainOf({ ...physicalAttacker, worn: [worn(1, ["10秒毎に、HP + 1000 , SP + 2000"])] });

        expect(sustain.netPerSecond).toBe(5);
        expect(sustain.fullBar).toBeNull();
    });

    it("lists the effects about gaining SP it does not count", () => {
        const melee = "近接物理攻撃で不死形モンスターを倒した時、SP+5。";
        const sustain = spSustainOf({ ...physicalAttacker, worn: [worn(7, ["Atk + 10", melee])] });

        expect(sustain.uncounted).toEqual([{ source: { kind: "cardOrEnchant", id: 7 }, name: "", slot: "armor", line: melee }]);
    });
});

const abyssArmorBuild = () => parseBuild(JSON.parse(readFileSync(new URL("../build/golden-builds/spirit-handler-abyss-armor.build.json", import.meta.url), "utf8")));

describe("how a real character's SP holds up", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("counts 極限の魔力 on its armor, the set it makes with the armor, natural recovery, and Tiger Slash's cost", () => {
        const build = parseBuild(JSON.parse(readFileSync(new URL("../build/golden-builds/spirit-handler-abyss-armor.build.json", import.meta.url), "utf8")));
        const calculation = calculateBuildInDetail(build, engine);
        const sustain = calculation.spSustainBasis === null ? null : spSustainFrom(calculation.spSustainBasis);
        const { MAXSP: maxSp = 0, SPR: naturalRecoveryPerTick = 0 } = calculation.statSnapshot.stats;

        expect(sustain?.spCostPerUse).toBe(100);
        expect(sustain?.gains.map((gain) => [gain.from.kind === "worn" ? gain.from.source.id : gain.from.kind, gain.perSecond])).toEqual([
            ["naturalRecovery", naturalRecoveryPerTick / 8],
            [extremeMagicEnchantId, Math.floor(maxSp / 100)],
            // 10 seconds of 10% of Max SP a second, on at an assumed 1% for each of 20 attacks within them.
            [abyssGarbWithExtremeMagicSetId, (1 - 0.99 ** 20) * Math.floor(maxSp / 10)],
        ]);
        expect(sustain?.gains[1]?.from).toMatchObject({ name: "極限の魔力", slot: "armor" });
        expect(sustain?.gains[2]).toMatchObject({ from: { source: { kind: "item", id: abyssGarbWithExtremeMagicSetId }, name: "アビスセイバーガーブ + 極限の魔力", slot: "armor" }, chance: { percent: 1, origin: "assumed" } });
        expect({ maxSp, naturalRecoveryPerTick, usesPerSecond: sustain?.usesPerSecond }).toEqual({ maxSp: 3890, naturalRecoveryPerTick: 58, usesPerSecond: 2 });
        // 200 SP a second spent, 7.25 + 38 + 70.8 back.
        expect(sustain?.fullBar?.seconds).toBeCloseTo(3890 / (200 - 7.25 - 38 - (1 - 0.99 ** 20) * 389));
    });

    it("counts a proc as on with the timed item upstream has for it, the engine taking off the SP cost and the card adding what comes back", () => {
        const melonFoxTailItemId = 4426;
        const melonWeaponsTimedItemId = 212;
        const weapon = abyssArmorBuild().character.equipment.rightHand;
        if (weapon === undefined) {
            throw new Error("the golden build changed");
        }
        const withAMelonFoxTail = (timedItems: number[]) => {
            const build = abyssArmorBuild();
            return { ...build, character: { ...build.character, timedItems, equipment: { ...build.character.equipment, rightHand: { itemId: melonFoxTailItemId, refine: 7 } } } };
        };
        const melonOf = (timedItems: number[]) => spSustainOfBuild(withAMelonFoxTail(timedItems), engine)?.gains.find((gain) => gain.from.kind === "worn" && gain.from.source.id === melonFoxTailItemId);

        expect(engine.catalog.sourcesOfTimedItem(melonWeaponsTimedItemId)).toContainEqual({ kind: "item", id: melonFoxTailItemId });
        expect(melonOf([])?.state?.onBecause).toBeNull();
        expect(spSustainOfBuild(withAMelonFoxTail([melonWeaponsTimedItemId]), engine)?.spCostPerUse).toBe(1);
        expect(melonOf([melonWeaponsTimedItemId])?.state).toMatchObject({ shareOfTimeOn: 1, onBecause: "timedItem" });
    });

    it("takes a chance set for an item, card or enchant by its ID", () => {
        const build = parseBuild(JSON.parse(readFileSync(new URL("../build/golden-builds/spirit-handler-abyss-armor.build.json", import.meta.url), "utf8")));
        const draculaCardId = 2359;
        const weapon = build.character.equipment.rightHand;
        if (weapon === undefined) {
            throw new Error("the golden build changed");
        }
        const withADrainCard = { ...build, character: { ...build.character, equipment: { ...build.character.equipment, rightHand: { ...weapon, sockets: [draculaCardId] } } } };
        const drainOf = (chances?: Parameters<typeof spSustainOfBuild>[2]) =>
            spSustainOfBuild(withADrainCard, engine, chances)?.gains.find((gain) => gain.from.kind === "worn" && gain.from.source.id === draculaCardId);

        expect(drainOf()?.chance).toEqual({ percent: 1, origin: "assumed" });
        expect(drainOf({ cardsOrEnchants: { [draculaCardId]: 4 } })?.chance).toEqual({ percent: 4, origin: "yours" });
        expect(drainOf({ cardsOrEnchants: { [draculaCardId]: 4 } })?.perSecond).toBeCloseTo(4 * (drainOf()?.perSecond ?? 0));
    });
});
