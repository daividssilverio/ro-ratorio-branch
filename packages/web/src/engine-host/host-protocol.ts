import type {
    AttackMethod,
    Build,
    BuildOutcome,
    CatalogEntry,
    Character,
    CustomizationSection,
    EquipmentSlot,
    GearListing,
    NamedSetting,
    TargetSettingSection,
    ItemDescription,
    JobLimits,
    NotExportedPart,
    RatorioSaveImport,
    SkillLevelSetting,
    StatPointBudget,
    PositionalBuffSetting, SupportBuffSetting,
    UnreadableSaveFlaw,
} from "@ro-ratorio-branch/core/platform-neutral";

/** The IDs whose upstream names the app wants to show. */
export interface IdsToDescribe {
    readonly jobIds: readonly number[];
    readonly skillIds: readonly number[];
    readonly monsterIds: readonly number[];
    readonly itemIds: readonly number[];
    readonly cardOrEnchantIds: readonly number[];
    readonly randomOptionIds?: readonly number[];
}

/** Upstream names by ID. An ID the engine does not have is simply absent. */
export interface Descriptions {
    readonly jobNames: Readonly<Record<number, string>>;
    readonly skillNames: Readonly<Record<number, string>>;
    readonly monsterNames: Readonly<Record<number, string>>;
    readonly items: Readonly<Record<number, ItemDescription>>;
    readonly cardsOrEnchants: Readonly<Record<number, ItemDescription>>;
    readonly randomOptionNames: Readonly<Record<number, string>>;
}

export const noDescriptions: Descriptions = {
    jobNames: {},
    skillNames: {},
    monsterNames: {},
    items: {},
    cardsOrEnchants: {},
    randomOptionNames: {},
};

/** What reading a ratorio save gave: its content as a character and scenario, or why it could not be read. */
export type SaveReadOutcome =
    | { readonly state: "read"; readonly saveImport: RatorioSaveImport }
    | { readonly state: "unreadable"; readonly flaw: UnreadableSaveFlaw };

/** A build as a ratorio save URL, and what the save could not carry. */
export interface SaveWritten {
    readonly saveUrl: string;
    readonly notExported: readonly NotExportedPart[];
}

/** Everything about skills and buffs that a character of a job can set. */
export interface JobSettings {
    readonly learnableSkills: readonly SkillLevelSetting[];
    readonly selfBuffs: readonly SkillLevelSetting[];
    readonly supportBuffs: readonly SupportBuffSetting[];
    readonly guildBuffs: readonly PositionalBuffSetting[];
    readonly itemBuffs: readonly PositionalBuffSetting[];
    readonly otherBuffs: readonly PositionalBuffSetting[];
    /** The performance customisation, the same for every job. */
    readonly customizations: Readonly<Record<CustomizationSection, readonly NamedSetting[]>>;
    /** The monster settings, the same for every job. */
    readonly targetSettings: Readonly<Record<TargetSettingSection, readonly NamedSetting[]>>;
    /** The chances an auto-spell can be given, in per mille. */
    readonly autoSpellChances: readonly number[];
    /** `null` for a job the engine does not have. */
    readonly limits: JobLimits | null;
    /** The limits of a character set as adopted, whose highest base stat is lower. */
    readonly limitsWhenAdopted: JobLimits | null;
    /** Whether the job can hold a weapon in its left hand. */
    readonly wieldsTwoWeapons: boolean;
}

export const noJobSettings: JobSettings = {
    learnableSkills: [],
    selfBuffs: [],
    supportBuffs: [],
    guildBuffs: [],
    itemBuffs: [],
    otherBuffs: [],
    customizations: { status: [], attack: [], defense: [], skill: [], traitStatus: [] },
    targetSettings: { asPlayer: [], ailments: [], buffs: [] },
    autoSpellChances: [],
    limits: null,
    limitsWhenAdopted: null,
    wieldsTwoWeapons: false,
};

/** A market listing as it was read, and the slots its item fits, so that it can be checked against where it is to go. */
export interface GearListingRead {
    readonly listing: GearListing;
    readonly slotsOfItem: readonly EquipmentSlot[];
}

/** One of the lists the engine has to choose from. */
export type CatalogList =
    | { readonly what: "jobs" }
    /** With `withEffects`, every entry also says what it does, to search by. */
    | { readonly what: "itemsForSlot"; readonly slot: EquipmentSlot; readonly jobId: number; readonly withEffects?: boolean }
    /** What one socket of the item takes when worn in the slot. 0 is the first socket. */
    | { readonly what: "socketChoicesOfItem"; readonly slot: EquipmentSlot; readonly itemId: number; readonly socketIndex: number; readonly withEffects?: boolean }
    | { readonly what: "monsters" }
    /** What the item rolls at one of its five positions. 0 is the first position. */
    | { readonly what: "randomOptionsOfItem"; readonly itemId: number; readonly positionIndex: number }
    | { readonly what: "timedItems" }
    | { readonly what: "autoSpells" }
    | { readonly what: "costumesOfJob"; readonly jobId: number }
    | { readonly what: "speedPotions" }
    | { readonly what: "weaponElements" }
    | { readonly what: "arrowsOfJob"; readonly jobId: number }
    | { readonly what: "attackSkillsOfJob"; readonly jobId: number };

