// The upstream engine is untyped JavaScript. These declarations cover only the
// exports the adapter uses. This file must stay a script (no top-level import
// or export), otherwise the wildcard module names stop matching.

declare module "*/vendor/ratorio/engine/runtime/calc-headless.js" {
    export function calcFromModel(
        model: import("./ratorio-calc-model.ts").RatorioCalcModel,
    ): import("./ratorio-calc-model.ts").RatorioBattleResult;
}

declare module "*/vendor/ratorio/engine/runtime/calc-model.js" {
    /** Also returns the scalar sections, but with every value undefined. */
    export function createEmptyModel(): import("./ratorio-calc-model.ts").RatorioCalcModelArrays;
}

declare module "*/vendor/ratorio/engine/battle/CBattleCalcResultAll.js" {
    export const CBattleCalcResultAll: abstract new () => import("./ratorio-calc-model.ts").RatorioBattleResult;
}

declare module "*/vendor/ratorio/engine/const/EnumJobId.js" {
    export const JOB_ID_NOVICE: number;
    export const JOB_ID_MEISTER: number;
}

declare module "*/vendor/ratorio/engine/skill/skill.dat.js" {
    /** Indexed by skill ID. */
    export const SkillObjNew: readonly (readonly unknown[] | undefined)[];
    /** The plain attack as a user selects it. Upstream also has internal IDs for its right- and left-hand parts; those are not attack choices. */
    export const SKILL_ID_TUZYO_KOGEKI: number;
    export const SKILL_ID_ARMS_CANNON: number;
    export const SKILL_ID_MADOGEAR: number;
    export const SKILL_ID_MADOGEAR_LICENSE: number;
    export const SKILL_ID_ABR_DUAL_CANNON: number;
}

declare module "*/vendor/ratorio/engine/monster/CMonsterMapAreaComponentManager.js" {
    export const CMonsterMapAreaComponentManager: {
        readonly customSelectMonster: { selectedDataId: number };
    };
}

declare module "*/vendor/ratorio/engine/monster/monster.dat.js" {
    /** Indexed by monster ID. */
    export const MonsterObjNew: readonly (readonly unknown[] | undefined)[];
}

declare module "*/vendor/ratorio/engine/const/EnumMonsterDataIndex.js" {
    export const MONSTER_DATA_INDEX_KANA: number;
    export const MONSTER_DATA_INDEX_ID: number;
    export const MONSTER_DATA_INDEX_NAME: number;
    export const MONSTER_DATA_INDEX_LEVEL: number;
    export const MONSTER_DATA_INDEX_HP: number;
    export const MONSTER_DATA_INDEX_DEF_DIV: number;
    export const MONSTER_DATA_INDEX_MDEF_DIV: number;
    export const MONSTER_DATA_INDEX_BASE_EXP: number;
    export const MONSTER_DATA_INDEX_JOB_EXP: number;
    export const MONSTER_DATA_INDEX_SIZE: number;
    export const MONSTER_DATA_INDEX_ELEMENT: number;
    export const MONSTER_DATA_INDEX_RACE: number;
    export const MONSTER_DATA_INDEX_BOSS_TYPE: number;
    export const MONSTER_DATA_INDEX_RES: number;
    export const MONSTER_DATA_INDEX_MRES: number;
}

/** A monster's element is its kind in the tens and its level in the ones; these are the first level of each kind. */
declare module "*/vendor/ratorio/engine/const/EnumMonsterElement.js" {
    export const MONSTER_ELM_VANITY_1: number;
    export const MONSTER_ELM_WATER_1: number;
    export const MONSTER_ELM_EARTH_1: number;
    export const MONSTER_ELM_FIRE_1: number;
    export const MONSTER_ELM_WIND_1: number;
    export const MONSTER_ELM_POISON_1: number;
    export const MONSTER_ELM_HOLY_1: number;
    export const MONSTER_ELM_DARK_1: number;
    export const MONSTER_ELM_PSYCO_1: number;
    export const MONSTER_ELM_UNDEAD_1: number;
}

declare module "*/vendor/ratorio/engine/const/EnumRaceId.js" {
    export const RACE_ID_SOLID: number;
    export const RACE_ID_UNDEAD: number;
    export const RACE_ID_ANIMAL: number;
    export const RACE_ID_PLANT: number;
    export const RACE_ID_INSECT: number;
    export const RACE_ID_FISH: number;
    export const RACE_ID_DEMON: number;
    export const RACE_ID_HUMAN: number;
    export const RACE_ID_ANGEL: number;
    export const RACE_ID_DRAGON: number;
}

declare module "*/vendor/ratorio/engine/const/EnumSizeId.js" {
    export const SIZE_ID_SMALL: number;
    export const SIZE_ID_MEDIUM: number;
    export const SIZE_ID_LARGE: number;
}

