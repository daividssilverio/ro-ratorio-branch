import {
    type Character,
    type CustomizationSection,
    customizationSections,
    type NamedSetting,
    type PositionalBuffPanel,
    type PositionalBuffSetting,
    type SupportBuffSection,
    type TargetSettingSection,
    targetSettingSections,
} from "@ro-ratorio-branch/core/platform-neutral";
import type { JobSettings } from "../engine-host/host-protocol.ts";
import { rowsMatching } from "./picker-model.ts";
import { t } from "./text/ui-text.ts";

/** The parts of a character that hold a value per skill or buff. */
export type SettingsField = "learnedSkills" | "selfBuffs" | "supportBuffs" | PositionalBuffPanel;

export const settingsFields: readonly SettingsField[] = ["learnedSkills", "selfBuffs", "supportBuffs", "guildBuffs", "itemBuffs", "otherBuffs"];

/**
 * Where a row's value is kept: a part of the character (`supportBuffs`), or
 * a part inside a part, written with a dot (`customization.attack`,
 * `targetSettings.buffs`).
 */
export type SettingPlace = SettingsField | `customization.${CustomizationSection}` | `targetSettings.${TargetSettingSection}`;

export type SettingsTabId = "learnedSkills" | "selfBuffs" | "support" | "items" | "other" | "custom";

export interface SettingsTab {
    readonly id: SettingsTabId;
    readonly label: string;
    /** The places whose rows the tab lists, in order. */
    readonly places: readonly SettingPlace[];
}

export const settingsTabs: readonly SettingsTab[] = [
    { id: "learnedSkills", label: t("習得スキル"), places: ["learnedSkills"] },
    { id: "selfBuffs", label: t("自己支援"), places: ["selfBuffs"] },
    { id: "support", label: t("支援 · デバフ"), places: ["supportBuffs", "guildBuffs"] },
    { id: "items", label: t("アイテム"), places: ["itemBuffs"] },
    { id: "other", label: t("その他"), places: ["otherBuffs"] },
    { id: "custom", label: t("カスタム"), places: customizationSections.map((section): SettingPlace => `customization.${section}`) },
];

/** The places of a scenario's monster settings, in the order the original shows them. */
export const targetSettingPlaces: readonly SettingPlace[] = targetSettingSections.map((section): SettingPlace => `targetSettings.${section}`);

const customizationLabels: Readonly<Record<CustomizationSection, string>> = {
    status: t("基本ステータス"),
    attack: t("攻撃"),
    defense: t("防御"),
    skill: t("スキル"),
    traitStatus: t("特性ステータス"),
};

const targetSettingLabels: Readonly<Record<TargetSettingSection, string>> = {
    asPlayer: t("対プレイヤー"),
    ailments: t("状態異常 · デバフ"),
    buffs: t("強化"),
};

type ValuesByKey = Readonly<Record<string, number>>;
type ValuesByKeyByPart = Readonly<Record<string, ValuesByKey | undefined>>;

/** The value a holder (a character or a scenario) has at a place and key. 0 when it has none. */
export function valueAtPlace(holder: object, place: SettingPlace, key: string | number): number {
    const [outerName, innerName] = place.split(".") as [string, string | undefined];
    const outer: unknown = Reflect.get(holder, outerName);
    const values = innerName === undefined ? (outer as ValuesByKey | undefined) : (outer as ValuesByKeyByPart | undefined)?.[innerName];
    return values?.[String(key)] ?? 0;
}

/**
 * The holder with one value set at a place. A value of 0 takes the entry
 * out, and a part with no entries left is dropped, which is how the build
 * format writes "none".
 */
export function withValueAtPlace<Holder extends object>(holder: Holder, place: SettingPlace, key: string | number, value: number): Holder {
    const withEntry = (values: ValuesByKey | undefined, entryKey: string, entryValue: number): ValuesByKey | undefined => {
        const { [entryKey]: _previousValue, ...otherValues } = values ?? {};
        const nextValues = entryValue === 0 ? otherValues : { ...otherValues, [entryKey]: entryValue };
        return Object.keys(nextValues).length === 0 ? undefined : nextValues;
    };
    const withPart = <Whole extends object>(whole: Whole, partName: string, part: object | undefined): Whole => {
        const { [partName as keyof Whole]: _previousPart, ...wholeWithoutPart } = whole;
        return (part === undefined ? wholeWithoutPart : { ...wholeWithoutPart, [partName]: part }) as Whole;
    };
    const [outerName, innerName] = place.split(".") as [string, string | undefined];
    const outer: unknown = Reflect.get(holder, outerName);
    if (innerName === undefined) {
        return withPart(holder, outerName, withEntry(outer as ValuesByKey | undefined, String(key), value));
    }
    const inner = withPart((outer as ValuesByKeyByPart | undefined) ?? {}, innerName, withEntry((outer as ValuesByKeyByPart | undefined)?.[innerName], String(key), value));
    return withPart(holder, outerName, Object.keys(inner).length === 0 ? undefined : inner);
}

