import {
    type BaseStatName,
    baseStatNames,
    type EquipmentSlot,
    equipmentSlots,
    isShadowSlot,
    type TraitStatName,
    traitStatNames,
} from "../character-vocabulary.ts";
import { adoptedPositionAmongOtherBuffs, calcModelListOfBuffPanel } from "../engine-adapter/calc-model-layout.ts";
import type { AttackSource } from "../engine-adapter/attack-methods.ts";
import {
    calcModelListOfCustomizationSection,
    calcModelListOfTargetSettingSection,
    type CustomizationSection,
    customizationSections,
    isOfferedBySetting,
    type TargetSettingSection,
    targetSettingSections,
} from "../engine-adapter/named-settings.ts";
import type { RatorioCalcModel, RefinableArmorRegion } from "../engine-adapter/ratorio-calc-model.ts";
import { type RandomOptionsOfSlot, type RandomOptionValue, type RatorioEngine, UnknownJobError } from "../engine-adapter/ratorio-engine.ts";
import { isOfferedBy, panelDefinitions, type PositionalBuffPanel, positionalBuffPanels } from "../panels/panel-definitions.ts";
import type { Build, Character, Equipment, GearPiece } from "./build-format.ts";

/** One reason a well-formed build cannot be calculated by the engine. */
export type BuildConversionIssue =
    | { readonly kind: "unknownJob"; readonly jobId: number }
    | { readonly kind: "baseLevelOutOfRange"; readonly baseLevel: number }
    | { readonly kind: "jobLevelOutOfRange"; readonly jobLevel: number }
    | { readonly kind: "baseStatOutOfRange"; readonly stat: BaseStatName; readonly value: number }
    /** Also for any trait stat on a job that has none. */
    | { readonly kind: "traitStatOutOfRange"; readonly stat: TraitStatName; readonly value: number }
    | { readonly kind: "unknownItem"; readonly slot: EquipmentSlot; readonly itemId: number }
    | { readonly kind: "itemDoesNotFitSlot"; readonly slot: EquipmentSlot; readonly itemId: number }
    | { readonly kind: "itemNotEquippableByJob"; readonly slot: EquipmentSlot; readonly itemId: number }
    /** The job holds no weapon, or none of that kind, in its left hand. */
    | { readonly kind: "leftHandNotOfferedToJob"; readonly itemId: number }
    /** The job's right-hand weapon leaves it no second hand. */
    | { readonly kind: "leftHandNotOfferedWithRightHand"; readonly rightHandItemId: number }
    /** A left-hand weapon and a shield are worn together. */
    | { readonly kind: "shieldWithLeftHandWeapon" }
    | {
          readonly kind: "unknownCardOrEnchant";
          readonly slot: EquipmentSlot;
          readonly socket: number;
          readonly cardOrEnchantId: number;
      }
    /** The item does not take that card or enchant in that socket. 1 is the first socket. */
    | { readonly kind: "cardOrEnchantNotOfferedForItem"; readonly slot: EquipmentSlot; readonly socket: number; readonly cardOrEnchantId: number }
    | { readonly kind: "unknownRandomOption"; readonly slot: EquipmentSlot; readonly optionId: number }
    /** The item does not roll that option at that position. 1 is the first position. */
    | { readonly kind: "randomOptionNotOfferedForItem"; readonly slot: EquipmentSlot; readonly position: number; readonly optionId: number }
    | { readonly kind: "randomOptionValueOutOfRange"; readonly slot: EquipmentSlot; readonly position: number; readonly optionId: number; readonly value: number }
    | { readonly kind: "unknownTimedItem"; readonly timedItemId: number }
    /** The engine has the timed item, but the original does not list it. */
    | { readonly kind: "timedItemNotOffered"; readonly timedItemId: number }
    | { readonly kind: "unknownSpeedPotion"; readonly speedPotion: number }
    | { readonly kind: "unknownWeaponElement"; readonly elementId: number }
    | { readonly kind: "unknownArrow"; readonly arrowId: number }
    | { readonly kind: "refineNotSupported"; readonly slot: EquipmentSlot }
    | { readonly kind: "refineOutOfRange"; readonly slot: EquipmentSlot; readonly refine: number }
    | { readonly kind: "transcendenceOutOfRange"; readonly slot: EquipmentSlot; readonly transcendence: number }
    | { readonly kind: "transcendenceNotSupported"; readonly slot: EquipmentSlot }
    | { readonly kind: "skillNotLearnableByJob"; readonly skillId: number }
    | { readonly kind: "selfBuffNotAvailableForJob"; readonly skillId: number }
    | { readonly kind: "unknownSupportBuff"; readonly name: string }
    | { readonly kind: "costumeNotOfferedToJob"; readonly costumeId: number }
    | { readonly kind: "unknownAutoSpell"; readonly autoSpellId: number }
    | { readonly kind: "autoSpellChanceNotOffered"; readonly autoSpellId: number; readonly chancePerMille: number }
    | { readonly kind: "unknownCustomization"; readonly section: CustomizationSection; readonly name: string }
    | { readonly kind: "customizationValueNotOffered"; readonly section: CustomizationSection; readonly name: string; readonly value: number }
    | { readonly kind: "unknownTargetSetting"; readonly section: TargetSettingSection; readonly name: string }
    | { readonly kind: "targetSettingValueNotOffered"; readonly section: TargetSettingSection; readonly name: string; readonly value: number }
    | { readonly kind: "unknownPanelBuff"; readonly panel: PositionalBuffPanel; readonly position: number }
    | { readonly kind: "panelBuffValueNotOffered"; readonly panel: PositionalBuffPanel; readonly position: number; readonly value: number }
    | { readonly kind: "unknownTargetMonster"; readonly monsterId: number }
    /** The character, as built, has no such attack from that source. Reported when the build is calculated. */
    | { readonly kind: "attackNotOffered"; readonly skillId: number; readonly source: AttackSource }
    | { readonly kind: "attackLevelNotOffered"; readonly skillId: number; readonly level: number }
    /** The attack does not take that value for that option. 1 is the first option after the level. */
    | { readonly kind: "attackOptionNotOffered"; readonly skillId: number; readonly position: number; readonly value: number };