declare module "*/vendor/ratorio/engine/const/EnumMonsterBossType.js" {
    export const MONSTER_BOSSTYPE_BOSS: number;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfIchizi.js" {
    /** Its CONF_ID_* slot numbers are static properties, assigned by the first construction. */
    export const CCharaConfIchizi: (new (settingValues: number[]) => {
        readonly confDataObj: readonly (readonly unknown[])[];
        /** Builds the control of a setting that has its own choices into the given table cell. */
        BuildUpSelectAreaSubForSpecial(tableCell: unknown, settingData: readonly unknown[]): void;
    }) &
        Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfNizi.js" {
    /** Its CONF_ID_* slot numbers are static properties, assigned by the first construction. */
    export const CCharaConfNizi: (new (settingValues: number[]) => {
        readonly confDataObj: readonly (readonly unknown[])[];
        /** Builds the control of a setting that has its own choices into the given table cell. */
        BuildUpSelectAreaSubForSpecial(tableCell: unknown, settingData: readonly unknown[]): void;
    }) &
        Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfSanzi.js" {
    /** Its CONF_ID_* slot numbers are static properties, assigned by the first construction. */
    export const CCharaConfSanzi: (new (settingValues: number[]) => {
        readonly confDataObj: readonly (readonly unknown[])[];
        /** Builds the control of a setting that has its own choices into the given table cell. */
        BuildUpSelectAreaSubForSpecial(tableCell: unknown, settingData: readonly unknown[]): void;
    }) &
        Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfYozi.js" {
    /** Its CONF_ID_* slot numbers are static properties, assigned by the first construction. */
    export const CCharaConfYozi: (new (settingValues: number[]) => {
        readonly confDataObj: readonly (readonly unknown[])[];
        /** Builds the control of a setting that has its own choices into the given table cell. */
        BuildUpSelectAreaSubForSpecial(tableCell: unknown, settingData: readonly unknown[]): void;
    }) &
        Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfDebuff.js" {
    /** Its CONF_ID_* slot numbers are static properties, assigned by the first construction. */
    export const CCharaConfDebuff: (new (settingValues: number[]) => {
        readonly confDataObj: readonly (readonly unknown[])[];
        /** Builds the control of a setting that has its own choices into the given table cell. */
        BuildUpSelectAreaSubForSpecial(tableCell: unknown, settingData: readonly unknown[]): void;
    }) &
        Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/runtime/global.js" {
    export const g_constDataManager: {
        /** Returns `null` when no data object has that ID. */
        GetDataObject(
            dataKind: number,
            dataId: number,
        ): { GetPassiveSkillIdArray(): number[]; GetLearnSkillIdArray(): number[]; GetAttackSkillIdArray(): number[]; IsEquipableEquipFlag(equipFlag: number): boolean } | null;
        /** The manager of one kind of data. For enchant lists it knows which lists an item takes. */
        GetDataManger(dataKind: number): { GetEnchListIdArrayByItemId(itemId: number): number[] };
        GetName(dataKind: number, dataId: number): string;
    };
}

declare module "*/vendor/ratorio/engine/const/EnumConstDataKind.js" {
    export const CONST_DATA_KIND_JOB: number;
    export const CONST_DATA_KIND_ENCHANT_LIST: number;
}

declare module "*/vendor/ratorio/engine/ui/BuffJobSpecificSelf.js" {
    export function setN_Skill1SW(panelIsOpen: boolean): void;
    /** Builds the page's own-buff panel for the engine's current job into the element with the ID `ID_PASS_SKILL`. */
    export function Click_PassSkillSW(): void;
}

declare module "*/vendor/ratorio/engine/ui/BuffGuildAndGospel.js" {
    /** Builds the page's guild and gospel panel from the template `TPL_BUFF_GUILD` into the element with the ID `SP_SIEN02`. */
    export function Click_Skill4SW(): void;
    export function setN_Skill4SW(panelIsOpen: boolean): void;
}

declare module "*/vendor/ratorio/engine/ui/BuffItemAndFood.js" {
    /** Builds the page's item and food panel into the element with the ID `OBJID_SP_SIEN05`. */
    export function Click_Skill7SW(): void;
    export function setN_Skill7SW(panelIsOpen: boolean): void;
}

declare module "*/vendor/ratorio/engine/ui/BuffOtherCategory.js" {
    /** Builds the page's panel of other buffs from the template `TPL_BUFF_OTHER` into the element with the ID `ID_ETC`. */
    export function Click_Skill8SW(): void;
    export function setN_Skill8SW(panelIsOpen: boolean): void;
}

