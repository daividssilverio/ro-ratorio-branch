import committedDefinitions from "./upstream-panels.json" with { type: "json" };

/** One choice of a setting, with the label the original shows for it. */
export interface PanelChoice {
    readonly value: number;
    readonly label: string;
}

/** What one setting of a panel offers. */
export interface PanelSettingDefinition {
    /** The highest value. 1 for a setting that is only off or on. */
    readonly highest: number;
    /** Value and label pairs, for a setting whose values are not plain levels. Left out otherwise. */
    readonly choices?: readonly (readonly [value: number, label: string])[];
}

/** One buff of a panel whose buffs the original knows only by their position in the panel. */
export interface PanelBuffDefinition extends PanelSettingDefinition {
    /** The original's label for the buff. */
    readonly label: string;
    /** The heading the original shows the buff under, where its panel has headings. */
    readonly group?: string;
}

/** The three panels whose buffs have no name or ID upstream, only a position. */
export const positionalBuffPanels = ["guildBuffs", "itemBuffs", "otherBuffs"] as const;
export type PositionalBuffPanel = (typeof positionalBuffPanels)[number];

/**
 * What the original's buff panels offer, as plain data. The original keeps
 * this inside the code that builds its page, so it is extracted from there
 * into `upstream-panels.json`; see docs/upstream-ui-logic.md.
 */
export interface PanelDefinitions {
    /** How far the original lets gear be refined and transcended. */
    readonly gearLimits: { readonly highestRefine: number; readonly highestTranscendence: number };
    /** By ratorio skill ID: each job's own buffs, as the job with the lowest ID that has the buff is offered it. */
    readonly selfBuffs: Readonly<Record<string, PanelSettingDefinition>>;
    /** By ratorio job ID, then skill ID: where a job is offered an own buff differently from `selfBuffs`. */
    readonly selfBuffsOfJob: Readonly<Record<string, Readonly<Record<string, PanelSettingDefinition>>>>;
    /** By support buff name: the support buffs whose values are not levels. */
    readonly supportBuffChoices: Readonly<Record<string, PanelSettingDefinition>>;
    /** By customisation section and setting name ("attack.WEAPON_ATK"): the customisation settings whose values are not plain numbers. */
    readonly customizationChoices: Readonly<Record<string, PanelSettingDefinition>>;
    /** By monster settings section and setting name ("buffs.ZOKUSEI_HENKA"): the monster settings whose values are not plain numbers. */
    readonly targetSettingChoices: Readonly<Record<string, PanelSettingDefinition>>;
    /** By position in the panel: guild skills, gospel and the like. */
    readonly guildBuffs: Readonly<Record<string, PanelBuffDefinition>>;
    /** By position in the panel: consumables and food. */
    readonly itemBuffs: Readonly<Record<string, PanelBuffDefinition>>;
    /** By position in the panel: pet, manuals, party and the rest. */
    readonly otherBuffs: Readonly<Record<string, PanelBuffDefinition>>;
}

/** One buff of a positional panel, ready to be offered. */
export interface PositionalBuffSetting {
    /** The buff's key in a build: its position in the original's panel. */
    readonly position: number;
    readonly label: string;
    readonly group?: string;
    /** 1 for a buff that is only off or on. */
    readonly highest: number;
    readonly choices?: readonly PanelChoice[];
}

/** The buffs of a positional panel, in panel order. */
export function positionalBuffSettingsOf(definitions: PanelDefinitions, panel: PositionalBuffPanel): PositionalBuffSetting[] {
    return Object.entries(definitions[panel])
        .map(([position, definition]) => {
            const choices = choicesOf(definition);
            return {
                position: Number(position),
                label: definition.label,
                ...(definition.group === undefined ? {} : { group: definition.group }),
                highest: definition.highest,
                ...(choices === undefined ? {} : { choices }),
            };
        })
        .sort((oneSetting, otherSetting) => oneSetting.position - otherSetting.position);
}

/** Whether the original's panel offers this value for this setting. 0, off, is always offered. */
export function isOfferedBy(definition: PanelSettingDefinition, value: number): boolean {
    if (value === 0) {
        return true;
    }
    return definition.choices === undefined ? Number.isInteger(value) && value >= 1 && value <= definition.highest : definition.choices.some(([choiceValue]) => choiceValue === value);
}

export const panelDefinitions: PanelDefinitions = committedDefinitions as unknown as PanelDefinitions;

export function selfBuffDefinitionOf(definitions: PanelDefinitions, jobId: number, skillId: number): PanelSettingDefinition | undefined {
    return definitions.selfBuffsOfJob[String(jobId)]?.[String(skillId)] ?? definitions.selfBuffs[String(skillId)];
}

export function choicesOf(definition: PanelSettingDefinition): PanelChoice[] | undefined {
    return definition.choices?.map(([value, label]) => ({ value, label }));
}

/** The text of `upstream-panels.json` for these definitions: one setting per line, keys in numeric then alphabetic order. */
export function serializePanelDefinitions(definitions: PanelDefinitions): string {
    const sectionText = (settings: Readonly<Record<string, PanelSettingDefinition>>) =>
        Object.keys(settings)
            .sort((oneKey, otherKey) => Number(oneKey) - Number(otherKey) || oneKey.localeCompare(otherKey))
            .map((key) => `        ${JSON.stringify(key)}: ${JSON.stringify(settings[key])}`)
            .join(",\n");
    const byNumber = (oneKey: string, otherKey: string) => Number(oneKey) - Number(otherKey);
    const jobSections = Object.keys(definitions.selfBuffsOfJob)
        .sort(byNumber)
        .map((jobId) => `        ${JSON.stringify(jobId)}: ${JSON.stringify(Object.fromEntries(Object.entries(definitions.selfBuffsOfJob[jobId] ?? {}).sort(([oneKey], [otherKey]) => byNumber(oneKey, otherKey))))}`)
        .join(",\n");
    return `{\n    "gearLimits": ${JSON.stringify(definitions.gearLimits)},\n    "selfBuffs": {\n${sectionText(definitions.selfBuffs)}\n    },\n    "selfBuffsOfJob": {\n${jobSections}\n    },\n    "supportBuffChoices": {\n${sectionText(definitions.supportBuffChoices)}\n    },\n    "customizationChoices": {\n${sectionText(definitions.customizationChoices)}\n    },\n    "targetSettingChoices": {\n${sectionText(definitions.targetSettingChoices)}\n    },\n    "guildBuffs": {\n${sectionText(definitions.guildBuffs)}\n    },\n    "itemBuffs": {\n${sectionText(definitions.itemBuffs)}\n    },\n    "otherBuffs": {\n${sectionText(definitions.otherBuffs)}\n    }\n}\n`;
}
