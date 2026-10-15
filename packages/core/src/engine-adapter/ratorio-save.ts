import { type AttackSource, attackSources } from "./attack-methods.ts";
import type { PositionalBuffPanel } from "../panels/panel-definitions.ts";
import {
    type BaseStatName,
    type EquipmentSlot,
    equipmentSlots,
    isShadowSlot,
    randomOptionsPerGearPiece,
    socketCountOfSlot,
    type TraitStatName,
} from "../character-vocabulary.ts";
import type { RandomOptionValue } from "./ratorio-engine.ts";
import type { UpstreamCustomizationMap } from "../../../../vendor/ratorio/engine/savedata/conf-mig-mapping.js";
import type { AutoSpellValue } from "./auto-spells.ts";
import type { CalcModelLayout, SupportBuffSection } from "./calc-model-layout.ts";
import type { CustomizationSection, TargetSettingSection } from "./named-settings.ts";

/** One worn piece as a ratorio save holds it. A card or enchant ID of 0 is an empty socket. */
export interface RatorioSaveGearPiece {
    readonly itemId: number;
    readonly refine: number;
    readonly transcendence: number;
    readonly cardOrEnchantIds: readonly number[];
    /** By position, `null` for an empty one, with no empty positions at the end. */
    readonly randomOptions: readonly (RandomOptionValue | null)[];
}

/** What a ratorio save says, in this project's terms. Positional lists follow the job's and upstream's own orders. */
export interface RatorioSaveContent {
    readonly jobId: number;
    readonly baseLevel: number;
    readonly jobLevel: number;
    readonly baseStats: Readonly<Record<BaseStatName, number>>;
    readonly traitStats: Readonly<Record<TraitStatName, number>>;
    readonly gear: Readonly<Partial<Record<EquipmentSlot, RatorioSaveGearPiece>>>;
    /** Levels in the order of the job's learnable skills. */
    readonly learnedSkillLevels: readonly number[];
    /** Levels in the order of the job's own buffs. */
    readonly selfBuffLevels: readonly number[];
    /** Values in upstream's slot order of each support panel. */
    readonly supportBuffValues: Readonly<Record<SupportBuffSection, readonly number[]>>;
    /** Values by position in each of the panels upstream knows by position only. */
    readonly positionalBuffValues: Readonly<Record<PositionalBuffPanel, readonly number[]>>;
    readonly autoSpells: readonly AutoSpellValue[];
    /** Values by upstream slot of each part of the performance customisation. A save does not carry every slot. */
    readonly customizationValues: Readonly<Record<CustomizationSection, readonly number[]>>;
    /** Values by upstream slot of each part of the monster settings. */
    readonly targetSettingValues: Readonly<Record<TargetSettingSection, readonly number[]>>;
    readonly timedItemIds: readonly number[];
    readonly speedPotion: number;
    /** 0 when the weapon is not endowed. */
    readonly weaponElement: number;
    /** 0 for no arrow or ammunition. */
    readonly arrowId: number;
    readonly targetMonsterId: number | undefined;
    /** `options` are the values of the skill's options after its level; a save always holds five, padded with 0. */
    readonly attack: { readonly skillId: number; readonly source: AttackSource; readonly skillLevel: number; readonly options: readonly number[] } | undefined;
    /** Upstream unit types that hold data this reader does not interpret (for example `SKILL_BUFF_MUSIC`). */
    readonly uninterpretedUnitTypes: readonly string[];
}

export type UnreadableSaveFlaw = "notSaveData" | "noCharacter";

export class UnreadableRatorioSaveError extends Error {
    readonly flaw: UnreadableSaveFlaw;

    constructor(flaw: UnreadableSaveFlaw) {
        super(`Not a readable ratorio save: ${flaw}`);
        this.name = "UnreadableRatorioSaveError";
        this.flaw = flaw;
    }
}

/** Reads a ratorio save: the page's exported URL, or only the data after its `?`. */
export type RatorioSaveReader = (saveUrlOrData: string) => RatorioSaveContent;

