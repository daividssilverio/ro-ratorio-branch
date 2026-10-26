import { describe, expect, it } from "vitest";
import { readSpGainLine, type SpGainLine } from "./sp-gain-wording.ts";

/** Lines as upstream words them for items, cards and enchants, with the item or card they come from. */
const readLines: { line: string; from: string; reading: SpGainLine }[] = [
    {
        line: "一般装備に装備時、1秒毎にSP + 1%",
        from: "card 2098",
        reading: { conditions: [{ kind: "onRegularGear" }], effects: [{ kind: "periodic", recovery: { seconds: 1, amount: 1, unit: "percentOfMaxSp" } }], unread: false },
    },
    {
        line: "10秒毎に、HP + 1000 , SP + 100",
        from: "card 2043",
        reading: { conditions: [], effects: [{ kind: "periodic", recovery: { seconds: 10, amount: 100, unit: "sp" } }], unread: false },
    },
    {
        line: "10秒ごとに SP5 回復。(計算機未導入)",
        from: "item 919",
        reading: { conditions: [], effects: [{ kind: "periodic", recovery: { seconds: 10, amount: 5, unit: "sp" } }], unread: false },
    },
    {
        line: "超越段階が2以上の時、精錬値が10の時、5秒毎にHP + 5% , SP + 5%",
        from: "item 5457",
        reading: {
            conditions: [
                { kind: "transcendenceAtLeast", stage: 2 },
                { kind: "refineExactly", refine: 10 },
            ],
            effects: [{ kind: "periodic", recovery: { seconds: 5, amount: 5, unit: "percentOfMaxSp" } }],
            unread: false,
        },
    },
    {
        line: "精錬値が1上がる度に追加で10秒毎にSP + 10",
        from: "card 2964",
        reading: { conditions: [{ kind: "timesRefineSteps", refinePerStep: 1 }], effects: [{ kind: "periodic", recovery: { seconds: 10, amount: 10, unit: "sp" } }], unread: false },
    },
    {
        line: "純粋なVitが90以上の時、追加で、5秒毎にHP + 90 , SP + 9",
        from: "item 3970",
        reading: { conditions: [{ kind: "pureStatAtLeast", stat: "vit", value: 90 }], effects: [{ kind: "periodic", recovery: { seconds: 5, amount: 9, unit: "sp" } }], unread: false },
    },
    {
        line: "攻撃命中時、毎回3のSPを回復する。",
        from: "item 579",
        reading: { conditions: [], effects: [{ kind: "onHit", attack: "anyAttack", amount: 3 }], unread: false },
    },
    {
        line: "星帝が装備時、攻撃命中時、SP + 2",
        from: "item 4130",
        reading: { conditions: [{ kind: "job", jobName: "星帝" }], effects: [{ kind: "onHit", attack: "anyAttack", amount: 2 }], unread: false },
    },
    {
        line: "[点穴 -快-]Lv5習得時、追加で、攻撃命中時、SP + 3",
        from: "item 4588",
        reading: { conditions: [{ kind: "skillLearned", skillName: "点穴-快-", level: 5 }], effects: [{ kind: "onHit", attack: "anyAttack", amount: 3 }], unread: false },
    },
    {
        line: "精錬値が9以上の時、追加で物理攻撃でモンスターを倒した時、SP+10。",
        from: "item 3575",
        reading: { conditions: [{ kind: "refineAtLeast", refine: 9 }], effects: [{ kind: "onKill", attack: "physical", amount: 10 }], unread: false },
    },
    {
        line: "物理攻撃時、1%の確率で相手に与えたダメージの4%をSPとして吸収する。",
        from: "item 827",
        reading: { conditions: [], effects: [{ kind: "drain", attack: "physical", chancePercent: 1, percentOfDamage: 4 }], unread: false },
    },
    {
        line: "精錬値が8以上の時、物理攻撃命中時、一定確率で敵に与えたダメージの3%をHPとして吸収、一定確率で敵に与えたダメージの2%をSPとして吸収。",
        from: "item 2340, its two lines joined",
        reading: { conditions: [{ kind: "refineAtLeast", refine: 8 }], effects: [{ kind: "drain", attack: "physical", chancePercent: null, percentOfDamage: 2 }], unread: false },
    },
    {
        line: "物理・魔法攻撃命中時、一定確率で5秒間、スキル使用時の消費SP - 100%、1秒毎にSP + 100",
        from: "item 4404",
        reading: {
            conditions: [],
            effects: [
                {
                    kind: "proc",
                    attack: "physicalOrMagical",
                    chancePercent: null,
                    durationSeconds: 5,
                    recovery: { seconds: 1, amount: 100, unit: "sp" },
                    costDownPercent: 100,
                },
            ],
            unread: false,
        },
    },
];

/** Lines about gaining SP whose condition or wording is not read: they are listed as not counted. */
const unreadLines: { line: string; from: string }[] = [
    { line: "近接物理攻撃で不死形モンスターを倒した時、SP+5。", from: "a melee and race condition" },
    { line: "人間形モンスターに攻撃命中時、SP + 2", from: "a race condition" },
    { line: "「循環する自然の音」使用時、60秒間、1秒毎にSP+4。", from: "after using a skill" },
    { line: "キューペット「サキュバス」を連れている時、追加で5秒毎にHP+500、SP+20。", from: "a pet condition" },
    { line: "魔法攻撃時、低確率でHPとSPが一定量回復", from: "no amount" },
];

/** Lines that say nothing about gaining SP. */
const otherLines = ["戦闘不能から復活時、HP・SPを100%回復する", "スキル使用時の消費SP - 10%", "MaxSP + 100", "SP回復力 + 10%", "Atk + 10"];

describe("reading how an effect gives SP back", () => {
    it.each(readLines)("reads $from", ({ line, reading }) => {
        expect(readSpGainLine(line)).toEqual(reading);
    });

    it.each(unreadLines)("marks as unread a line with $from", ({ line }) => {
        expect(readSpGainLine(line)?.unread).toBe(true);
    });

    it.each(otherLines)("leaves out %s", (line) => {
        expect(readSpGainLine(line)).toBeNull();
    });
});
