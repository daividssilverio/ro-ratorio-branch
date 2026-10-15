import { choicesOf, type PanelChoice, panelDefinitions } from "../panels/panel-definitions.ts";

/** The five parts of the original's "performance customisation": numbers added on top of what the character has. */
export const customizationSections = ["status", "attack", "defense", "skill", "traitStatus"] as const;
export type CustomizationSection = (typeof customizationSections)[number];

/** The three parts of the original's monster settings: the target taken as a player, ailments on it, and its own buffs. */
export const targetSettingSections = ["asPlayer", "ailments", "buffs"] as const;
export type TargetSettingSection = (typeof targetSettingSections)[number];

/** The calc model list each section fills, a setting's upstream slot number being its index. */
export const calcModelListOfCustomizationSection = {
    status: "confCustomStatus",
    attack: "confCustomAtk",
    defense: "confCustomDef",
    skill: "confCustomSkill",
    traitStatus: "confCustomSpecStatus",
} as const satisfies Record<CustomizationSection, string>;

export const calcModelListOfTargetSettingSection = {
    asPlayer: "mobConfTaisei",
    ailments: "mobConfIjyou",
    buffs: "mobConfKyouka",
} as const satisfies Record<TargetSettingSection, string>;

/** One setting upstream knows by a constant name. */
export interface NamedSetting {
    /** The setting's key in a build: its upstream constant name without its prefix. */
    readonly name: string;
    /** Upstream's Japanese label. */
    readonly label: string;
    /** A toggle is 0 or 1; a number runs from `lowest` to `highest`. */
    readonly control: "toggle" | "number";
    readonly lowest: number;
    readonly highest: number;
    /** Upstream's own label for each value, for a setting whose values are not plain numbers. */
    readonly choices?: readonly PanelChoice[];
}

export interface NamedSettingsLayout {
    /** Every setting a user can set, in panel order. */
    readonly settings: readonly NamedSetting[];
    /** The slot number of each setting, which is its position in the section's calc model list. */
    readonly positionOfName: ReadonlyMap<string, number>;
    /** The settings a ratorio save has no place for. */
    readonly namesSavesDoNotCarry: ReadonlySet<string>;
}

/** Whether the setting takes the value. 0, not set, is always taken. */
export function isOfferedBySetting(setting: NamedSetting, value: number): boolean {
    if (value === 0) {
        return true;
    }
    if (setting.choices !== undefined) {
        return setting.choices.some((choice) => choice.value === value);
    }
    return Number.isInteger(value) && value >= setting.lowest && value <= setting.highest;
}

interface RowPositions {
    readonly id: number;
    readonly text: number;
    readonly controlType: number;
    readonly lowest: number;
    readonly highest: number;
}

const namesUpstreamShowsNoControlFor = /^(DUMMY|BLANK)/;

/**
 * The slot number of every setting among a table's constants, by name
 * without the prefix.
 *
 * A table can export the values of a setting under the same prefix as the
 * settings (SENTO_AREA_PVP next to SENTO_AREA). Where two constants share a
 * number, the one that extends another constant's name is such a value.
 */
export function settingSlotsOf(constants: Readonly<Record<string, unknown>>, idNamePrefix: string): Map<string, number> {
    const numberOfConstant = new Map<string, number>();
    for (const [constantName, position] of Object.entries(constants)) {
        const name = constantName.startsWith(idNamePrefix) ? constantName.slice(idNamePrefix.length) : undefined;
        if (name !== undefined && typeof position === "number" && !namesUpstreamShowsNoControlFor.test(name)) {
            numberOfConstant.set(name, position);
        }
    }
    const isAValueOfASetting = (name: string) => [...numberOfConstant.keys()].some((otherName) => name.startsWith(`${otherName}_`));
    return new Map(
        [...numberOfConstant].filter(([name, position]) => {
            const sharesItsNumber = [...numberOfConstant].some(([otherName, otherPosition]) => otherName !== name && otherPosition === position);
            return !(sharesItsNumber && isAValueOfASetting(name));
        }),
    );
}

