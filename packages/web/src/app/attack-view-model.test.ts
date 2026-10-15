import type { AttackMethod, AttackOptionList, Scenario } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { attackEntriesOf, attackOfScenario, attackRowsOf, scenarioWithAttack, scenarioWithAttackRow } from "./attack-view-model.ts";

const distance: AttackOptionList = { label: "距離", defaultValue: 3, lowest: 1, highest: 9 };
const cannonball: AttackOptionList = {
    label: "",
    defaultValue: 1,
    choices: [
        { value: 0, label: "キャノンボール" },
        { value: 1, label: "アイアンキャノンボール" },
        { value: 4, label: "ソウルキャノンボール", next: distance },
    ],
};
const armsCannon: AttackMethod = {
    skillId: 554,
    name: "アームズキャノン",
    source: "job",
    levels: { label: "", defaultValue: 5, choices: [1, 2, 3, 4, 5].map((level) => ({ value: level, label: String(level) })), next: cannonball },
};
const fireBolt: AttackMethod = { skillId: 51, name: "ファイアーボルト", source: "gear", levels: { label: "", defaultValue: 5, choices: [1, 2, 3, 4, 5].map((level) => ({ value: level, label: String(level) })) } };
const autoSpellFireBolt: AttackMethod = { ...fireBolt, source: "autoSpell", name: "ファイアーボルト(確認用)" };
const scenario: Scenario = { skillId: 554, skillName: "アームズキャノン", skillLevel: 5, skillOptions: [1], targetMonsterId: 850 };

describe("attack entries", () => {
    it("numbers the attacks by their place, and says where one that is not the job's comes from", () => {
        const entries = attackEntriesOf([armsCannon, fireBolt, autoSpellFireBolt]);

        expect(entries.map((entry) => entry.id)).toEqual([0, 1, 2]);
        expect(entries.map((entry) => entry.detail === undefined)).toEqual([true, false, false]);
        expect(entries[1]?.detail).not.toBe(entries[2]?.detail);
    });

    it("finds the scenario's attack by skill and source", () => {
        expect(attackOfScenario([fireBolt, armsCannon], scenario)).toBe(armsCannon);
        expect(attackOfScenario([fireBolt, autoSpellFireBolt], { skillId: 51, skillSource: "autoSpell" })).toBe(autoSpellFireBolt);
        expect(attackOfScenario([fireBolt], { skillId: 51 })).toBeUndefined();
    });
});

describe("scenarioWithAttack", () => {
    it("takes the attack's default level and options, names its source, and drops the old name", () => {
        expect(scenarioWithAttack(scenario, fireBolt)).toEqual({ skillId: 51, skillSource: "gear", skillLevel: 5, targetMonsterId: 850 });
        expect(scenarioWithAttack({ skillId: 51, skillSource: "gear", skillLevel: 2, targetMonsterId: 850 }, armsCannon)).toEqual({ skillId: 554, skillLevel: 5, skillOptions: [1], targetMonsterId: 850 });
    });
});

describe("attack rows", () => {
    it("lists the level and then the options along what is chosen", () => {
        expect(attackRowsOf(armsCannon, scenario).map((row) => [row.position, row.value, row.isOffered])).toEqual([
            [0, 5, true],
            [1, 1, true],
        ]);
        expect(attackRowsOf(armsCannon, { skillLevel: 5, skillOptions: [4] }).map((row) => [row.label, row.value])).toEqual([
            ["", 5],
            ["", 4],
            ["距離", 3],
        ]);
    });

    it("marks a value the option does not take", () => {
        expect(attackRowsOf(armsCannon, { skillLevel: 9, skillOptions: [7] }).map((row) => row.isOffered)).toEqual([false, false]);
    });

    it("sets the level and keeps the options that still fit", () => {
        expect(scenarioWithAttackRow(scenario, armsCannon, 0, 3)).toEqual({ skillId: 554, skillLevel: 3, skillOptions: [1], targetMonsterId: 850 });
    });

    it("sets an option, and gives what newly follows it its default", () => {
        const withSoul = scenarioWithAttackRow(scenario, armsCannon, 1, 4);

        expect(withSoul.skillOptions).toEqual([4, 3]);
        expect(scenarioWithAttackRow(withSoul, armsCannon, 2, 7).skillOptions).toEqual([4, 7]);
        expect(scenarioWithAttackRow(withSoul, armsCannon, 1, 0).skillOptions).toEqual([0]);
    });
});