declare module "*/vendor/ratorio/engine/const/EnumAttackMethodSource.js" {
    export const ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN: number;
}

declare module "*/vendor/ratorio/engine/const/EnumItemKind.js" {
    /** One of many ITEM_KIND_* exports; the adapter also reads the others by name. */
    export const ITEM_KIND_NONE: number;
    export const ITEM_KIND_KNIFE: number;
    export const ITEM_KIND_SWORD: number;
    export const ITEM_KIND_AXE: number;
    export const ITEM_KIND_KATAR: number;
    export const ITEM_KIND_FUMA: number;
}

declare module "*/vendor/ratorio/engine/const/EnumElmId.js" {
    export const ELM_ID_VANITY: number;
    export const ELM_ID_COUNT: number;
}

declare module "*/vendor/ratorio/engine/equip/arrow.dat.js" {
    export const ARROW_ID_NONE: number;
    /** Indexed by arrow ID. */
    export const ArrowOBJNew: readonly (readonly unknown[] | undefined)[];
}

declare module "*/vendor/ratorio/engine/const/EnumArrowDataIndex.js" {
    export const ARROW_DATA_INDEX_NAME: number;
    export const ARROW_DATA_INDEX_KANA: number;
    export const ARROW_DATA_INDEX_KIND: number;
    export const ARROW_DATA_INDEX_DETAIL: number;
}

declare module "*/vendor/ratorio/engine/const/EnumMigItemParamId.js" {
    export const EQUIP_REGION_ID_COUNT: number;
    export const MIG_PARAM_ID_POW: number;
    export const MIG_PARAM_ID_STA: number;
    export const MIG_PARAM_ID_WIS: number;
    export const MIG_PARAM_ID_SPL: number;
    export const MIG_PARAM_ID_CON: number;
    export const MIG_PARAM_ID_CRT: number;
}

declare module "*/vendor/ratorio/engine/runtime/common.js" {
    export function GetElementText(elementId: number): string | undefined;
    export const CARD_REGION_ID_COUNT: number;
    export const COSTUME_REGION_ID_COUNT: number;
    export const COSTUME_REGION_ID_HEAD_UNDER: number;
    export const CARD_REGION_ID_ARMS_RIGHT_1: number;
    export const CARD_REGION_ID_ARMS_RIGHT_2: number;
    export const CARD_REGION_ID_ARMS_RIGHT_3: number;
    export const CARD_REGION_ID_ARMS_RIGHT_4: number;
    export const CARD_REGION_ID_ARMS_LEFT_1: number;
    export const CARD_REGION_ID_ARMS_LEFT_2: number;
    export const CARD_REGION_ID_ARMS_LEFT_3: number;
    export const CARD_REGION_ID_ARMS_LEFT_4: number;
    export const CARD_REGION_ID_HEAD_TOP: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_TOP_1: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_TOP_2: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_TOP_3: number;
    export const CARD_REGION_ID_HEAD_MID: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_MID_1: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_MID_2: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_MID_3: number;
    export const CARD_REGION_ID_HEAD_UNDER: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_UNDER_1: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_UNDER_2: number;
    export const CARD_REGION_ID_ENCHANT_HEAD_UNDER_3: number;
    export const CARD_REGION_ID_SHIELD: number;
    export const CARD_REGION_ID_ENCHANT_SHIELD_1: number;
    export const CARD_REGION_ID_ENCHANT_SHIELD_2: number;
    export const CARD_REGION_ID_ENCHANT_SHIELD_3: number;
    export const CARD_REGION_ID_BODY: number;
    export const CARD_REGION_ID_ENCHANT_BODY_1: number;
    export const CARD_REGION_ID_ENCHANT_BODY_2: number;
    export const CARD_REGION_ID_ENCHANT_BODY_3: number;
    export const CARD_REGION_ID_SHOULDER: number;
    export const CARD_REGION_ID_ENCHANT_SHOULDER_1: number;
    export const CARD_REGION_ID_ENCHANT_SHOULDER_2: number;
    export const CARD_REGION_ID_ENCHANT_SHOULDER_3: number;
    export const CARD_REGION_ID_SHOES: number;
    export const CARD_REGION_ID_ENCHANT_SHOES_1: number;
    export const CARD_REGION_ID_ENCHANT_SHOES_2: number;
    export const CARD_REGION_ID_ENCHANT_SHOES_3: number;
    export const CARD_REGION_ID_ACCESSORY_1: number;
    export const CARD_REGION_ID_ENCHANT_ACCESSORY_1_1: number;
    export const CARD_REGION_ID_ENCHANT_ACCESSORY_1_2: number;
    export const CARD_REGION_ID_ENCHANT_ACCESSORY_1_3: number;
    export const CARD_REGION_ID_ACCESSORY_2: number;
    export const CARD_REGION_ID_ENCHANT_ACCESSORY_2_1: number;
    export const CARD_REGION_ID_ENCHANT_ACCESSORY_2_2: number;
    export const CARD_REGION_ID_ENCHANT_ACCESSORY_2_3: number;
    export const CARD_REGION_ID_SHADOW_ARMS_RIGHT_1: number;
    export const CARD_REGION_ID_SHADOW_ARMS_RIGHT_2: number;
    export const CARD_REGION_ID_SHADOW_ARMS_RIGHT_3: number;
    export const CARD_REGION_ID_SHADOW_SHIELD_1: number;
    export const CARD_REGION_ID_SHADOW_SHIELD_2: number;
    export const CARD_REGION_ID_SHADOW_SHIELD_3: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_BODY_1: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_BODY_2: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_BODY_3: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_SHOES_1: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_SHOES_2: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_SHOES_3: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY1_1: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY1_2: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY1_3: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY2_1: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY2_2: number;
    export const CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY2_3: number;
}