export class BuildConversionError extends Error {
    readonly issues: readonly BuildConversionIssue[];

    constructor(issues: readonly BuildConversionIssue[]) {
        super(`The build cannot be calculated: ${issues.map((issue) => issue.kind).join(", ")}`);
        this.name = "BuildConversionError";
        this.issues = issues;
    }
}

const armorRegionOfSlot: Partial<Record<EquipmentSlot, RefinableArmorRegion>> = {
    headTop: "head",
    shield: "shield",
    armor: "body",
    garment: "shoulder",
    shoes: "shoes",
};

/**
 * The random options on each worn piece. The engine keeps them outside its
 * model, so they travel next to it.
 */
export function randomOptionsOfSlot(equipment: Equipment): RandomOptionsOfSlot {
    const optionsOfSlot: Partial<Record<EquipmentSlot, readonly (RandomOptionValue | null)[]>> = {};
    for (const [slot, gearPiece] of Object.entries(equipment) as [EquipmentSlot, GearPiece][]) {
        if (gearPiece.randomOptions !== undefined && gearPiece.randomOptions.some((randomOption) => randomOption !== null)) {
            optionsOfSlot[slot] = gearPiece.randomOptions.map((randomOption) => (randomOption === null ? null : { optionId: randomOption.optionId, value: randomOption.value }));
        }
    }
    return optionsOfSlot;
}

/** Whether the engine takes a refine level for gear in the slot. */
export function slotTakesRefine(slot: EquipmentSlot): boolean {
    return slotTakesTranscendence(slot) || isShadowSlot(slot);
}

/** Whether the engine takes a transcendence stage for gear in the slot. Shadow gear is refined but not transcended. */
export function slotTakesTranscendence(slot: EquipmentSlot): boolean {
    return slot === "rightHand" || slot === "leftHand" || armorRegionOfSlot[slot] !== undefined;
}