const sectionLabels: Readonly<Record<SupportBuffSection, string>> = {
    confIchizi: t("一次職支援"),
    confNizi: t("二次職支援"),
    confSanzi: t("三次職支援"),
    confYozi: t("四次職支援"),
    confDebuff: t("デバフ"),
};

/** The character with one skill level or buff value set; see `withValueAtPlace`. */
export function withSetting<Holder extends Pick<Character, SettingsField>>(character: Holder, field: SettingsField, key: string | number, value: number): Holder {
    return withValueAtPlace(character, field, key, value);
}

/** How many skills or buffs each part has set. */
export function settingCountsOf(character: Pick<Character, SettingsField>): Readonly<Record<SettingsField, number>> {
    const countOf = (field: SettingsField) => Object.keys(character[field] ?? {}).length;
    return {
        learnedSkills: countOf("learnedSkills"),
        selfBuffs: countOf("selfBuffs"),
        supportBuffs: countOf("supportBuffs"),
        guildBuffs: countOf("guildBuffs"),
        itemBuffs: countOf("itemBuffs"),
        otherBuffs: countOf("otherBuffs"),
    };
}

type CountedCharacter = Pick<Character, SettingsField | "timedItems" | "speedPotion" | "weaponElement" | "arrowId" | "customization" | "autoSpells" | "costumeId">;

type AutoSpell = NonNullable<Character["autoSpells"]>[number];

/** The character with its auto-spells replaced; none at all drops the part. */
export function withAutoSpells<Holder extends Pick<Character, "autoSpells">>(character: Holder, autoSpells: readonly AutoSpell[]): Holder {
    const { autoSpells: _previousAutoSpells, ...characterWithoutAutoSpells } = character;
    return (autoSpells.length === 0 ? characterWithoutAutoSpells : { ...characterWithoutAutoSpells, autoSpells: [...autoSpells] }) as Holder;
}

/** One auto-spell of the list changed in place. A level of 0 is left out, which is how the build format writes "its own level". */
export function withAutoSpellAt<Holder extends Pick<Character, "autoSpells">>(character: Holder, row: number, change: Partial<Pick<AutoSpell, "level" | "chancePerMille">>): Holder {
    return withAutoSpells(
        character,
        (character.autoSpells ?? []).map((autoSpell, index) => {
            if (index !== row) {
                return autoSpell;
            }
            const { level: _previousLevel, ...autoSpellWithoutLevel } = { ...autoSpell, ...change };
            const level = change.level ?? autoSpell.level ?? 0;
            return level === 0 ? autoSpellWithoutLevel : { ...autoSpellWithoutLevel, level };
        }),
    );
}

/** How many values a part of parts has set (a customisation, the monster settings). */
export function countOfParts(parts: ValuesByKeyByPart | undefined): number {
    return Object.values(parts ?? {}).reduce((count, values) => count + Object.keys(values ?? {}).length, 0);
}

/** How many things each tab has set: its rows, and the single settings it shows above them. */
export function setCountsOfTabs(character: CountedCharacter): Readonly<Record<SettingsTabId, number>> {
    const counts = settingCountsOf(character);
    const isSet = (value: number | undefined) => ((value ?? 0) === 0 ? 0 : 1);
    return {
        learnedSkills: counts.learnedSkills,
        selfBuffs: counts.selfBuffs,
        support: counts.supportBuffs + counts.guildBuffs,
        items: counts.itemBuffs + (character.timedItems ?? []).length + isSet(character.speedPotion),
        other: counts.otherBuffs + isSet(character.weaponElement) + isSet(character.arrowId) + isSet(character.costumeId) + (character.autoSpells ?? []).length,
        custom: countOfParts(character.customization),
    };
}