declare module "*/vendor/ratorio/engine/const/EnumEquipRegionId.js" {
    export const EQUIP_REGION_ID_ARMS: number;
    export const EQUIP_REGION_ID_ARMS_LEFT: number;
    export const EQUIP_REGION_ID_HEAD_TOP: number;
    export const EQUIP_REGION_ID_HEAD_MID: number;
    export const EQUIP_REGION_ID_HEAD_UNDER: number;
    export const EQUIP_REGION_ID_SHIELD: number;
    export const EQUIP_REGION_ID_BODY: number;
    export const EQUIP_REGION_ID_SHOULDER: number;
    export const EQUIP_REGION_ID_SHOES: number;
    export const EQUIP_REGION_ID_ACCESSORY_1: number;
    export const EQUIP_REGION_ID_ACCESSORY_2: number;
    export const EQUIP_REGION_ID_SHADOW_ARMS_RIGHT: number;
    export const EQUIP_REGION_ID_SHADOW_ARMS_LEFT: number;
    export const EQUIP_REGION_ID_SHADOW_BODY: number;
    export const EQUIP_REGION_ID_SHADOW_FOOT: number;
    export const EQUIP_REGION_ID_SHADOW_ACCESSORY_1: number;
    export const EQUIP_REGION_ID_SHADOW_ACCESSORY_2: number;
}

declare module "*/vendor/ratorio/engine/const/EnumItemDataIndex.js" {
    export const ITEM_DATA_INDEX_KANA: number;
    export const ITEM_DATA_INDEX_KIND: number;
    export const ITEM_DATA_INDEX_WPNLV: number;
    export const ITEM_DATA_INDEX_NAME: number;
    export const ITEM_DATA_INDEX_DETAIL: number;
    export const ITEM_DATA_INDEX_SPBEGIN: number;
    export const ITEM_DATA_INDEX_SLOT: number;
}

declare module "*/vendor/ratorio/engine/equip/item.dat.js" {
    /** Indexed by item ID. */
    export const ItemObjNew: readonly (readonly unknown[] | undefined)[];
    /** Bare hands: what an empty weapon hand holds. */
    export const ITEM_ID_SUDE: number;
    /** What upstream puts into each armor slot that holds nothing. */
    export const ITEM_ID_NOEQUIP_HEAD_TOP: number;
    export const ITEM_ID_NOEQUIP_HEAD_MID: number;
    export const ITEM_ID_NOEQUIP_HEAD_UNDER: number;
    export const ITEM_ID_NOEQUIP_BODY: number;
    export const ITEM_ID_NOEQUIP_SHIELD: number;
    export const ITEM_ID_NOEQUIP_SHOULDER: number;
    export const ITEM_ID_NOEQUIP_SHOES: number;
    export const ITEM_ID_NOEQUIP_ACCESSORY: number;
    /** The two items whose last socket takes a card of their slot as an enchant. */
    export const ITEM_ID_KAITEI_SHINDENNO_ZAIHO_CARD_ENCHANTABLE: number;
    export const ITEM_ID_ALPHA_CORE_CARD_ENCHANTABLE: number;
}

declare module "*/vendor/ratorio/engine/equip/card.dat.js" {
    /** Indexed by card ID; enchants share the ID space. */
    export const CardObjNew: readonly (readonly unknown[] | undefined)[];
    /** By card kind: the card IDs a socket of that kind lists, in the page's order, starting with 0 for "none". */
    export const CardSortOBJ: readonly (readonly number[] | undefined)[];
}

declare module "*/vendor/ratorio/engine/const/EnumCharaDataIndex.js" {
    /** One of many CHARA_DATA_INDEX_* exports; the adapter reads them all by name. */
    export const CHARA_DATA_INDEX_MAXHP: number;
}