/**
 * Writes a ratorio save: the data that goes after the `?` of the page's URL,
 * in the page's uncompressed form. `uninterpretedUnitTypes` are not written;
 * the page keeps its defaults for them.
 */
export type RatorioSaveWriter = (content: RatorioSaveContent) => string;

export interface RatorioSaveCodec {
    readonly read: RatorioSaveReader;
    readonly write: RatorioSaveWriter;
}

/** The page a ratorio save URL opens. */
export const ratorioPageUrl = "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html";

type SaveValue = string | number | readonly (string | number)[] | undefined;
type SaveUnit = Readonly<Record<string, SaveValue>>;

const compressedSavePrefix = "dx";

function withoutEmptyEnd<Entry>(entries: readonly (Entry | null)[]): (Entry | null)[] {
    const trimmed = [...entries];
    while (trimmed.length > 0 && trimmed.at(-1) === null) {
        trimmed.pop();
    }
    return trimmed;
}

/** The twenty numbers of the page's hand-entered monster, which the calc model does not take. */
const customMonsterStatNames = ["lv", "hp", "str", "int", "vit", "dex", "agi", "luk", "atk", "matk", "range", "def", "mdef", "baseExp", "jobExp", "size", "element", "race", "bossType", "grassType"];
const attackOptionsInASave = 5;
const slotCountOfCustomizationSection: Readonly<Record<CustomizationSection, number>> = { status: 30, attack: 30, defense: 20, skill: 20, traitStatus: 20 };