export interface SettingChoice {
    readonly value: number;
    readonly label: string;
}

/** One row of the editor, whichever part it belongs to. */
export interface SettingRow {
    readonly place: SettingPlace;
    /** The row's key within its place. */
    readonly key: string;
    readonly label: string;
    readonly group: string | null;
    readonly lowest: number;
    readonly highest: number;
    /** A label per value, where the values are not levels. */
    readonly choices?: readonly SettingChoice[];
}

function rowsOfNamedSettings(place: SettingPlace, settings: readonly NamedSetting[], group: string): SettingRow[] {
    return settings.map((setting) => ({
        place,
        key: setting.name,
        label: setting.label,
        group,
        lowest: setting.lowest,
        highest: setting.highest,
        ...(setting.choices === undefined ? {} : { choices: setting.choices }),
    }));
}

function rowsOfPlace(jobSettings: JobSettings, place: SettingPlace): SettingRow[] {
    const [outerName, innerName] = place.split(".");
    if (outerName === "customization") {
        const section = innerName as CustomizationSection;
        return rowsOfNamedSettings(place, jobSettings.customizations[section], customizationLabels[section]);
    }
    if (outerName === "targetSettings") {
        const section = innerName as TargetSettingSection;
        return rowsOfNamedSettings(place, jobSettings.targetSettings[section], targetSettingLabels[section]);
    }
    const field = place as SettingsField;
    if (field === "supportBuffs") {
        return jobSettings.supportBuffs.map((buff) => ({
            place,
            key: buff.name,
            label: buff.label,
            group: sectionLabels[buff.section],
            lowest: buff.lowest,
            highest: buff.highest,
            ...(buff.choices === undefined ? {} : { choices: buff.choices }),
        }));
    }
    if (field === "learnedSkills" || field === "selfBuffs") {
        return (field === "learnedSkills" ? jobSettings.learnableSkills : jobSettings.selfBuffs).map((skill) => ({
            place,
            key: String(skill.id),
            label: skill.name,
            group: null,
            lowest: 0,
            highest: skill.highestLevel,
            ...(skill.choices === undefined ? {} : { choices: skill.choices }),
        }));
    }
    return jobSettings[field].map((buff: PositionalBuffSetting) => ({
        place,
        key: String(buff.position),
        label: buff.label,
        group: buff.group ?? null,
        lowest: 0,
        highest: buff.highest,
        ...(buff.choices === undefined ? {} : { choices: buff.choices }),
    }));
}

/** Every row of the given places, place after place. */
export function rowsOfPlaces(jobSettings: JobSettings, places: readonly SettingPlace[]): SettingRow[] {
    return places.flatMap((place) => rowsOfPlace(jobSettings, place));
}

/** Every row of a tab, place after place. */
export function rowsOfTab(jobSettings: JobSettings, tab: SettingsTab): SettingRow[] {
    return rowsOfPlaces(jobSettings, tab.places);
}

/** A list of levels longer than this is typed, not picked. */
const longestPickedListOfLevels = 20;

/** How a row is set: a switch, a list to pick from, or a number to type. */
export function controlOf(row: SettingRow): "toggle" | "choice" | "number" {
    if (row.choices !== undefined) {
        return "choice";
    }
    if (row.lowest === 0 && row.highest === 1) {
        return "toggle";
    }
    return row.highest - row.lowest > longestPickedListOfLevels ? "number" : "choice";
}

/** The values a row offers, with what to show for each. 0 is always among them: it means "not set". */
export function valueChoicesOf(row: SettingRow): readonly SettingChoice[] {
    const choices =
        row.choices ??
        Array.from({ length: row.highest - row.lowest + 1 }, (_unused, index) => ({ value: row.lowest + index, label: row.lowest + index === 0 ? "—" : String(row.lowest + index) }));
    return choices.some((choice) => choice.value === 0) ? choices : [{ value: 0, label: "—" }, ...choices];
}

/** The rows that match what was typed and, if asked, are set on the holder (a character or a scenario), in their own order. */
export function shownRowsOf(rows: readonly SettingRow[], holder: object, query: string, showsOnlySet: boolean): SettingRow[] {
    return rowsMatching(rows, (row) => row.label, query).filter((row) => !showsOnlySet || valueAtPlace(holder, row.place, row.key) !== 0);
}