declare module "*/vendor/ratorio/engine/const/EnumItemSpId.js" {
    /** One of many ITEM_SP_* exports; the adapter reads them all by name. */
    export const ITEM_SP_NONE: number;
    /** The effect that marks an item or card as doing something more when a skill is learned; its value is the skill. */
    export const ITEM_SP_LEARNED_SKILL_EFFECT: number;
}

declare module "*/vendor/ratorio/engine/equip/timeitem.dat.js" {
    /** Indexed by timed item ID. Entry 0 stands for "none". */
    export const ITEM_SP_TIME_OBJ: readonly (readonly unknown[] | undefined)[];
    /** The timed item IDs the page lists, in its order, starting with 0 for "none". A few entries of the table are not in it. */
    export const ITEM_SP_TIME_OBJ_SORT: readonly number[];
}

declare module "*/vendor/ratorio/engine/const/EnumTimeItemDataIndex.js" {
    export const TIME_ITEM_DATA_INDEX_NAME: number;
    export const TIME_ITEM_DATA_INDEX_EXPLAIN: number;
}

declare module "*/vendor/ratorio/engine/runtime/roro-state.js" {
    /** Indexed by the speed potion setting. Entry 0 is "none". */
    export const SpeedPotName: readonly string[];
    /** The job the engine currently works with. A calculation sets it from its model. */
    export const n_A_JOB: number;
    export function set_n_A_JOB(jobId: number): void;
}

declare module "*/vendor/ratorio/engine/const/EnumArrowKind.js" {
    export const ARROW_KIND_ARROW: number;
    export const ARROW_KIND_BULLET: number;
}

declare module "*/vendor/ratorio/engine/ui/CConfBase.js" {
    /** Its CONF_DATA_INDEX_* positions are static properties, assigned by the first construction of a settings class. */
    export const CConfBase: Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/const/EnumControlType.js" {
    export const CONTROL_TYPE_SELECTBOX_NUMBER: number;
    export const CONTROL_TYPE_SELECTBOX_PERCENT: number;
    export const CONTROL_TYPE_SELECTBOX_SPECIAL: number;
    export const CONTROL_TYPE_CHECKBOX: number;
    export const CONTROL_TYPE_CHECKBOX_SPECIAL: number;
    export const CONTROL_TYPE_TEXTBOX_NUMBER: number;
}

declare module "*/vendor/ratorio/engine/equip/CShadowEquipControllerDataBridge.js" {
    /** The engine counts the random options of shadow gear only while a controller is registered. */
    export function registerShadowEquipController(controller: object): void;
}

declare module "*/vendor/ratorio/engine/equip/rndopttype.h.js" {
    /** Writes one random option position of an equipment region into the table the engine reads them from. */
    export function SetEquipRndOptTable(equipRegionId: number, optionPosition: number, optionId: number, value: number): void;
}

declare module "*/vendor/ratorio/engine/equip/rndopt.dat.js" {
    /** Indexed by random option ID. */
    export const g_rndOptArray: readonly (readonly number[] | undefined)[];
}

declare module "*/vendor/ratorio/engine/equip/rndopt.h.js" {
    /** The display name of the effect a random option gives, by the effect ID in its data row. */
    export function GetRndOptDispName(effectId: number): string | undefined;
}

declare module "*/vendor/ratorio/engine/equip/rndopttype.dat.js" {
    /** Indexed by random option type ID: the option list of each of the five positions, 0 for a position that takes none. */
    export const g_rndOptTypeArray: readonly (readonly [typeId: number, listIdOfPosition: readonly number[]] | undefined)[];
}

declare module "*/vendor/ratorio/engine/equip/rndoptlist.dat.js" {
    /** Indexed by option list ID: the options the list offers. Entry 0 of each is "none". */
    export const g_rndOptListArray: readonly (readonly [listId: number, optionIds: readonly number[]] | undefined)[];
}

declare module "*/vendor/ratorio/engine/equip/item.h.js" {
    /** The random option type packed into an item's weapon-level field. 0 for an item that takes no random options. */
    export function GetRndOptTypeId(weaponLevelField: number): number;
    /** One effect of an item or card in words: pieces of [colour, text], a condition first where the effect has one. */
    export function GetItemExplainText(effectId: number | bigint, effectValue: number | bigint): readonly (readonly [string, string])[];
}

declare module "*/vendor/ratorio/engine/const/EnumRndOptDataIndex.js" {
    export const RND_OPT_DATA_INDEX_MIN: number;
    export const RND_OPT_DATA_INDEX_MAX: number;
    export const RND_OPT_DATA_INDEX_STEP: number;
    export const RND_OPT_DATA_INDEX_SPID: number;
}

