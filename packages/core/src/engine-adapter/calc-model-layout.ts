import type { AutoSpellLayout } from "./auto-spells.ts";
import type { CustomizationSection, NamedSettingsLayout, TargetSettingSection } from "./named-settings.ts";
import type { EquipmentSlot, TraitStatName } from "../character-vocabulary.ts";
import { choicesOf, type PanelChoice, panelDefinitions, type PositionalBuffPanel } from "../panels/panel-definitions.ts";

/** Where named things live in the positional arrays of a `RatorioCalcModel`. */
/** The calc model list each positional buff panel fills, a buff's position being its index. */
export const calcModelListOfBuffPanel = { guildBuffs: "buff4", itemBuffs: "buff7", otherBuffs: "buff8" } as const satisfies Record<PositionalBuffPanel, string>;

/**
 * The position among the other buffs that says the character is adopted.
 * Upstream has no constant for it; engine/chara/hmjob.js reads it to lower
 * the highest base stat.
 */
export const adoptedPositionAmongOtherBuffs = 13;

export interface CalcModelLayout {
    /**
     * The upstream equipment region of each slot. For regular gear it is also
     * the item's position in `calcModel.equip`; for shadow gear it indexes
     * the arrays of `calcModel.shadowEquip`.
     */
    readonly equipPositionOfSlot: Readonly<Record<EquipmentSlot, number>>;
    /** Positions in `calcModel.card` of each slot's sockets, first socket first. */
    readonly cardPositionsOfSlot: Readonly<Record<EquipmentSlot, readonly number[]>>;
    /** Position of each trait stat in `calcModel.pureStatus`. */
    readonly pureStatusPositionOfTraitStat: Readonly<Record<TraitStatName, number>>;
    /** The upstream item kinds each slot takes. */
    readonly itemKindsOfSlot: Readonly<Record<EquipmentSlot, readonly number[]>>;
    /**
     * The item upstream keeps in a slot that holds nothing: a "no equipment"
     * item for armor, bare hands for a weapon hand. An empty slot of a build
     * and one of these are the same thing.
     */
    readonly emptyItemIdOfSlot: Readonly<Record<EquipmentSlot, number>>;
    /** Where each support buff lives, by its upstream constant name without the `CONF_ID_` prefix. */
    readonly supportBuffLocations: ReadonlyMap<string, SupportBuffLocation>;
    /** What each part of the performance customisation offers, and where each setting lives. */
    readonly customizations: Readonly<Record<CustomizationSection, NamedSettingsLayout>>;
    /** What each part of the monster settings offers, and where each setting lives. */
    readonly targetSettings: Readonly<Record<TargetSettingSection, NamedSettingsLayout>>;
    /** The position in `calcModel.costume` of the one place upstream has a costume for. */
    readonly costumePositionOfLowerHeadgear: number;
    /** The auto-spells that can be set, and how they sit in `calcModel.autoSpell`. */
    readonly autoSpells: AutoSpellLayout;
}

/** One support buff or debuff as upstream offers it on its panels. */
export interface SupportBuffSetting {
    /** The buff's key in a build: its upstream constant name without the `CONF_ID_` prefix. */
    readonly name: string;
    /** Upstream's Japanese label. */
    readonly label: string;
    readonly section: SupportBuffSection;
    /** A toggle is 0 or 1; a number runs from `lowest` to `highest`. */
    readonly control: "toggle" | "number";
    readonly lowest: number;
    readonly highest: number;
    /** Upstream's own label for each value, for a buff whose values are not levels (off, normal, full…). */
    readonly choices?: readonly PanelChoice[];
}

export interface SupportBuffLayout {
    readonly locations: ReadonlyMap<string, SupportBuffLocation>;
    /** Every buff a user can set, in panel order. Placeholders upstream shows no control for are left out. */
    readonly settings: readonly SupportBuffSetting[];
}

export type SupportBuffSection = "confIchizi" | "confNizi" | "confSanzi" | "confYozi" | "confDebuff";

