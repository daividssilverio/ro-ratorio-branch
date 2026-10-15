export const equipmentSlots = [
    "rightHand",
    "leftHand",
    "headTop",
    "headMid",
    "headLow",
    "shield",
    "armor",
    "garment",
    "shoes",
    "accessory1",
    "accessory2",
    "shadowWeapon",
    "shadowShield",
    "shadowArmor",
    "shadowShoes",
    "shadowAccessory1",
    "shadowAccessory2",
] as const;

export type EquipmentSlot = (typeof equipmentSlots)[number];

/** The slots of shadow gear, which is worn over the regular gear. */
export const shadowEquipmentSlots = [
    "shadowWeapon",
    "shadowShield",
    "shadowArmor",
    "shadowShoes",
    "shadowAccessory1",
    "shadowAccessory2",
] as const satisfies readonly EquipmentSlot[];

export type ShadowEquipmentSlot = (typeof shadowEquipmentSlots)[number];

export function isShadowSlot(slot: EquipmentSlot): slot is ShadowEquipmentSlot {
    return (shadowEquipmentSlots as readonly EquipmentSlot[]).includes(slot);
}

export const socketsPerGearPiece = 4;

const socketsPerShadowGearPiece = 3;

/** How many cards and enchants a piece in the slot can hold. */
export function socketCountOfSlot(slot: EquipmentSlot): number {
    return isShadowSlot(slot) ? socketsPerShadowGearPiece : socketsPerGearPiece;
}

export const randomOptionsPerGearPiece = 5;

export const traitStatNames = ["pow", "sta", "wis", "spl", "con", "crt"] as const;

export type TraitStatName = (typeof traitStatNames)[number];

export const baseStatNames = ["str", "agi", "vit", "int", "dex", "luk"] as const;

export type BaseStatName = (typeof baseStatNames)[number];