/**
 * The settings of one upstream table. `idNamePrefix` is what the table's
 * slot number constants start with; `choicesKeyPrefix` says where the
 * extracted labels of its special dropdowns are filed.
 */
async function layoutOfTable(
    dataRows: readonly (readonly unknown[] | undefined)[],
    positions: RowPositions,
    constants: Readonly<Record<string, unknown>>,
    idNamePrefix: string,
    extractedChoices: Readonly<Record<string, { readonly highest: number; readonly choices?: readonly (readonly [number, string])[] }>>,
    choicesKeyPrefix: string,
): Promise<NamedSettingsLayout> {
    const controlTypes = await import("../../../../vendor/ratorio/engine/const/EnumControlType.js");
    const toggleControlTypes = [controlTypes.CONTROL_TYPE_CHECKBOX, controlTypes.CONTROL_TYPE_CHECKBOX_SPECIAL];
    const numberControlTypes = [controlTypes.CONTROL_TYPE_SELECTBOX_NUMBER, controlTypes.CONTROL_TYPE_SELECTBOX_PERCENT, controlTypes.CONTROL_TYPE_TEXTBOX_NUMBER, controlTypes.CONTROL_TYPE_SELECTBOX_SPECIAL];

    const positionOfName = settingSlotsOf(constants, idNamePrefix);
    const nameOfPosition = new Map([...positionOfName].map(([name, position]) => [position, name]));

    const settings: NamedSetting[] = [];
    for (const dataRow of dataRows) {
        const name = nameOfPosition.get(dataRow?.[positions.id] as number);
        const label = dataRow?.[positions.text];
        const controlType = dataRow?.[positions.controlType] as number;
        const lowest = dataRow?.[positions.lowest];
        const highest = dataRow?.[positions.highest];
        if (name === undefined || typeof label !== "string") {
            continue;
        }
        if (toggleControlTypes.includes(controlType)) {
            settings.push({ name, label, control: "toggle", lowest: 0, highest: 1 });
        } else if (numberControlTypes.includes(controlType) && typeof lowest === "number" && typeof highest === "number") {
            const definition = extractedChoices[`${choicesKeyPrefix}${name}`];
            const choices = definition === undefined ? undefined : choicesOf(definition);
            settings.push({ name, label, control: "number", lowest, highest, ...(choices === undefined ? {} : { choices }) });
        }
    }
    const offeredNames = new Set(settings.map((setting) => setting.name));
    return { settings, positionOfName: new Map([...positionOfName].filter(([name]) => offeredNames.has(name))), namesSavesDoNotCarry: new Set() };
}

/**
 * Constructs upstream's five customisation classes, which is what gives
 * their settings a slot number (the engine reads those numbers when it
 * calculates), and reads what each offers.
 */