/**
 * Turns a build into the engine's input. The target monster is not part of
 * that input; pass `build.scenario.targetMonsterId` to the calculation.
 * @throws {BuildConversionError} listing everything the engine cannot take.
 */
export function convertBuildToCalcModel(build: Build, engine: RatorioEngine): RatorioCalcModel {
    const { character, scenario } = build;
    const calcModel = createBaselineCalcModelOrReportJob(engine, character.jobId);
    const issues: BuildConversionIssue[] = [];
    const layout = engine.calcModelLayout;

    calcModel.status = {
        jobId: character.jobId,
        baseLv: character.baseLevel,
        jobLv: character.jobLevel,
        str: character.baseStats.str,
        agi: character.baseStats.agi,
        vit: character.baseStats.vit,
        dex: character.baseStats.dex,
        int: character.baseStats.int,
        luk: character.baseStats.luk,
        speedPot: character.speedPotion ?? 0,
    };
    for (const traitStatName of traitStatNames) {
        calcModel.pureStatus[layout.pureStatusPositionOfTraitStat[traitStatName]] =
            character.traitStats?.[traitStatName] ?? 0;
    }
    issues.push(...levelAndStatIssuesOf(character, engine));

    for (const slot of equipmentSlots) {
        const gearPiece = character.equipment[slot];
        if (gearPiece !== undefined) {
            issues.push(...equipGearPiece(calcModel, engine, character.jobId, slot, gearPiece));
        }
    }
    issues.push(...leftHandIssuesOf(character, engine));

    const { learnedSkillIds, passiveSkillIds } = engine.skillSlotsOfJob(character.jobId);
    for (const [skillIdKey, level] of Object.entries(character.learnedSkills ?? {})) {
        const skillId = Number(skillIdKey);
        const position = learnedSkillIds.indexOf(skillId);
        if (position < 0) {
            issues.push({ kind: "skillNotLearnableByJob", skillId });
        } else {
            calcModel.learnedSkill[position] = level;
        }
    }
    for (const [skillIdKey, level] of Object.entries(character.selfBuffs ?? {})) {
        const skillId = Number(skillIdKey);
        const position = passiveSkillIds.indexOf(skillId);
        if (position < 0) {
            issues.push({ kind: "selfBuffNotAvailableForJob", skillId });
        } else {
            calcModel.passiveSkill[position] = level;
        }
    }
    for (const [name, value] of Object.entries(character.supportBuffs ?? {})) {
        const location = layout.supportBuffLocations.get(name);
        if (location === undefined) {
            issues.push({ kind: "unknownSupportBuff", name });
        } else {
            calcModel[location.section][location.position] = value;
        }
    }
    if (character.costumeId !== undefined && character.costumeId !== 0) {
        if (engine.catalog.costumesOfJob(character.jobId).some((costume) => costume.id === character.costumeId)) {
            calcModel.costume[layout.costumePositionOfLowerHeadgear] = character.costumeId;
        } else {
            issues.push({ kind: "costumeNotOfferedToJob", costumeId: character.costumeId });
        }
    }
    if (character.autoSpells !== undefined) {
        const offeredIds = new Set(layout.autoSpells.entries.map((entry) => entry.id));
        for (const { autoSpellId, chancePerMille } of character.autoSpells) {
            if (!offeredIds.has(autoSpellId)) {
                issues.push({ kind: "unknownAutoSpell", autoSpellId });
            } else if (!layout.autoSpells.chancesPerMille.includes(chancePerMille)) {
                issues.push({ kind: "autoSpellChanceNotOffered", autoSpellId, chancePerMille });
            }
        }
        calcModel.autoSpell = layout.autoSpells.toCalcModelList(character.autoSpells.map((autoSpell) => ({ autoSpellId: autoSpell.autoSpellId, level: autoSpell.level ?? 0, chancePerMille: autoSpell.chancePerMille })));
    }
    for (const section of customizationSections) {
        const { settings, positionOfName } = layout.customizations[section];
        for (const [name, value] of Object.entries(character.customization?.[section] ?? {})) {
            const position = positionOfName.get(name);
            const setting = settings.find((candidate) => candidate.name === name);
            if (position === undefined || setting === undefined) {
                issues.push({ kind: "unknownCustomization", section, name });
            } else if (!isOfferedBySetting(setting, value)) {
                issues.push({ kind: "customizationValueNotOffered", section, name, value });
            } else {
                calcModel[calcModelListOfCustomizationSection[section]][position] = value;
            }
        }
    }
    for (const section of targetSettingSections) {
        const { settings, positionOfName } = layout.targetSettings[section];
        for (const [name, value] of Object.entries(scenario.targetSettings?.[section] ?? {})) {
            const position = positionOfName.get(name);
            const setting = settings.find((candidate) => candidate.name === name);
            if (position === undefined || setting === undefined) {
                issues.push({ kind: "unknownTargetSetting", section, name });
            } else if (!isOfferedBySetting(setting, value)) {
                issues.push({ kind: "targetSettingValueNotOffered", section, name, value });
            } else {
                calcModel[calcModelListOfTargetSettingSection[section]][position] = value;
            }
        }
    }
    for (const panel of positionalBuffPanels) {
        for (const [positionKey, value] of Object.entries(character[panel] ?? {})) {
            const position = Number(positionKey);
            const definition = panelDefinitions[panel][positionKey];
            if (definition === undefined) {
                issues.push({ kind: "unknownPanelBuff", panel, position });
            } else if (!isOfferedBy(definition, value)) {
                issues.push({ kind: "panelBuffValueNotOffered", panel, position, value });
            } else {
                calcModel[calcModelListOfBuffPanel[panel]][position] = value;
            }
        }
    }
    const weaponElement = weaponElementOf(character);
    if (weaponElement !== 0) {
        if (engine.hasElement(weaponElement)) {
            calcModel.weapon.zokusei = weaponElement;
        } else {
            issues.push({ kind: "unknownWeaponElement", elementId: weaponElement });
        }
    }
    if (character.arrowId !== undefined && character.arrowId !== 0) {
        if (engine.hasArrow(character.arrowId)) {
            calcModel.arrow = character.arrowId;
        } else {
            issues.push({ kind: "unknownArrow", arrowId: character.arrowId });
        }
    }
    if (character.speedPotion !== undefined && character.speedPotion !== 0 && !engine.hasSpeedPotion(character.speedPotion)) {
        issues.push({ kind: "unknownSpeedPotion", speedPotion: character.speedPotion });
    }
    const offeredTimedItemIds = character.timedItems === undefined ? new Set<number>() : new Set(engine.catalog.timedItems().map((timedItem) => timedItem.id));
    (character.timedItems ?? []).forEach((timedItemId, position) => {
        if (!engine.hasTimedItem(timedItemId)) {
            issues.push({ kind: "unknownTimedItem", timedItemId });
        } else if (!offeredTimedItemIds.has(timedItemId)) {
            issues.push({ kind: "timedItemNotOffered", timedItemId });
        }
        calcModel.timeItemConf[position] = timedItemId;
    });

    if (!engine.hasMonster(scenario.targetMonsterId)) {
        issues.push({ kind: "unknownTargetMonster", monsterId: scenario.targetMonsterId });
    }
    calcModel.attackMethod = {
        ...calcModel.attackMethod,
        skillId: scenario.skillId,
        sourceType: engine.attackSourceTypes[scenario.skillSource ?? "job"],
        skillLv: scenario.skillLevel,
        optionValueArray: [...(scenario.skillOptions ?? [])],
    };

    if (issues.length > 0) {
        throw new BuildConversionError(issues);
    }
    return calcModel;
}