declare module "*/vendor/ratorio/engine/const/EnumRndOptTypeDataIndex.js" {
    export const RND_OPT_SLOT_COUNT: number;
}

declare module "*/vendor/ratorio/engine/const/EnumCardKind.js" {
    /** The list of a weapon's first socket: weapon cards behind a few entries only that socket has. */
    export const CARD_KIND_NONE: number;
    export const CARD_KIND_ARMS: number;
    export const CARD_KIND_HEAD: number;
    export const CARD_KIND_SHIELD: number;
    export const CARD_KIND_BODY: number;
    export const CARD_KIND_SHOULDER: number;
    export const CARD_KIND_FOOT: number;
    export const CARD_KIND_ACCESSORY: number;
    export const CARD_KIND_TOP: number;
    export const CARD_KIND_MID: number;
    export const CARD_KIND_UNDER: number;
    export const CARD_KIND_ACCESSORY_ON1: number;
    export const CARD_KIND_ACCESSORY_ON2: number;
    export const CARD_KIND_ENCHANT: number;
    export const CARD_KIND_ANY: number;
}

declare module "*/vendor/ratorio/engine/const/EnumCardDataIndex.js" {
    export const CARD_DATA_INDEX_KANA: number;
    export const CARD_DATA_INDEX_KIND: number;
    export const CARD_DATA_INDEX_NAME: number;
    export const CARD_DATA_INDEX_DETAIL: number;
    export const CARD_DATA_INDEX_SPBEGIN: number;
}

declare module "*/vendor/ratorio/engine/const/EnumSkillDataIndex.js" {
    export const SKILL_DATA_INDEX_NAME: number;
    export const SKILL_DATA_INDEX_MAXLV: number;
    export const SKILL_DATA_INDEX_REFID: number;
}

declare module "*/vendor/ratorio/engine/data/mig.job.h.js" {
    /** Throws for a job ID the engine does not have. */
    export function GetJobName(jobId: number): string;
    /** Throws for an item or job the engine does not have. */
    export function IsMatchJobRestrict(itemId: number, jobId: number): boolean;
    /** The first-job line a job belongs to. */
    export function GetLowerJobSeriesID(jobId: number): number;
    export function GetBaseLevelMin(jobId: number): number;
    export function GetBaseLevelMax(jobId: number): number;
    export function GetJobLevelMax(jobId: number): number;
    /** The highest base stat of the job. The second argument is whether the character is adopted. */
    export function GetStatusMax(jobId: number, isAdopted: boolean): number;
    /** The second-job line a job belongs to. */
    export function GetHigherJobSeriesID(jobId: number): number;
    /** Whether the job is a fourth job, which has trait stats. */
    export function IsYojiJob(jobId: number): boolean;
    /** Whether the job is a transcendent job or one that follows from one, which starts with more stat points. */
    export function IsReincarnatedJob(jobId: number): boolean;
    /** Whether the job can hold a weapon in each hand. */
    export function IsDualArmsJob(jobId: number): boolean;
    export const JOB_SERIES_ID_ASSASIN: number;
    export const JOB_SERIES_ID_THIEF: number;
    export const JOB_SERIES_ID_ARCHER: number;
    export const JOB_SERIES_ID_GUNSLINGER: number;
}

declare module "*/vendor/ratorio/engine/savedata/zstd-codec.js" {
    export function initializeZstd(): Promise<unknown>;
    export function zstdDecompressSync(compressed: Uint8Array): Uint8Array;
    export function base64ToUint8Array(base64Text: string): Uint8Array;
}

declare module "*/vendor/ratorio/engine/savedata/CSaveDataManager.js" {
    export class CSaveDataManager {
        parseDataText(dataText: string): void;
        /** A JSON array of units, each with a `parsedMap` of property name to value. */
        encodeToJSON(): string;
    }
}

declare module "*/vendor/ratorio/engine/savedata/CSaveDataUnitTypeManager.js" {
    interface UpstreamSaveUnit {
        setProp(propertyName: string, value: number | readonly number[]): void;
        /** Appends this unit to the data text and returns the new text and bit offset. Writes nothing for an empty unit. */
        encodeToURL(dataText: string, bitOffset: number): [string, number];
    }
    export const CSaveDataUnitTypeManager: {
        /** The unit classes register themselves when the save manager is imported. */
        getUnitClass(
            unitType: number,
        ): ((new () => UpstreamSaveUnit) & { readonly type: number; readonly version: number; readonly propNames: readonly string[] }) | undefined;
    };
}

declare module "*/vendor/ratorio/engine/savedata/CSaveDataConverter.js" {
    export const CSaveDataConverter: { ExtractDataTextMIG(dataText: string): string };
}