export async function loadCustomizationLayouts(): Promise<Record<CustomizationSection, NamedSettingsLayout>> {
    const { CConfBase } = await import("../../../../vendor/ratorio/engine/ui/CConfBase.js");
    const settingsClassOfSection = {
        status: (await import("../../../../vendor/ratorio/engine/chara/CCharaConfCustomStatus.js")).CCharaConfCustomStatus,
        attack: (await import("../../../../vendor/ratorio/engine/chara/CCharaConfCustomAtk.js")).CCharaConfCustomAtk,
        defense: (await import("../../../../vendor/ratorio/engine/chara/CCharaConfCustomDef.js")).CCharaConfCustomDef,
        skill: (await import("../../../../vendor/ratorio/engine/chara/CCharaConfCustomSkill.js")).CCharaConfCustomSkill,
        traitStatus: (await import("../../../../vendor/ratorio/engine/chara/CCharaConfCustomSpecStatus.js")).CCharaConfCustomSpecStatus,
    } satisfies Record<CustomizationSection, unknown>;

    // Upstream's saves spread the customisation over several units, and its mapping tables name every slot that has a place in one.
    const savedSlotMaps: Readonly<Record<string, readonly (readonly { readonly confIndex: number }[])[]>> = {};
    const mappingTables = await import("../../../../vendor/ratorio/engine/savedata/conf-mig-mapping.js");
    for (const table of Object.values(mappingTables)) {
        if (typeof table === "object") {
            for (const [listName, entries] of Object.entries(table)) {
                (savedSlotMaps as Record<string, (readonly { readonly confIndex: number }[])[]>)[listName] = [...(savedSlotMaps[listName] ?? []), entries];
            }
        }
    }
    const savedSlotsOf = (section: CustomizationSection) => new Set((savedSlotMaps[calcModelListOfCustomizationSection[section]] ?? []).flat().map((entry) => entry.confIndex));

    const layouts = {} as Record<CustomizationSection, NamedSettingsLayout>;
    for (const section of customizationSections) {
        const SettingsClass = settingsClassOfSection[section];
        const { confDataObj } = new SettingsClass([]);
        const position = (constantName: string): number => {
            const value = CConfBase[constantName];
            if (typeof value !== "number") {
                throw new TypeError(`Upstream no longer defines CConfBase.${constantName}`);
            }
            return value;
        };
        layouts[section] = await layoutOfTable(
            confDataObj,
            {
                id: position("CONF_DATA_INDEX_ID"),
                text: position("CONF_DATA_INDEX_TEXT"),
                controlType: position("CONF_DATA_INDEX_CONTROL_TYPE"),
                lowest: position("CONF_DATA_INDEX_MIN_VALUE"),
                highest: position("CONF_DATA_INDEX_MAX_VALUE"),
            },
            SettingsClass,
            "CONF_ID_",
            panelDefinitions.customizationChoices,
            `${section}.`,
        );
        const savedSlots = savedSlotsOf(section);
        layouts[section] = {
            ...layouts[section],
            namesSavesDoNotCarry: new Set([...layouts[section].positionOfName].filter(([, position]) => !savedSlots.has(position)).map(([name]) => name)),
        };
    }
    return layouts;
}

const byName = (moduleExports: object): Readonly<Record<string, unknown>> => moduleExports as Readonly<Record<string, unknown>>;

/** Reads what upstream's three monster settings tables offer. */
export async function loadTargetSettingLayouts(): Promise<Record<TargetSettingSection, NamedSettingsLayout>> {
    const tableOfSection = {
        asPlayer: { exports: byName(await import("../../../../vendor/ratorio/engine/monster/mobconfplayer.js")), rows: "MobConfPlayerOBJ", prefix: "MOB_CONF_PLAYER_" },
        ailments: { exports: byName(await import("../../../../vendor/ratorio/engine/monster/mobconfdebuf.js")), rows: "MobConfDebufOBJ", prefix: "MOB_CONF_DEBUF_" },
        buffs: { exports: byName(await import("../../../../vendor/ratorio/engine/monster/mobconfbuf.js")), rows: "MobConfBufOBJ", prefix: "MOB_CONF_BUF_" },
    } satisfies Record<TargetSettingSection, unknown>;

    const layouts = {} as Record<TargetSettingSection, NamedSettingsLayout>;
    for (const section of targetSettingSections) {
        const { exports, rows, prefix } = tableOfSection[section];
        const dataRows = exports[rows];
        const position = (suffix: string): number => {
            const value = exports[`${prefix}DATA_INDEX_${suffix}`];
            if (typeof value !== "number") {
                throw new TypeError(`Upstream no longer defines ${prefix}DATA_INDEX_${suffix}`);
            }
            return value;
        };
        if (!Array.isArray(dataRows)) {
            throw new TypeError(`Upstream no longer defines ${rows}`);
        }
        layouts[section] = await layoutOfTable(
            dataRows as readonly (readonly unknown[] | undefined)[],
            { id: position("ID"), text: position("TEXT"), controlType: position("CONTROL_TYPE"), lowest: position("MIN_VALUE"), highest: position("MAX_VALUE") },
            exports,
            `${prefix}ID_`,
            panelDefinitions.targetSettingChoices,
            `${section}.`,
        );
    }
    return layouts;
}