export async function loadRatorioSaveCodec(layout: Pick<CalcModelLayout, "equipPositionOfSlot" | "emptyItemIdOfSlot" | "autoSpells">): Promise<RatorioSaveCodec> {
    const { buildSaveDataUnits } = await import("../../../../vendor/ratorio/engine/savedata/savedata-collect.js");
    const { createEmptySaveModel } = await import("../../../../vendor/ratorio/engine/savedata/save-model.js");
    const customizationMaps = await import("../../../../vendor/ratorio/engine/savedata/conf-mig-mapping.js");
    const zstd = await import("../../../../vendor/ratorio/engine/savedata/zstd-codec.js");
    const { CSaveDataManager } = await import("../../../../vendor/ratorio/engine/savedata/CSaveDataManager.js");
    const { CSaveDataConverter } = await import("../../../../vendor/ratorio/engine/savedata/CSaveDataConverter.js");
    const { CSaveDataConst } = await import("../../../../vendor/ratorio/engine/savedata/CSaveDataConst.js");
    const attackSourceTypes = await import("../../../../vendor/ratorio/engine/const/EnumAttackMethodSource.js");
    const sourceTypeOfAttackSource: Readonly<Record<AttackSource, number>> = {
        job: attackSourceTypes.ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN,
        gear: attackSourceTypes.ATTACK_METHOD_SOURCE_TYPE_USABLE_SKILL,
        autoSpell: attackSourceTypes.ATTACK_METHOD_SOURCE_TYPE_AUTO_SPELL,
    };
    const { CSaveDataUnitTypeManager } = await import("../../../../vendor/ratorio/engine/savedata/CSaveDataUnitTypeManager.js");
    const unitTypes: Readonly<Record<string, unknown>> = await import("../../../../vendor/ratorio/engine/savedata/CSaveDataUnit.js");
    await zstd.initializeZstd();

    const upstreamName = (constantName: string): string => {
        const name = CSaveDataConst[constantName];
        if (typeof name !== "string" && typeof name !== "number") {
            throw new TypeError(`Upstream no longer defines CSaveDataConst.${constantName}`);
        }
        return String(name);
    };
    const unitTypePrefix = "SAVE_DATA_UNIT_TYPE_";
    const unitTypeNameOfNumber = new Map(
        Object.entries(unitTypes).flatMap(([constantName, typeNumber]): [number, string][] =>
            constantName.startsWith(unitTypePrefix) && typeof typeNumber === "number"
                ? [[typeNumber, constantName.slice(unitTypePrefix.length)]]
                : [],
        ),
    );

    const typeProperty = upstreamName("propNameType");
    const bookkeepingProperties = new Set([typeProperty, "version", upstreamName("propNameParseCtrlFlag"), upstreamName("propNameOptCode")]);
    const regionPropertyOfSlot: Readonly<Record<EquipmentSlot, string>> = {
        rightHand: upstreamName("propNameEqpRgnArmsRight"),
        leftHand: upstreamName("propNameEqpRgnArmsLeft"),
        headTop: upstreamName("propNameEqpRgnHeadTop"),
        headMid: upstreamName("propNameEqpRgnHeadMid"),
        headLow: upstreamName("propNameEqpRgnHeadUnder"),
        shield: upstreamName("propNameEqpRgnShield"),
        armor: upstreamName("propNameEqpRgnBody"),
        garment: upstreamName("propNameEqpRgnShoulder"),
        shoes: upstreamName("propNameEqpRgnFoot"),
        accessory1: upstreamName("propNameEqpRgnAccessory1"),
        accessory2: upstreamName("propNameEqpRgnAccessory2"),
        // Shadow gear has its own regions unit, which reuses the property names of the regular one.
        shadowWeapon: upstreamName("propNameEqpRgnArmsRight"),
        shadowShield: upstreamName("propNameEqpRgnArmsLeft"),
        shadowArmor: upstreamName("propNameEqpRgnBody"),
        shadowShoes: upstreamName("propNameEqpRgnFoot"),
        shadowAccessory1: upstreamName("propNameEqpRgnAccessory1"),
        shadowAccessory2: upstreamName("propNameEqpRgnAccessory2"),
    };
    const regionsKind = (constantName: "eqpRgnKindItem" | "eqpRgnKindShadow") => Number(CSaveDataConst[constantName]);
    // A regular piece keeps its cards in card positions 1 to 4; shadow gear has no position 1 and uses 2 to 4.
    const cardNumbersOfSlot = (slot: EquipmentSlot) =>
        Array.from({ length: socketCountOfSlot(slot) }, (_unused, index) => index + (isShadowSlot(slot) ? 2 : 1));
    const supportBuffUnitTypeOfSection: Readonly<Record<SupportBuffSection, string>> = {
        confIchizi: "SKILL_BUFF_1ST",
        confNizi: "SKILL_BUFF_2ND",
        confSanzi: "SKILL_BUFF_3RD",
        confYozi: "SKILL_BUFF_4TH",
        confDebuff: "CHARA_DEBUFF",
    };
    const unitTypeOfBuffPanel: Readonly<Record<PositionalBuffPanel, string>> = {
        guildBuffs: "SKILL_BUFF_GUILD",
        itemBuffs: "ITEM_BUFF",
        otherBuffs: "CHARA_BUFF",
    };
    const interpretedUnitTypes = new Set([
        "VERSION",
        "CHARA",
        "EQUIPABLE",
        "EQUIP_REGIONS",
        "LEARNED_SKILLS",
        "SKILL_BUFF_SELF",
        ...Object.values(supportBuffUnitTypeOfSection),
        ...Object.values(unitTypeOfBuffPanel),
        "TIME_BUFF",
        "AUTO_SPELLS",
        "CHARA_CONF_BASIC",
        "CHARA_CONF_SPECIALIZE",
        "CHARA_CONF_SKILL",
        "CHARA_CONF_SPEC_BASIC",
        "MOB_CONF_PLAYER",
        "MOB_CONF_PLAYER2",
        "MOB_BUFF",
        "MOB_DEBUFF",
        "MOB",
        "ATTACK_CONF",
        "SETTINGS",
    ]);

    function unitsOf(saveUrlOrData: string): { typeName: string; unit: SaveUnit }[] {
        const saveData = saveUrlOrData.trim().replace(/^[^?]*\?/, "");
        try {
            const dataText = saveData.startsWith(compressedSavePrefix)
                ? String(
                      Reflect.get(
                          JSON.parse(
                              new TextDecoder().decode(
                                  zstd.zstdDecompressSync(zstd.base64ToUint8Array(saveData.slice(compressedSavePrefix.length))),
                              ),
                          ) as object,
                          "base",
                      ),
                  )
                : saveData;
            const saveDataManager = new CSaveDataManager();
            saveDataManager.parseDataText(CSaveDataConverter.ExtractDataTextMIG(dataText.replaceAll(/[^-_.~a-zA-Z0-9]/g, "")));
            const units = JSON.parse(saveDataManager.encodeToJSON()) as { parsedMap: SaveUnit }[];
            return units.map(({ parsedMap }) => ({
                typeName: unitTypeNameOfNumber.get(Number(parsedMap[typeProperty])) ?? `UNKNOWN_${String(parsedMap[typeProperty])}`,
                unit: parsedMap,
            }));
        } catch {
            throw new UnreadableRatorioSaveError("notSaveData");
        }
    }

    const numberOf = (value: SaveValue): number => (typeof value === "string" || typeof value === "number" ? Number(value) : 0);
    const numbersOf = (value: SaveValue): number[] => (Array.isArray(value) ? value.map(Number) : []);
    const holdsData = (unit: SaveUnit): boolean =>
        Object.entries(unit).some(([propertyName, value]) =>
            bookkeepingProperties.has(propertyName) ? false : Array.isArray(value) ? value.some((entry) => Number(entry) !== 0) : numberOf(value) !== 0,
        );

    const unitTypeNumberOfName = new Map([...unitTypeNameOfNumber].map(([typeNumber, typeName]) => [typeName, typeNumber]));
    const controlFlagProperty = upstreamName("propNameParseCtrlFlag");
    const padded = (values: readonly number[], length: number) => Array.from({ length }, (_unused, position) => values[position] ?? 0);

    /**
     * Upstream builds every unit of a save from one plain model, which is
     * what its page fills from its controls. This fills the same model from
     * a save's content.
     */
    const write: RatorioSaveWriter = (content) => {
        const randomOptionsOf = (gearPiece: RatorioSaveGearPiece | undefined) =>
            Array.from({ length: randomOptionsPerGearPiece }, (_unused, position) => ({ kind: gearPiece?.randomOptions[position]?.optionId ?? 0, value: gearPiece?.randomOptions[position]?.value ?? 0 }));
        const saveModel = {
            ...createEmptySaveModel(),
            jobId: content.jobId,
            autoAdjustBaseLv: false,
            baseLv: content.baseLevel,
            jobLv: content.jobLevel,
            statStr: content.baseStats.str,
            statAgi: content.baseStats.agi,
            statVit: content.baseStats.vit,
            statInt: content.baseStats.int,
            statDex: content.baseStats.dex,
            statLuk: content.baseStats.luk,
            statPow: content.traitStats.pow,
            statSta: content.traitStats.sta,
            statWis: content.traitStats.wis,
            statSpl: content.traitStats.spl,
            statCon: content.traitStats.con,
            statCrt: content.traitStats.crt,
            armsElement: content.weaponElement,
            speedPot: content.speedPotion,
            arrow: content.arrowId,
            learnedSkill: [...content.learnedSkillLevels],
            passiveSkillSelf: [...content.selfBuffLevels],
            passiveSkillSelfCount: content.selfBuffLevels.length,
            passiveSkillMusic: [],
            passiveSkillGuild: [...content.positionalBuffValues.guildBuffs],
            autoSpellRaw: layout.autoSpells.toCalcModelList(content.autoSpells),
            passiveSkillItem: [...content.positionalBuffValues.itemBuffs],
            passiveSkillOther: [...content.positionalBuffValues.otherBuffs],
            confIchizi: [...content.supportBuffValues.confIchizi],
            confNizi: [...content.supportBuffValues.confNizi],
            confSanzi: [...content.supportBuffValues.confSanzi],
            confYozi: [...content.supportBuffValues.confYozi],
            timeItemConf: [...content.timedItemIds],
            confCustomStatus: [...content.customizationValues.status],
            confCustomAtk: [...content.customizationValues.attack],
            confCustomDef: [...content.customizationValues.defense],
            confCustomSkill: [...content.customizationValues.skill],
            confCustomSpecStatus: [...content.customizationValues.traitStatus],
            mobCategoryId: 0,
            mobMapId: 0,
            mobMonsterId: content.targetMonsterId ?? 0,
            mobConfTaisei: [...content.targetSettingValues.asPlayer],
            mobConfInput: Object.fromEntries(customMonsterStatNames.map((statName) => [statName, 0])),
            mobConfKyouka: [...content.targetSettingValues.buffs],
            mobConfIjyou: [...content.targetSettingValues.ailments],
            attackMethodSkillId: content.attack?.skillId ?? 0,
            attackMethodSourceType: sourceTypeOfAttackSource[content.attack?.source ?? "job"],
            attackMethodSkillLv: content.attack?.skillLevel ?? 0,
            attackMethodOptions: padded(content.attack?.options ?? [], attackOptionsInASave),
            equip: {
                itemRegions: equipmentSlots
                    .filter((slot) => !isShadowSlot(slot))
                    .map((slot) => {
                        const gearPiece = content.gear[slot];
                        return {
                            eqpRgnId: layout.equipPositionOfSlot[slot],
                            // The page keeps a stand-in item in a slot that holds nothing, and saves it.
                            itemId: gearPiece?.itemId ?? layout.emptyItemIdOfSlot[slot],
                            refine: gearPiece?.refine ?? 0,
                            transcendence: gearPiece?.transcendence ?? 0,
                            rndOpt: randomOptionsOf(gearPiece),
                            cardCategoryIds: null,
                            cardIds: padded(gearPiece?.cardOrEnchantIds ?? [], socketCountOfSlot(slot)),
                        };
                    }),
                shadowRegions: equipmentSlots.filter(isShadowSlot).map((slot) => {
                    const gearPiece = content.gear[slot];
                    return {
                        eqpRgnId: layout.equipPositionOfSlot[slot],
                        itemId: gearPiece?.itemId ?? 0,
                        refine: gearPiece?.refine ?? 0,
                        rndOpt: randomOptionsOf(gearPiece),
                        cardIds: padded(gearPiece?.cardOrEnchantIds ?? [], socketCountOfSlot(slot)),
                    };
                }),
                debuff: [...content.supportBuffValues.confDebuff],
            },
        };

        // Upstream writes its units in ascending type order, units of one type in the order they were built.
        let dataText = "";
        let bitOffset = 0;
        for (const unit of buildSaveDataUnits(saveModel).toSorted((oneUnit, otherUnit) => oneUnit.constructor.type - otherUnit.constructor.type)) {
            [dataText, bitOffset] = unit.encodeToURL(dataText, bitOffset);
        }
        return dataText;
    };

    /**
     * The values of a unit that holds a run of numbers, some of them with a
     * sign of their own: upstream writes one flag bit per property after the
     * flags, and a property whose bit is off is 0.
     */
    function configValuesOf(typeName: string, unit: SaveUnit | undefined): number[] {
        const typeNumber = unitTypeNumberOfName.get(typeName);
        const UnitClass = typeNumber === undefined ? undefined : CSaveDataUnitTypeManager.getUnitClass(typeNumber);
        if (unit === undefined || UnitClass === undefined) {
            return [];
        }
        const seenOfProperty = new Map<string, number>();
        const nextValueOf = (propertyName: string): number => {
            const seen = seenOfProperty.get(propertyName) ?? 0;
            seenOfProperty.set(propertyName, seen + 1);
            const value = unit[propertyName];
            return Array.isArray(value) ? Number(value[seen] ?? 0) : seen === 0 ? numberOf(value) : 0;
        };
        const flagsValue = unit[controlFlagProperty];
        let flags = BigInt(typeof flagsValue === "string" || typeof flagsValue === "number" ? flagsValue : 0);
        const values: number[] = [];
        let sign: number | undefined;
        for (const propertyName of UnitClass.propNames.slice(UnitClass.propNames.indexOf(controlFlagProperty) + 1)) {
            const isWritten = (flags & 1n) === 1n;
            const value = nextValueOf(propertyName);
            if (propertyName.endsWith("Sign")) {
                // Upstream stores 1 for a negative number.
                sign = isWritten ? (value === 1 ? -1 : 1) : undefined;
            } else {
                values.push((isWritten ? value : 0) * (sign ?? 1));
                sign = undefined;
            }
            flags >>= 1n;
        }
        return values;
    }

    /** A save keeps the IDs, levels and chances of the auto-spells in three lists, with three flag bits per row saying which of them it wrote. */
    function autoSpellsOf(unit: SaveUnit | undefined): AutoSpellValue[] {
        if (unit === undefined) {
            return [];
        }
        const flagsValue = unit[controlFlagProperty];
        let flags = BigInt(typeof flagsValue === "string" || typeof flagsValue === "number" ? flagsValue : 0);
        const ids = numbersOf(unit[upstreamName("propNameAutoSpellID")]);
        const levels = numbersOf(unit[upstreamName("propNameAutoSpellLv")]);
        const chancePositions = numbersOf(unit[upstreamName("propNameAutoSpellProb")]);
        const autoSpells: AutoSpellValue[] = [];
        for (let row = 0; row < layout.autoSpells.limit; row++) {
            const autoSpellId = (flags & 1n) === 1n ? (ids[row] ?? 0) : 0;
            const level = (flags & 2n) === 2n ? (levels[row] ?? 0) : 0;
            const chancePosition = (flags & 4n) === 4n ? (chancePositions[row] ?? 0) : 0;
            if (autoSpellId !== 0) {
                autoSpells.push({ autoSpellId, level, chancePerMille: layout.autoSpells.chancesPerMille[chancePosition] ?? 0 });
            }
            flags >>= 3n;
        }
        return autoSpells;
    }

    /**
     * A save spreads the customisation over seven units, each a run of
     * numbers that upstream's mapping tables assign to slots of the five parts.
     */
    function customizationValuesOf(unitsOfType: (typeName: string) => SaveUnit[]): Record<CustomizationSection, number[]> {
        const slots = {
            confCustomStatus: padded([], slotCountOfCustomizationSection.status),
            confCustomAtk: padded([], slotCountOfCustomizationSection.attack),
            confCustomDef: padded([], slotCountOfCustomizationSection.defense),
            confCustomSkill: padded([], slotCountOfCustomizationSection.skill),
            confCustomSpecStatus: padded([], slotCountOfCustomizationSection.traitStatus),
        };
        const specializedUnitOfKind = (kindConstantName: string) =>
            unitsOfType("CHARA_CONF_SPECIALIZE").find((unit) => numberOf(unit[upstreamName("instanceKind")]) === Number(CSaveDataConst[kindConstantName]));
        const apply = (map: UpstreamCustomizationMap, typeName: string, unit: SaveUnit | undefined) => customizationMaps.applyMigArrayToConf(map, configValuesOf(typeName, unit), slots);
        apply(customizationMaps.CHARA_CONF_SPEC_BASIC_MIG_MAP, "CHARA_CONF_SPEC_BASIC", unitsOfType("CHARA_CONF_SPEC_BASIC")[0]);
        apply(customizationMaps.CHARA_CONF_BASIC_MIG_MAP, "CHARA_CONF_BASIC", unitsOfType("CHARA_CONF_BASIC")[0]);
        apply(customizationMaps.CHARA_CONF_SPECIALIZE_PHYSICAL_MIG_MAP, "CHARA_CONF_SPECIALIZE", specializedUnitOfKind("specKindAttackPhysical"));
        apply(customizationMaps.CHARA_CONF_SPECIALIZE_MAGICAL_MIG_MAP, "CHARA_CONF_SPECIALIZE", specializedUnitOfKind("specKindAttackMagical"));
        apply(customizationMaps.CHARA_CONF_SPECIALIZE_ATTACK_ANY_MIG_MAP, "CHARA_CONF_SPECIALIZE", specializedUnitOfKind("specKindAttackAny"));
        apply(customizationMaps.CHARA_CONF_SPECIALIZE_DEFENCE_ANY_MIG_MAP, "CHARA_CONF_SPECIALIZE", specializedUnitOfKind("specKindDefencekAny"));
        apply(customizationMaps.CHARA_CONF_SKILL_MIG_MAP, "CHARA_CONF_SKILL", unitsOfType("CHARA_CONF_SKILL")[0]);
        return { status: slots.confCustomStatus, attack: slots.confCustomAtk, defense: slots.confCustomDef, skill: slots.confCustomSkill, traitStatus: slots.confCustomSpecStatus };
    }

    const read: RatorioSaveReader = (saveUrlOrData) => {
        const units = unitsOf(saveUrlOrData);
        const unitsOfType = (typeName: string) => units.filter((candidate) => candidate.typeName === typeName).map(({ unit }) => unit);
        const character = unitsOfType("CHARA")[0];
        if (character === undefined) {
            throw new UnreadableRatorioSaveError("noCharacter");
        }
        const stat = (constantName: string) => numberOf(character[upstreamName(constantName)]);

        const gearOfDefinitionId = new Map(unitsOfType("EQUIPABLE").map((unit) => [numberOf(unit[upstreamName("propNameEquipItemDefID")]), unit]));
        const regionsOfKind = (constantName: "eqpRgnKindItem" | "eqpRgnKindShadow") =>
            unitsOfType("EQUIP_REGIONS").find((unit) => numberOf(unit[upstreamName("propNameDataKind")]) === regionsKind(constantName));
        const wornRegions = regionsOfKind("eqpRgnKindItem");
        const wornShadowRegions = regionsOfKind("eqpRgnKindShadow");
        const gear: Partial<Record<EquipmentSlot, RatorioSaveGearPiece>> = {};
        for (const [slot, regionProperty] of Object.entries(regionPropertyOfSlot) as [EquipmentSlot, string][]) {
            const definition = gearOfDefinitionId.get(numberOf((isShadowSlot(slot) ? wornShadowRegions : wornRegions)?.[regionProperty]));
            const itemId = numberOf(definition?.[upstreamName("propNameItemID")]);
            if (definition === undefined || itemId === 0) {
                continue;
            }
            const optionNumbers = Array.from({ length: randomOptionsPerGearPiece }, (_unused, index) => index + 1);
            gear[slot] = {
                itemId,
                refine: numberOf(definition[upstreamName("propNameRefinedCount")]),
                transcendence: numberOf(definition[upstreamName("propNameTranscendenceCount")]),
                cardOrEnchantIds: cardNumbersOfSlot(slot).map((cardNumber) => numberOf(definition[upstreamName(`propNameCardID${cardNumber}`)])),
                randomOptions: withoutEmptyEnd(
                    optionNumbers.map((optionNumber) => {
                        const optionId = numberOf(definition[upstreamName(`propNameRndOptID${optionNumber}`)]);
                        return optionId === 0 ? null : { optionId, value: numberOf(definition[upstreamName(`propNameRndOptValue${optionNumber}`)]) };
                    }),
                ),
            };
        }

        const levelsOfUnitType = (typeName: string) => numbersOf(unitsOfType(typeName)[0]?.[upstreamName("propNameBuffLv")]);
        const itemBuff = unitsOfType(unitTypeOfBuffPanel.itemBuffs)[0];
        const speedPotionProperty = upstreamName("propNameSubSpeedPot");
        const arrowProperty = upstreamName("propNameArrow");
        const arrow = unitsOfType("EQUIP_ARROW")[0];
        // Upstream stores the arrow ID plus one, so 1 means no arrow.
        const arrowId = Math.max(numberOf(arrow?.[arrowProperty]) - 1, 0);
        const arrowUnitHoldsMoreThanTheArrow = arrow !== undefined && holdsData({ ...arrow, [arrowProperty]: 0 });
        const characterBuff = unitsOfType(unitTypeOfBuffPanel.otherBuffs)[0];
        const weaponElementProperty = upstreamName("propNameArmsElement");
        const attack = unitsOfType("ATTACK_CONF")[0];
        const monster = unitsOfType("MOB")[0];

        return {
            jobId: stat("propNameJobID"),
            baseLevel: stat("propNameBaseLv"),
            jobLevel: stat("propNameJobLv"),
            baseStats: {
                str: stat("propNameStStr"),
                agi: stat("propNameStAgi"),
                vit: stat("propNameStVit"),
                int: stat("propNameStInt"),
                dex: stat("propNameStDex"),
                luk: stat("propNameStLuk"),
            },
            traitStats: {
                pow: stat("propNameStPow"),
                sta: stat("propNameStSta"),
                wis: stat("propNameStWis"),
                spl: stat("propNameStSpl"),
                con: stat("propNameStCon"),
                crt: stat("propNameStCrt"),
            },
            gear,
            learnedSkillLevels: numbersOf(unitsOfType("LEARNED_SKILLS")[0]?.[upstreamName("propNameSkillLv")]),
            selfBuffLevels: levelsOfUnitType("SKILL_BUFF_SELF"),
            supportBuffValues: {
                confIchizi: levelsOfUnitType(supportBuffUnitTypeOfSection.confIchizi),
                confNizi: levelsOfUnitType(supportBuffUnitTypeOfSection.confNizi),
                confSanzi: levelsOfUnitType(supportBuffUnitTypeOfSection.confSanzi),
                confYozi: levelsOfUnitType(supportBuffUnitTypeOfSection.confYozi),
                confDebuff: levelsOfUnitType(supportBuffUnitTypeOfSection.confDebuff),
            },
            autoSpells: autoSpellsOf(unitsOfType("AUTO_SPELLS")[0]),
            customizationValues: customizationValuesOf(unitsOfType),
            targetSettingValues: {
                asPlayer: configValuesOf("MOB_CONF_PLAYER2", unitsOfType("MOB_CONF_PLAYER2")[0]),
                ailments: levelsOfUnitType("MOB_DEBUFF"),
                buffs: levelsOfUnitType("MOB_BUFF"),
            },
            positionalBuffValues: {
                guildBuffs: levelsOfUnitType(unitTypeOfBuffPanel.guildBuffs),
                itemBuffs: levelsOfUnitType(unitTypeOfBuffPanel.itemBuffs),
                otherBuffs: levelsOfUnitType(unitTypeOfBuffPanel.otherBuffs),
            },
            timedItemIds: numbersOf(unitsOfType("TIME_BUFF")[0]?.[upstreamName("propNameTimeBuffID")]).filter(
                (timedItemId) => timedItemId !== 0,
            ),
            speedPotion: numberOf(itemBuff?.[speedPotionProperty]),
            weaponElement: numberOf(characterBuff?.[weaponElementProperty]),
            arrowId,
            targetMonsterId: monster === undefined ? undefined : numberOf(monster[upstreamName("propNameMonsterID")]),
            attack:
                attack === undefined
                    ? undefined
                    : {
                          skillId: numberOf(attack[upstreamName("propNameAttackSkillID")]),
                          source: attackSources.find((source) => sourceTypeOfAttackSource[source] === numberOf(attack[upstreamName("propNameSourceTypeID")])) ?? "job",
                          skillLevel: numberOf(attack[upstreamName("propNameAttackSkillLv")]),
                          options: numbersOf(attack[upstreamName("propNameAttackSkillOption")]),
                      },
            uninterpretedUnitTypes: [
                ...new Set(
                    units.filter(({ typeName, unit }) => !interpretedUnitTypes.has(typeName) && typeName !== "EQUIP_ARROW" && holdsData(unit)).map(({ typeName }) => typeName),
                ),
                ...(arrowUnitHoldsMoreThanTheArrow ? ["EQUIP_ARROW"] : []),
            ],
        };
    };

    return { read, write };
}
