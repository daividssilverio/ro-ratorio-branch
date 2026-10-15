import { type Character, parseBuild, type Scenario } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { type JobSettings, noJobSettings } from "../engine-host/host-protocol.ts";
import { controlOf, rowsOfTab, setCountsOfTabs, settingCountsOf, type SettingsTab, settingsTabs, shownRowsOf, valueChoicesOf, withSetting, countOfParts, rowsOfPlaces, targetSettingPlaces, valueAtPlace, withValueAtPlace, withAutoSpellAt, withAutoSpells } from "./settings-editor-model.ts";

const character: Character = {
    jobId: 51,
    baseLevel: 200,
    jobLevel: 70,
    baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
    learnedSkills: { 280: 5 },
    supportBuffs: { BLESSING: 10 },
    equipment: {},
};
const scenario = { skillId: 554, skillLevel: 5, targetMonsterId: 850 };

describe("withSetting", () => {
    it("sets a level next to the ones already there", () => {
        expect(withSetting(character, "learnedSkills", 281, 3).learnedSkills).toEqual({ 280: 5, 281: 3 });
        expect(withSetting(character, "supportBuffs", "BLESSING", 7).supportBuffs).toEqual({ BLESSING: 7 });
    });

    it("starts a part the character did not have", () => {
        expect(withSetting(character, "selfBuffs", 152, 1).selfBuffs).toEqual({ 152: 1 });
    });

    it("takes an entry out at 0, and drops a part that is left empty", () => {
        const withTwo = withSetting(character, "learnedSkills", 281, 3);

        expect(withSetting(withTwo, "learnedSkills", 280, 0).learnedSkills).toEqual({ 281: 3 });
        expect("learnedSkills" in withSetting(character, "learnedSkills", 280, 0)).toBe(false);
    });

    it("leaves a character the build format accepts", () => {
        const edited = withSetting(withSetting(character, "supportBuffs", "BLESSING", 0), "selfBuffs", 152, 1);

        expect(parseBuild({ formatVersion: 1, character: edited, scenario }).character).toEqual(edited);
    });
});

describe("settingCountsOf and setCountsOfTabs", () => {
    it("counts what each part has set", () => {
        expect(settingCountsOf(character)).toEqual({ learnedSkills: 1, selfBuffs: 0, supportBuffs: 1, guildBuffs: 0, itemBuffs: 0, otherBuffs: 0 });
    });

    it("counts a tab's rows together with the single settings it shows", () => {
        const busy: Character = {
            ...character,
            guildBuffs: { 5: 1, 30: 120 },
            itemBuffs: { 9: 1 },
            otherBuffs: { 0: 55 },
            timedItems: [3, 4],
            speedPotion: 2,
            weaponElement: 3,
        };

        expect(setCountsOfTabs({ ...busy, customization: { attack: { ATK_PLUS: 50, MATK_PLUS: -20 }, skill: { SKILL_DAMAGE_UP: 10 } } })).toEqual({ learnedSkills: 1, selfBuffs: 0, support: 3, items: 4, other: 2, custom: 3 });
        expect(setCountsOfTabs(character)).toEqual({ learnedSkills: 1, selfBuffs: 0, support: 1, items: 0, other: 0, custom: 0 });
    });
});