export interface SupportBuffLocation {
    readonly section: SupportBuffSection;
    readonly position: number;
}

export async function loadGearAndStatLayout(): Promise<Omit<CalcModelLayout, "supportBuffLocations" | "customizations" | "targetSettings" | "autoSpells" | "costumePositionOfLowerHeadgear">> {
    const equipRegionIds = await import("../../../../vendor/ratorio/engine/const/EnumEquipRegionId.js");
    const cardRegionIds = await import("../../../../vendor/ratorio/engine/runtime/common.js");
    const traitStatIds = await import("../../../../vendor/ratorio/engine/const/EnumMigItemParamId.js");
    const itemKinds: Readonly<Record<string, unknown>> = await import("../../../../vendor/ratorio/engine/const/EnumItemKind.js");
    const itemKind = (kindName: string): number => {
        const kind = itemKinds[`ITEM_KIND_${kindName}`];
        if (typeof kind !== "number") {
            throw new TypeError(`Upstream no longer defines ITEM_KIND_${kindName}`);
        }
        return kind;
    };
    const weaponKinds = weaponKindNames.map(itemKind);
    const emptyItemIds = await import("../../../../vendor/ratorio/engine/equip/item.dat.js");

    return {
        equipPositionOfSlot: {
            rightHand: equipRegionIds.EQUIP_REGION_ID_ARMS,
            leftHand: equipRegionIds.EQUIP_REGION_ID_ARMS_LEFT,
            headTop: equipRegionIds.EQUIP_REGION_ID_HEAD_TOP,
            headMid: equipRegionIds.EQUIP_REGION_ID_HEAD_MID,
            headLow: equipRegionIds.EQUIP_REGION_ID_HEAD_UNDER,
            shield: equipRegionIds.EQUIP_REGION_ID_SHIELD,
            armor: equipRegionIds.EQUIP_REGION_ID_BODY,
            garment: equipRegionIds.EQUIP_REGION_ID_SHOULDER,
            shoes: equipRegionIds.EQUIP_REGION_ID_SHOES,
            accessory1: equipRegionIds.EQUIP_REGION_ID_ACCESSORY_1,
            accessory2: equipRegionIds.EQUIP_REGION_ID_ACCESSORY_2,
            shadowWeapon: equipRegionIds.EQUIP_REGION_ID_SHADOW_ARMS_RIGHT,
            shadowShield: equipRegionIds.EQUIP_REGION_ID_SHADOW_ARMS_LEFT,
            shadowArmor: equipRegionIds.EQUIP_REGION_ID_SHADOW_BODY,
            shadowShoes: equipRegionIds.EQUIP_REGION_ID_SHADOW_FOOT,
            shadowAccessory1: equipRegionIds.EQUIP_REGION_ID_SHADOW_ACCESSORY_1,
            shadowAccessory2: equipRegionIds.EQUIP_REGION_ID_SHADOW_ACCESSORY_2,
        },
        cardPositionsOfSlot: {
            rightHand: [
                cardRegionIds.CARD_REGION_ID_ARMS_RIGHT_1,
                cardRegionIds.CARD_REGION_ID_ARMS_RIGHT_2,
                cardRegionIds.CARD_REGION_ID_ARMS_RIGHT_3,
                cardRegionIds.CARD_REGION_ID_ARMS_RIGHT_4,
            ],
            leftHand: [
                cardRegionIds.CARD_REGION_ID_ARMS_LEFT_1,
                cardRegionIds.CARD_REGION_ID_ARMS_LEFT_2,
                cardRegionIds.CARD_REGION_ID_ARMS_LEFT_3,
                cardRegionIds.CARD_REGION_ID_ARMS_LEFT_4,
            ],
            headTop: [
                cardRegionIds.CARD_REGION_ID_HEAD_TOP,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_TOP_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_TOP_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_TOP_3,
            ],
            headMid: [
                cardRegionIds.CARD_REGION_ID_HEAD_MID,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_MID_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_MID_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_MID_3,
            ],
            headLow: [
                cardRegionIds.CARD_REGION_ID_HEAD_UNDER,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_UNDER_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_UNDER_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_HEAD_UNDER_3,
            ],
            shield: [
                cardRegionIds.CARD_REGION_ID_SHIELD,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHIELD_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHIELD_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHIELD_3,
            ],
            armor: [
                cardRegionIds.CARD_REGION_ID_BODY,
                cardRegionIds.CARD_REGION_ID_ENCHANT_BODY_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_BODY_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_BODY_3,
            ],
            garment: [
                cardRegionIds.CARD_REGION_ID_SHOULDER,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHOULDER_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHOULDER_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHOULDER_3,
            ],
            shoes: [
                cardRegionIds.CARD_REGION_ID_SHOES,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHOES_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHOES_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_SHOES_3,
            ],
            accessory1: [
                cardRegionIds.CARD_REGION_ID_ACCESSORY_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_ACCESSORY_1_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_ACCESSORY_1_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_ACCESSORY_1_3,
            ],
            accessory2: [
                cardRegionIds.CARD_REGION_ID_ACCESSORY_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_ACCESSORY_2_1,
                cardRegionIds.CARD_REGION_ID_ENCHANT_ACCESSORY_2_2,
                cardRegionIds.CARD_REGION_ID_ENCHANT_ACCESSORY_2_3,
            ],
            shadowWeapon: [
                cardRegionIds.CARD_REGION_ID_SHADOW_ARMS_RIGHT_1,
                cardRegionIds.CARD_REGION_ID_SHADOW_ARMS_RIGHT_2,
                cardRegionIds.CARD_REGION_ID_SHADOW_ARMS_RIGHT_3,
            ],
            shadowShield: [
                cardRegionIds.CARD_REGION_ID_SHADOW_SHIELD_1,
                cardRegionIds.CARD_REGION_ID_SHADOW_SHIELD_2,
                cardRegionIds.CARD_REGION_ID_SHADOW_SHIELD_3,
            ],
            shadowArmor: [
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_BODY_1,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_BODY_2,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_BODY_3,
            ],
            shadowShoes: [
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_SHOES_1,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_SHOES_2,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_SHOES_3,
            ],
            shadowAccessory1: [
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY1_1,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY1_2,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY1_3,
            ],
            shadowAccessory2: [
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY2_1,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY2_2,
                cardRegionIds.CARD_REGION_ID_SHADOW_ENCHANT_ACCESSORY2_3,
            ],
        },
        itemKindsOfSlot: {
            rightHand: weaponKinds,
            leftHand: leftHandWeaponKindNames.map(itemKind),
            headTop: [itemKind("HEAD_TOP")],
            headMid: [itemKind("HEAD_MID")],
            headLow: [itemKind("HEAD_UNDER")],
            shield: [itemKind("SHIELD")],
            armor: [itemKind("BODY")],
            garment: [itemKind("SHOULDER")],
            shoes: [itemKind("FOOT")],
            accessory1: [itemKind("ACCESSORY"), itemKind("ACCESSORY_ON1")],
            accessory2: [itemKind("ACCESSORY"), itemKind("ACCESSORY_ON2")],
            shadowWeapon: [itemKind("SHADOW_ARMS_RIGHT")],
            shadowShield: [itemKind("SHADOW_ARMS_LEFT")],
            shadowArmor: [itemKind("SHADOW_BODY")],
            shadowShoes: [itemKind("SHADOW_FOOT")],
            shadowAccessory1: [itemKind("SHADOW_ACCESSORY_ON1")],
            shadowAccessory2: [itemKind("SHADOW_ACCESSORY_ON2")],
        },
        emptyItemIdOfSlot: {
            rightHand: emptyItemIds.ITEM_ID_SUDE,
            leftHand: emptyItemIds.ITEM_ID_SUDE,
            headTop: emptyItemIds.ITEM_ID_NOEQUIP_HEAD_TOP,
            headMid: emptyItemIds.ITEM_ID_NOEQUIP_HEAD_MID,
            headLow: emptyItemIds.ITEM_ID_NOEQUIP_HEAD_UNDER,
            shield: emptyItemIds.ITEM_ID_NOEQUIP_SHIELD,
            armor: emptyItemIds.ITEM_ID_NOEQUIP_BODY,
            garment: emptyItemIds.ITEM_ID_NOEQUIP_SHOULDER,
            shoes: emptyItemIds.ITEM_ID_NOEQUIP_SHOES,
            accessory1: emptyItemIds.ITEM_ID_NOEQUIP_ACCESSORY,
            accessory2: emptyItemIds.ITEM_ID_NOEQUIP_ACCESSORY,
            // Shadow gear has no stand-in item; its empty slot is 0, the same ID as bare hands.
            shadowWeapon: emptyItemIds.ITEM_ID_SUDE,
            shadowShield: emptyItemIds.ITEM_ID_SUDE,
            shadowArmor: emptyItemIds.ITEM_ID_SUDE,
            shadowShoes: emptyItemIds.ITEM_ID_SUDE,
            shadowAccessory1: emptyItemIds.ITEM_ID_SUDE,
            shadowAccessory2: emptyItemIds.ITEM_ID_SUDE,
        },
        pureStatusPositionOfTraitStat: {
            pow: traitStatIds.MIG_PARAM_ID_POW,
            sta: traitStatIds.MIG_PARAM_ID_STA,
            wis: traitStatIds.MIG_PARAM_ID_WIS,
            spl: traitStatIds.MIG_PARAM_ID_SPL,
            con: traitStatIds.MIG_PARAM_ID_CON,
            crt: traitStatIds.MIG_PARAM_ID_CRT,
        },
    };
}