/** Where gear fits and who may wear it. An item the engine does not have fits nothing and nobody. */
export interface GearFacts {
    readonly slotsOfItem: Readonly<Record<number, readonly EquipmentSlot[]>>;
    /** For each item, those of the asked jobs that may wear it. */
    readonly wearingJobIdsOfItem: Readonly<Record<number, readonly number[]>>;
}

export const noGearFacts: GearFacts = { slotsOfItem: {}, wearingJobIdsOfItem: {} };

/** What the app asks the engine host. The host answers each request with the same `requestId`. */
export type HostRequest =
    | { readonly kind: "calculate"; readonly requestId: number; readonly build: Build }
    | { readonly kind: "describe"; readonly requestId: number; readonly ids: IdsToDescribe }
    | { readonly kind: "readSave"; readonly requestId: number; readonly saveUrlOrData: string }
    | { readonly kind: "writeSave"; readonly requestId: number; readonly build: Build }
    | { readonly kind: "listCatalog"; readonly requestId: number; readonly list: CatalogList }
    | { readonly kind: "listJobSettings"; readonly requestId: number; readonly jobId: number }
    | { readonly kind: "checkGear"; readonly requestId: number; readonly itemIds: readonly number[]; readonly jobIds: readonly number[] }
    /** The stat points the character has earned and spent. `null` for a job the engine does not have. */
    | { readonly kind: "countStatPoints"; readonly requestId: number; readonly character: Character }
    /** Reads the text of a market listing as a gear piece; for a piece whose item is already chosen, the text may leave the item out. */
    | { readonly kind: "readGearListing"; readonly requestId: number; readonly text: string; readonly itemId?: number }
    /** The skills that the given gear and cards do something more for when they are learned. */
    | { readonly kind: "listSkillsGearRewards"; readonly requestId: number; readonly itemIds: readonly number[]; readonly cardOrEnchantIds: readonly number[] }
    /** The attacks the build's character can use, whatever its scenario attacks with. None for a character that cannot be calculated. */
    | { readonly kind: "listAttackMethods"; readonly requestId: number; readonly build: Build };

export type HostResponse =
    | { readonly kind: "ready" }
    | { readonly kind: "calculated"; readonly requestId: number; readonly outcome: BuildOutcome }
    | { readonly kind: "described"; readonly requestId: number; readonly descriptions: Descriptions }
    | { readonly kind: "saveRead"; readonly requestId: number; readonly outcome: SaveReadOutcome }
    | { readonly kind: "saveWritten"; readonly requestId: number; readonly written: SaveWritten }
    | { readonly kind: "catalogListed"; readonly requestId: number; readonly entries: readonly CatalogEntry[] }
    | { readonly kind: "gearChecked"; readonly requestId: number; readonly gearFacts: GearFacts }
    | { readonly kind: "jobSettingsListed"; readonly requestId: number; readonly jobSettings: JobSettings }
    | { readonly kind: "attackMethodsListed"; readonly requestId: number; readonly attackMethods: readonly AttackMethod[] }
    | { readonly kind: "statPointsCounted"; readonly requestId: number; readonly statPoints: StatPointBudget | null }
    | { readonly kind: "skillsGearRewardsListed"; readonly requestId: number; readonly skillIds: readonly number[] }
    | { readonly kind: "gearListingRead"; readonly requestId: number; readonly listingRead: GearListingRead }
    | { readonly kind: "failed"; readonly requestId: number; readonly reason: string };

export function isHostRequest(message: unknown): message is HostRequest {
    return hasKind(message, ["calculate", "describe", "readSave", "writeSave", "listCatalog", "listJobSettings", "checkGear", "listAttackMethods", "countStatPoints", "listSkillsGearRewards", "readGearListing"]) && typeof Reflect.get(message, "requestId") === "number";
}

export function isHostResponse(message: unknown): message is HostResponse {
    return hasKind(message, ["ready", "calculated", "described", "saveRead", "saveWritten", "catalogListed", "jobSettingsListed", "gearChecked", "attackMethodsListed", "statPointsCounted", "skillsGearRewardsListed", "gearListingRead", "failed"]);
}

function hasKind(message: unknown, kinds: readonly string[]): message is object {
    return typeof message === "object" && message !== null && kinds.includes(Reflect.get(message, "kind"));
}