describe("rows of a tab", () => {
    const jobSettings: JobSettings = {
        ...noJobSettings,
        learnableSkills: [{ id: 280, name: "斧修練", highestLevel: 10 }],
        supportBuffs: [{ name: "BLESSING", label: "ブレッシング", section: "confIchizi", control: "number", lowest: 0, highest: 10 }],
        guildBuffs: [
            { position: 5, label: "ステータスALL+20", group: "ゴスペルスキル", highest: 1 },
            { position: 30, label: "STR", group: "持ち替え", highest: 600 },
        ],
        itemBuffs: [
            { position: 9, label: "恨みの箱(ATK+20)", highest: 1 },
            { position: 15, label: "攻撃方法を追加する", highest: 1 },
            { position: 47, label: "期間限定系[ASPD] なし", highest: 50, choices: [{ value: 0, label: "なし" }, { value: 10, label: "ASPD+10%" }] },
        ],
    };
    const tab = (id: string): SettingsTab => {
        const found = settingsTabs.find((candidate) => candidate.id === id);
        if (found === undefined) {
            throw new Error(`no tab ${id}`);
        }
        return found;
    };

    it("lists the guild buffs after the support buffs, each row knowing its part", () => {
        const rows = rowsOfTab(jobSettings, tab("support"));

        expect(rows.map((row) => [row.place, row.key, row.group])).toEqual([
            ["supportBuffs", "BLESSING", "一次職支援"],
            ["guildBuffs", "5", "ゴスペルスキル"],
            ["guildBuffs", "30", "持ち替え"],
        ]);
    });

    it("lists every item buff by its position", () => {
        expect(rowsOfTab(jobSettings, tab("items")).map((row) => row.key)).toEqual(["9", "15", "47"]);
    });

    it("picks the control from the range: a switch, a list, or a number to type", () => {
        const controlOfKey = (tabId: string, key: string) => {
            const row = rowsOfTab(jobSettings, tab(tabId)).find((candidate) => candidate.key === key);
            return row === undefined ? undefined : controlOf(row);
        };

        expect(controlOfKey("support", "5")).toBe("toggle");
        expect(controlOfKey("support", "BLESSING")).toBe("choice");
        expect(controlOfKey("support", "30")).toBe("number");
        expect(controlOfKey("items", "47")).toBe("choice");
        expect(controlOfKey("learnedSkills", "280")).toBe("choice");
    });

    it("always offers 0, and the labelled values as they are", () => {
        const [skillRow] = rowsOfTab(jobSettings, tab("learnedSkills"));
        const speedRow = rowsOfTab(jobSettings, tab("items")).find((row) => row.key === "47");

        expect(skillRow === undefined ? [] : valueChoicesOf(skillRow).map((choice) => choice.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(speedRow === undefined ? [] : valueChoicesOf(speedRow).map((choice) => choice.value)).toEqual([0, 10]);
    });

    it("narrows to what was typed and to what is set", () => {
        const rows = rowsOfTab(jobSettings, tab("support"));
        const withGospel: Character = { ...character, guildBuffs: { 5: 1 } };

        expect(shownRowsOf(rows, withGospel, "STR", false).map((row) => row.key)).toEqual(["30"]);
        expect(shownRowsOf(rows, withGospel, "", true).map((row) => row.key)).toEqual(["BLESSING", "5"]);
    });
});

describe("values in a part of a part", () => {
    const attackPlace = "customization.attack" as const;

    it("reads 0 where nothing is set, and the value where something is", () => {
        expect(valueAtPlace(character, attackPlace, "ATK_PLUS")).toBe(0);
        expect(valueAtPlace({ ...character, customization: { attack: { ATK_PLUS: -30 } } }, attackPlace, "ATK_PLUS")).toBe(-30);
        expect(valueAtPlace(character, "supportBuffs", "BLESSING")).toBe(10);
    });

    it("starts the part and the part inside it, and drops both again when the last value goes", () => {
        const withAttack = withValueAtPlace(character, attackPlace, "ATK_PLUS", -30);
        const withSkillToo = withValueAtPlace(withAttack, "customization.skill", "SKILL_DAMAGE_UP", 10);

        expect(withAttack.customization).toEqual({ attack: { ATK_PLUS: -30 } });
        expect(withSkillToo.customization).toEqual({ attack: { ATK_PLUS: -30 }, skill: { SKILL_DAMAGE_UP: 10 } });
        expect(withValueAtPlace(withSkillToo, attackPlace, "ATK_PLUS", 0).customization).toEqual({ skill: { SKILL_DAMAGE_UP: 10 } });
        expect("customization" in withValueAtPlace(withAttack, attackPlace, "ATK_PLUS", 0)).toBe(false);
        expect(parseBuild({ formatVersion: 1, character: withSkillToo, scenario }).character).toEqual(withSkillToo);
    });

    it("does the same for a scenario's monster settings", () => {
        const withBuff: Scenario = withValueAtPlace<Scenario>(scenario, "targetSettings.buffs", "ASSUMPTIO", 1);

        expect(withBuff).toEqual({ ...scenario, targetSettings: { buffs: { ASSUMPTIO: 1 } } });
        expect(withValueAtPlace(withBuff, "targetSettings.buffs", "ASSUMPTIO", 0)).toEqual(scenario);
        expect(countOfParts(withBuff.targetSettings)).toBe(1);
    });

    it("lists the customisation under its five headings and the monster settings under their three", () => {
        const settings: JobSettings = {
            ...noJobSettings,
            customizations: { ...noJobSettings.customizations, attack: [{ name: "ATK_PLUS", label: "ATK+", control: "number", lowest: -500, highest: 500 }], skill: [{ name: "DISABLE_SETTINGS", label: "無効", control: "number", lowest: 0, highest: 1 }] },
            targetSettings: { ...noJobSettings.targetSettings, buffs: [{ name: "ASSUMPTIO", label: "アスムプティオ", control: "toggle", lowest: 0, highest: 1 }] },
        };
        const customTab = settingsTabs.find((candidate) => candidate.id === "custom");
        const customRows = customTab === undefined ? [] : rowsOfTab(settings, customTab);

        expect(customRows.map((row) => [row.place, row.key])).toEqual([
            ["customization.attack", "ATK_PLUS"],
            ["customization.skill", "DISABLE_SETTINGS"],
        ]);
        expect(new Set(customRows.map((row) => row.group)).size).toBe(2);
        expect(customRows.map(controlOf)).toEqual(["number", "toggle"]);
        expect(rowsOfPlaces(settings, targetSettingPlaces).map((row) => [row.place, row.key])).toEqual([["targetSettings.buffs", "ASSUMPTIO"]]);
    });
});

describe("auto-spells of a character", () => {
    const fireBolt = { autoSpellId: 2, chancePerMille: 100 };

    it("starts the list, changes one in place, and drops the list with its last entry", () => {
        const withOne = withAutoSpells(character, [fireBolt]);
        const withLevel = withAutoSpellAt(withOne, 0, { level: 5 });

        expect(withOne.autoSpells).toEqual([fireBolt]);
        expect(withLevel.autoSpells).toEqual([{ ...fireBolt, level: 5 }]);
        expect(withAutoSpellAt(withLevel, 0, { chancePerMille: 15 }).autoSpells).toEqual([{ autoSpellId: 2, level: 5, chancePerMille: 15 }]);
        expect(withAutoSpellAt(withLevel, 0, { level: 0 }).autoSpells).toEqual([fireBolt]);
        expect("autoSpells" in withAutoSpells(withOne, [])).toBe(false);
        expect(parseBuild({ formatVersion: 1, character: withLevel, scenario }).character).toEqual(withLevel);
        expect(setCountsOfTabs(withOne).other).toBe(1);
    });
});
