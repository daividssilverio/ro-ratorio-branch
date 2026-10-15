import type { CharacterSection, EquipmentSlot, RankingMetric } from "@ro-ratorio-branch/core/platform-neutral";
import type { Descriptions } from "../engine-host/host-protocol.ts";
import { t } from "./text/ui-text.ts";

export const rootLabel = t("現在の装備");

export const slotLabels: Readonly<Record<EquipmentSlot, string>> = {
    rightHand: t("武器"),
    leftHand: t("左手"),
    headTop: t("頭上段"),
    headMid: t("頭中段"),
    headLow: t("頭下段"),
    shield: t("盾"),
    armor: t("鎧"),
    garment: t("肩"),
    shoes: t("靴"),
    accessory1: t("アクセ1"),
    accessory2: t("アクセ2"),
    shadowWeapon: t("シャドウ 武器"),
    shadowShield: t("シャドウ 盾"),
    shadowArmor: t("シャドウ 鎧"),
    shadowShoes: t("シャドウ 靴"),
    shadowAccessory1: t("シャドウ アクセ1"),
    shadowAccessory2: t("シャドウ アクセ2"),
};

/** One character that stands for the slot where the app has no picture to show: the same in both menu languages. */
export const slotGlyphs: Readonly<Record<EquipmentSlot, string>> = {
    rightHand: "武",
    leftHand: "左",
    headTop: "頭",
    headMid: "頭",
    headLow: "頭",
    shield: "盾",
    armor: "鎧",
    garment: "肩",
    shoes: "靴",
    accessory1: "飾",
    accessory2: "飾",
    shadowWeapon: "影",
    shadowShield: "影",
    shadowArmor: "影",
    shadowShoes: "影",
    shadowAccessory1: "影",
    shadowAccessory2: "影",
};

export const sectionLabels: Readonly<Record<CharacterSection, string>> = {
    level: t("レベル"),
    baseStats: t("ステータス"),
    traitStats: t("特性"),
    learnedSkills: t("習得スキル"),
    selfBuffs: t("自己支援"),
    supportBuffs: t("支援"),
    guildBuffs: t("ギルド"),
    itemBuffs: t("食品"),
    otherBuffs: t("その他"),
    customization: t("カスタム"),
    timedItems: t("時限効果"),
    autoSpells: "AS",
    consumablesAndWeapon: t("武器 · 薬"),
};

export const metricLabels: Readonly<Record<RankingMetric, string>> = {
    damagePerSecondGain: t("DPS 上昇"),
    secondsToKill: t("討伐時間"),
    valueForMoney: "DPS / M z",
    cumulativeZenyCost: t("コスト"),
};

/** One label for the slots a piece fits: both hands read as a weapon, both accessory slots as an accessory. */
export function slotsLabel(slots: readonly EquipmentSlot[]): string | undefined {
    if (slots.includes("accessory1") && slots.includes("accessory2")) {
        return t("アクセ");
    }
    const firstSlot = slots[0];
    return firstSlot === undefined ? undefined : slotLabels[firstSlot];
}

/** An item's upstream name, or its ID when the engine has no name for it. */
export function itemNameIn(descriptions: Descriptions, itemId: number): string {
    return descriptions.items[itemId]?.name ?? `#${itemId}`;
}

/** A random option as upstream writes it: the effect's name, then the rolled value. */
export function randomOptionTextIn(descriptions: Descriptions, randomOption: { readonly optionId: number; readonly value: number }): string {
    return `${descriptions.randomOptionNames[randomOption.optionId] ?? `option #${randomOption.optionId}`} ${randomOption.value}`;
}

export function cardOrEnchantNameIn(descriptions: Descriptions, cardOrEnchantId: number): string {
    return descriptions.cardsOrEnchants[cardOrEnchantId]?.name ?? `#${cardOrEnchantId}`;
}