declare module "*/vendor/ratorio/engine/savedata/CSaveDataConst.js" {
    /** Property names and kinds as static members; the adapter reads them by name. */
    export const CSaveDataConst: Readonly<Record<string, unknown>>;
}

declare module "*/vendor/ratorio/engine/savedata/CSaveDataUnit.js" {
    /** One of many SAVE_DATA_UNIT_TYPE_* exports; the adapter reads them all by name. */
    export const SAVE_DATA_UNIT_TYPE_CHARA: number;
}

declare module "*/vendor/ratorio/engine/equip/hmcard.js" {
    /** One enchant an item's socket takes: the enchant list it comes from, its card ID, and the refine it asks for, if any. */
    export type UpstreamEnchantOffer = readonly [enchantListId: number, cardId: number, condition: { refinedBorderBase?: number; refinedBorderFlag?: number }];
    /**
     * The enchants of one enchant list, per socket, first socket first.
     * `collectedSoFar` is what earlier lists of the same item gave; two upgrade lists read it.
     */
    export function RebuildCardSelectSubCollectEnchListData(enchantListId: number, collectedSoFar: readonly (readonly UpstreamEnchantOffer[])[]): UpstreamEnchantOffer[][];
}

declare module "*/vendor/ratorio/engine/data/mig.itemsp.h.js" {
    /** "以上" and the like for a refine condition. */
    export function MigGetBorderFlagText(borderFlagId: number, isShort: boolean): string;
}

declare module "*/vendor/ratorio/engine/const/EnumMigBorderFlagId.js" {
    export const MIG_BORDER_FLAG_ID_OVER: number;
}

declare module "*/vendor/ratorio/engine/battle/CAttackMethodAreaComponentManager.js" {
    export const CAttackMethodAreaComponentManager: {
        /**
         * Every attack the character the engine last took in can use: its
         * job's skills, skills its gear and cards give it, and auto-spells,
         * each with its levels and options. Reads engine state, not the page.
         */
        GetEffectiveAttackMethodDataArray(): unknown[];
    };
}

declare module "*/vendor/ratorio/engine/const/EnumAttackMethodSource.js" {
    export const ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN: number;
    export const ATTACK_METHOD_SOURCE_TYPE_USABLE_SKILL: number;
    export const ATTACK_METHOD_SOURCE_TYPE_AUTO_SPELL: number;
}

declare module "*/vendor/ratorio/engine/const/EnumAttackMethodOptionListType.js" {
    export const ATTACK_METHOD_OPTION_LIST_TYPE_SELECT: number;
    export const ATTACK_METHOD_OPTION_LIST_TYPE_INPUT: number;
}

/** A settings class built on CConfBase: its CONF_ID_* slot numbers are static properties, assigned by the first construction. */
type UpstreamSettingsClass = (new (settingValues: number[]) => {
    readonly confDataObj: readonly (readonly unknown[])[];
    /** Builds the control of a setting that has its own choices into the given table cell. */
    BuildUpSelectAreaSubForSpecial(tableCell: unknown, settingData: readonly unknown[]): void;
}) &
    Readonly<Record<string, unknown>>;

declare module "*/vendor/ratorio/engine/chara/CCharaConfCustomStatus.js" {
    export const CCharaConfCustomStatus: UpstreamSettingsClass;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfCustomAtk.js" {
    export const CCharaConfCustomAtk: UpstreamSettingsClass;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfCustomDef.js" {
    export const CCharaConfCustomDef: UpstreamSettingsClass;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfCustomSkill.js" {
    export const CCharaConfCustomSkill: UpstreamSettingsClass;
}

declare module "*/vendor/ratorio/engine/chara/CCharaConfCustomSpecStatus.js" {
    export const CCharaConfCustomSpecStatus: UpstreamSettingsClass;
}

/** One of the three monster settings tables. Its rows, row positions and setting IDs are all exported by name, and read by name. */
declare module "*/vendor/ratorio/engine/monster/mobconfplayer.js" {
    export const MOB_CONF_PLAYER_LIMIT: number;
    /** Builds the page's panel of these settings into the given element. */
    export function BuildUpMobConfPlayerSelectArea(panelRoot: unknown, isExpanded: boolean): void;
}

declare module "*/vendor/ratorio/engine/monster/mobconfdebuf.js" {
    export const MOB_CONF_DEBUF_LIMIT: number;
    export function BuildUpMobConfDebufSelectArea(panelRoot: unknown, isExpanded: boolean): void;
}

declare module "*/vendor/ratorio/engine/monster/mobconfbuf.js" {
    export const MOB_CONF_BUF_LIMIT: number;
    export function BuildUpMobConfBufSelectArea(panelRoot: unknown, isExpanded: boolean): void;
}