/** The one-handed kinds upstream ever offers a left hand; which of them a job gets is `catalog.leftHandItemKindsOfJob()`. */
const leftHandWeaponKindNames = ["KNIFE", "SWORD", "AXE"];

const weaponKindNames = [
    "KNIFE",
    "SWORD",
    "SWORD_2HAND",
    "SPEAR",
    "SPEAR_2HAND",
    "AXE",
    "AXE_2HAND",
    "CLUB",
    "STUFF",
    "BOW",
    "KATAR",
    "BOOK",
    "FIST",
    "MUSICAL",
    "WHIP",
    "FUMA",
    "HANDGUN",
    "RIFLE",
    "SHOTGUN",
    "GATLINGGUN",
    "GRENADEGUN",
    "STUFF2HAND",
];

const slotIdNamePrefix = "CONF_ID_";
const placeholderSlotIdName = "CONF_ID_DUMMY";

// Upstream assigns the CONF_ID_* slot numbers of these five settings classes
// inside their constructors, and only the page constructs them. Until one
// instance of each exists, every status total the engine computes is NaN.
// The construction can go when docs/upstream/support-buff-slot-ids.md lands
// upstream; reading the slot numbers stays.
export async function assignAndReadSupportBuffSlotIds(): Promise<SupportBuffLayout> {
    const { CConfBase } = await import("../../../../vendor/ratorio/engine/ui/CConfBase.js");
    const controlTypes = await import("../../../../vendor/ratorio/engine/const/EnumControlType.js");
    const toggleControlTypes = [controlTypes.CONTROL_TYPE_CHECKBOX, controlTypes.CONTROL_TYPE_CHECKBOX_SPECIAL];
    const numberControlTypes = [
        controlTypes.CONTROL_TYPE_SELECTBOX_NUMBER,
        controlTypes.CONTROL_TYPE_SELECTBOX_PERCENT,
        controlTypes.CONTROL_TYPE_TEXTBOX_NUMBER,
    ];
    const settings: SupportBuffSetting[] = [];
    const { CCharaConfIchizi } = await import("../../../../vendor/ratorio/engine/chara/CCharaConfIchizi.js");
    const { CCharaConfNizi } = await import("../../../../vendor/ratorio/engine/chara/CCharaConfNizi.js");
    const { CCharaConfSanzi } = await import("../../../../vendor/ratorio/engine/chara/CCharaConfSanzi.js");
    const { CCharaConfYozi } = await import("../../../../vendor/ratorio/engine/chara/CCharaConfYozi.js");
    const { CCharaConfDebuff } = await import("../../../../vendor/ratorio/engine/chara/CCharaConfDebuff.js");

    const settingsClassOfSection = {
        confIchizi: CCharaConfIchizi,
        confNizi: CCharaConfNizi,
        confSanzi: CCharaConfSanzi,
        confYozi: CCharaConfYozi,
        confDebuff: CCharaConfDebuff,
    } satisfies Record<SupportBuffSection, unknown>;

    const supportBuffLocations = new Map<string, SupportBuffLocation>();
    for (const [section, SupportBuffSettings] of Object.entries(settingsClassOfSection) as [SupportBuffSection, (typeof settingsClassOfSection)[SupportBuffSection]][]) {
        const { confDataObj } = new SupportBuffSettings([]);
        const dataPosition = (constantName: string): number => {
            const position = CConfBase[constantName];
            if (typeof position !== "number") {
                throw new TypeError(`Upstream no longer defines CConfBase.${constantName}`);
            }
            return position;
        };
        const idPosition = dataPosition("CONF_DATA_INDEX_ID");
        const textPosition = dataPosition("CONF_DATA_INDEX_TEXT");
        const controlTypePosition = dataPosition("CONF_DATA_INDEX_CONTROL_TYPE");
        const lowestPosition = dataPosition("CONF_DATA_INDEX_MIN_VALUE");
        const highestPosition = dataPosition("CONF_DATA_INDEX_MAX_VALUE");
        const nameOfPosition = new Map<number, string>();
        for (const [staticName, position] of Object.entries(SupportBuffSettings)) {
            if (staticName.startsWith(slotIdNamePrefix) && staticName !== placeholderSlotIdName && typeof position === "number") {
                nameOfPosition.set(position, staticName.slice(slotIdNamePrefix.length));
            }
        }
        for (const dataRow of confDataObj) {
            const name = nameOfPosition.get(dataRow[idPosition] as number);
            const label = dataRow[textPosition];
            const controlType = dataRow[controlTypePosition] as number;
            if (name === undefined || typeof label !== "string") {
                continue;
            }
            if (toggleControlTypes.includes(controlType)) {
                settings.push({ name, label, section, control: "toggle", lowest: 0, highest: 1 });
            } else if (controlType === controlTypes.CONTROL_TYPE_SELECTBOX_SPECIAL) {
                const lowest = dataRow[lowestPosition];
                const highest = dataRow[highestPosition];
                if (typeof lowest === "number" && typeof highest === "number") {
                    const definition = panelDefinitions.supportBuffChoices[name];
                    const choices = definition === undefined ? undefined : choicesOf(definition);
                    settings.push({ name, label, section, control: "number", lowest, highest, ...(choices === undefined ? {} : { choices }) });
                }
            } else if (numberControlTypes.includes(controlType)) {
                const lowest = dataRow[lowestPosition];
                const highest = dataRow[highestPosition];
                if (typeof lowest === "number" && typeof highest === "number") {
                    settings.push({ name, label, section, control: "number", lowest, highest });
                }
            }
        }
        for (const [staticName, position] of Object.entries(SupportBuffSettings)) {
            if (
                staticName.startsWith(slotIdNamePrefix) &&
                staticName !== placeholderSlotIdName &&
                typeof position === "number"
            ) {
                supportBuffLocations.set(staticName.slice(slotIdNamePrefix.length), { section, position });
            }
        }
    }
    return { locations: supportBuffLocations, settings };
}