function createBaselineCalcModelOrReportJob(engine: RatorioEngine, jobId: number): RatorioCalcModel {
    try {
        return engine.createBaselineCalcModel(jobId);
    } catch (error) {
        if (error instanceof UnknownJobError) {
            throw new BuildConversionError([{ kind: "unknownJob", jobId }]);
        }
        throw error;
    }
}

/** What the original's level and stat controls would not let this character have. */
function leftHandIssuesOf(character: Build["character"], engine: RatorioEngine): BuildConversionIssue[] {
    const { leftHand, rightHand, shield } = character.equipment;
    if (leftHand === undefined || !engine.hasItem(leftHand.itemId)) {
        return [];
    }
    const issues: BuildConversionIssue[] = [];
    const leftHandKind = engine.itemKind(leftHand.itemId);
    if (!engine.catalog.leftHandItemKindsOfJob(character.jobId).includes(leftHandKind)) {
        issues.push({ kind: "leftHandNotOfferedToJob", itemId: leftHand.itemId });
    } else if (rightHand !== undefined && !engine.catalog.leftHandItemKindsOfJob(character.jobId, rightHand.itemId).includes(leftHandKind)) {
        issues.push({ kind: "leftHandNotOfferedWithRightHand", rightHandItemId: rightHand.itemId });
    }
    if (shield !== undefined) {
        issues.push({ kind: "shieldWithLeftHandWeapon" });
    }
    return issues;
}