declare module "*/vendor/ratorio/engine/savedata/save-model.js" {
    /** The plain model upstream builds every unit of a save from, with nothing filled in. */
    export function createEmptySaveModel(): Record<string, unknown>;
}

declare module "*/vendor/ratorio/engine/savedata/savedata-collect.js" {
    /** Every unit of a save, built from the plain model without reading the page. Empty units are left out. */
    export function buildSaveDataUnits(saveModel: Record<string, unknown>): { readonly constructor: { readonly type: number }; encodeToURL(dataText: string, bitOffset: number): [string, number] }[];
}

declare module "*/vendor/ratorio/engine/savedata/conf-mig-mapping.js" {
    /** Which position of a unit's run of numbers goes to which slot of which customisation list. */
    export type UpstreamCustomizationMap = Readonly<Record<string, readonly { readonly migIndex: number; readonly confIndex: number }[]>>;
    export const CHARA_CONF_BASIC_MIG_MAP: UpstreamCustomizationMap;
    export const CHARA_CONF_SPECIALIZE_PHYSICAL_MIG_MAP: UpstreamCustomizationMap;
    export const CHARA_CONF_SPECIALIZE_MAGICAL_MIG_MAP: UpstreamCustomizationMap;
    export const CHARA_CONF_SPECIALIZE_ATTACK_ANY_MIG_MAP: UpstreamCustomizationMap;
    export const CHARA_CONF_SPECIALIZE_DEFENCE_ANY_MIG_MAP: UpstreamCustomizationMap;
    export const CHARA_CONF_SKILL_MIG_MAP: UpstreamCustomizationMap;
    export const CHARA_CONF_SPEC_BASIC_MIG_MAP: UpstreamCustomizationMap;
    export function applyMigArrayToConf(map: UpstreamCustomizationMap, values: readonly number[], listOfName: Record<string, number[]>): void;
}

declare module "*/vendor/ratorio/engine/skill/autospell.dat.js" {
    /** Indexed by auto-spell ID: [ID, whether it can be set, skill ID, skill level, chance in per mille, trigger]. Entry 0 stands for "none". */
    export const AutoSpellSkill: readonly (readonly unknown[] | undefined)[];
}

declare module "*/vendor/ratorio/engine/const/EnumAutoSpellDataIndex.js" {
    export const AUTO_SPELL_DATA_INDEX_ID: number;
    export const AUTO_SPELL_DATA_INDEX_ATTACKABLE: number;
    export const AUTO_SPELL_DATA_INDEX_SKILL_ID: number;
    export const AUTO_SPELL_DATA_INDEX_SKILL_LEVEL: number;
    export const AUTO_SPELL_DATA_INDEX_PROBABLY: number;
}

declare module "*/vendor/ratorio/engine/skill/calcautospell.js" {
    /** How many auto-spells a character can set. */
    export const AUTO_SPELL_SETTING_COUNT: number;
    /** The chances the page offers, in per mille; a setting stores a position in this list. */
    export const AUTO_SPELL_PROB_ARRAY: readonly number[];
    /** Where the IDs, levels and chances of the set auto-spells start in `calcModel.autoSpell`. */
    export const OBJID_OFFSET_AS_SKILL_ID: number;
    export const OBJID_OFFSET_AS_SKILL_LV: number;
    export const OBJID_OFFSET_AS_SKILL_PROB: number;
}

declare module "*/vendor/ratorio/engine/equip/costume.dat.js" {
    /** Indexed by costume ID. Entry 0 stands for "no costume". */
    export const CostumeOBJ: readonly (readonly unknown[] | undefined)[];
}

declare module "*/vendor/ratorio/engine/const/EnumCostumeDataIndex.js" {
    export const COSTUME_DATA_INDEX_ID: number;
    export const COSTUME_DATA_INDEX_KIND: number;
    export const COSTUME_DATA_INDEX_EQPFLG: number;
    export const COSTUME_DATA_INDEX_NAME: number;
    export const COSTUME_DATA_INDEX_KANA: number;
    export const COSTUME_DATA_INDEX_DETAIL: number;
}

declare module "*/vendor/ratorio/engine/const/EnumCostumeKind.js" {
    export const COSTUME_KIND_HEAD_UNDER: number;
}

declare module "*/vendor/ratorio/engine/chara/hmjob.js" {
    /** What it costs in stat points to raise a base stat from 1 to the given value. */
    export function GetStatusTotalCost(statValue: number): number;
    /** The stat points gained on reaching the given base level. */
    export function GetEarningStatusPoint(baseLevel: number): number;
    /** The trait points a fourth job has at the given base level, all told. */
    export function GetEarningTSStatusPoint(baseLevel: number): number;
}