/** Whether the character is set as adopted, which lowers the highest base stat. */
export function isAdopted(character: Pick<Build["character"], "otherBuffs">): boolean {
    return (character.otherBuffs?.[String(adoptedPositionAmongOtherBuffs)] ?? 0) !== 0;
}

function levelAndStatIssuesOf(character: Build["character"], engine: RatorioEngine): BuildConversionIssue[] {
    const limits = engine.catalog.limitsOfJob(character.jobId, isAdopted(character));
    if (limits === undefined) {
        return [];
    }
    const isOutside = (value: number, range: { readonly lowest: number; readonly highest: number }) => value < range.lowest || value > range.highest;
    const issues: BuildConversionIssue[] = [];
    if (isOutside(character.baseLevel, limits.baseLevel)) {
        issues.push({ kind: "baseLevelOutOfRange", baseLevel: character.baseLevel });
    }
    if (isOutside(character.jobLevel, limits.jobLevel)) {
        issues.push({ kind: "jobLevelOutOfRange", jobLevel: character.jobLevel });
    }
    for (const stat of baseStatNames) {
        if (isOutside(character.baseStats[stat], limits.baseStat)) {
            issues.push({ kind: "baseStatOutOfRange", stat, value: character.baseStats[stat] });
        }
    }
    for (const stat of traitStatNames) {
        const value = character.traitStats?.[stat] ?? 0;
        if (limits.traitStat === null ? value !== 0 : isOutside(value, limits.traitStat)) {
            issues.push({ kind: "traitStatOutOfRange", stat, value });
        }
    }
    return issues;
}

function equipGearPiece(
    calcModel: RatorioCalcModel,
    engine: RatorioEngine,
    jobId: number,
    slot: EquipmentSlot,
    gearPiece: GearPiece,
): BuildConversionIssue[] {
    const issues: BuildConversionIssue[] = [];
    const layout = engine.calcModelLayout;
    const refine = gearPiece.refine ?? 0;
    const transcendence = gearPiece.transcendence ?? 0;

    if (!engine.hasItem(gearPiece.itemId)) {
        issues.push({ kind: "unknownItem", slot, itemId: gearPiece.itemId });
    } else if (!layout.itemKindsOfSlot[slot].includes(engine.itemKind(gearPiece.itemId))) {
        issues.push({ kind: "itemDoesNotFitSlot", slot, itemId: gearPiece.itemId });
    } else if (!engine.canJobEquipItem(jobId, gearPiece.itemId)) {
        issues.push({ kind: "itemNotEquippableByJob", slot, itemId: gearPiece.itemId });
    } else if (isShadowSlot(slot)) {
        calcModel.shadowEquip.itemId[layout.equipPositionOfSlot[slot]] = gearPiece.itemId;
    } else {
        calcModel.equip[layout.equipPositionOfSlot[slot]] = gearPiece.itemId;
    }

    if (refine > panelDefinitions.gearLimits.highestRefine) {
        issues.push({ kind: "refineOutOfRange", slot, refine });
    }
    if (transcendence > panelDefinitions.gearLimits.highestTranscendence) {
        issues.push({ kind: "transcendenceOutOfRange", slot, transcendence });
    }

    const armorRegion = armorRegionOfSlot[slot];
    if (isShadowSlot(slot)) {
        calcModel.shadowEquip.refined[layout.equipPositionOfSlot[slot]] = refine;
        if (transcendence !== 0) {
            issues.push({ kind: "transcendenceNotSupported", slot });
        }
    } else if (slot === "rightHand") {
        calcModel.weapon.type = engine.itemKind(gearPiece.itemId);
        calcModel.weapon.atkPlus = refine;
        calcModel.weapon.transcendence = transcendence;
    } else if (slot === "leftHand") {
        calcModel.weapon.weapon2Type = engine.itemKind(gearPiece.itemId);
        calcModel.weapon.weapon2AtkPlus = refine;
        calcModel.weapon.weapon2Transcendence = transcendence;
    } else if (armorRegion !== undefined) {
        calcModel.defPlus[armorRegion] = refine;
        calcModel.defTranscendence[armorRegion] = transcendence;
    } else {
        if (refine !== 0) {
            issues.push({ kind: "refineNotSupported", slot });
        }
        if (transcendence !== 0) {
            issues.push({ kind: "transcendenceNotSupported", slot });
        }
    }

    const choicesOfSocket = gearPiece.sockets === undefined ? [] : engine.catalog.socketChoicesOfItem(slot, gearPiece.itemId);
    (gearPiece.sockets ?? []).forEach((cardOrEnchantId, socketIndex) => {
        const cardPosition = layout.cardPositionsOfSlot[slot][socketIndex];
        if (cardOrEnchantId === null || cardPosition === undefined) {
            return;
        }
        if (!engine.hasCardOrEnchant(cardOrEnchantId)) {
            issues.push({ kind: "unknownCardOrEnchant", slot, socket: socketIndex + 1, cardOrEnchantId });
        } else if (!(choicesOfSocket[socketIndex] ?? []).some((choice) => choice.id === cardOrEnchantId)) {
            issues.push({ kind: "cardOrEnchantNotOfferedForItem", slot, socket: socketIndex + 1, cardOrEnchantId });
        } else {
            calcModel.card[cardPosition] = cardOrEnchantId;
        }
    });

    const offeredAtPosition = gearPiece.randomOptions === undefined ? [] : engine.catalog.randomOptionsOfItem(gearPiece.itemId);
    (gearPiece.randomOptions ?? []).forEach((randomOption, positionIndex) => {
        if (randomOption === null) {
            return;
        }
        const { optionId, value } = randomOption;
        const offered = offeredAtPosition[positionIndex]?.find((choice) => choice.id === optionId);
        if (!engine.hasRandomOption(optionId)) {
            issues.push({ kind: "unknownRandomOption", slot, optionId });
        } else if (offered?.range === undefined) {
            issues.push({ kind: "randomOptionNotOfferedForItem", slot, position: positionIndex + 1, optionId });
        } else if (value < offered.range.lowest || value > offered.range.highest || (value - offered.range.lowest) % offered.range.step !== 0) {
            issues.push({ kind: "randomOptionValueOutOfRange", slot, position: positionIndex + 1, optionId, value });
        }
    });

    return issues;
}

/**
 * The element the character's weapon attacks with, beyond the item's
 * own: an element the character is endowed with goes first, as in the
 * game; otherwise the element a random option gives the weapon in the
 * right hand. 0 for none. The original keeps both as one endowment.
 */
export function weaponElementOf(character: Character): number {
    if (character.weaponElement !== undefined && character.weaponElement !== 0) {
        return character.weaponElement;
    }
    return character.equipment.rightHand?.element ?? 0;
}
