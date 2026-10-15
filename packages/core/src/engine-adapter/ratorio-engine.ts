import { type AttackMethod, type AttackSource, loadAttackMethodReader } from "./attack-methods.ts";
import { type BattleSummary, summarizeBattleResult } from "./battle-summary.ts";
import { type EngineCatalog, loadEngineCatalog } from "./engine-catalog.ts";
import { type EngineNames, loadEngineNames } from "./engine-names.ts";
import { loadRatorioSaveCodec, type RatorioSaveCodec, type RatorioSaveReader, type RatorioSaveWriter } from "./ratorio-save.ts";
import { loadStatSnapshotReader, type StatSnapshot } from "./stat-snapshot.ts";
import { loadAutoSpellLayout } from "./auto-spells.ts";
import { loadCustomizationLayouts, loadTargetSettingLayouts } from "./named-settings.ts";
import { assignAndReadSupportBuffSlotIds, type CalcModelLayout, loadGearAndStatLayout } from "./calc-model-layout.ts";
import type { RatorioBattleResult, RatorioCalcModel } from "./ratorio-calc-model.ts";
import { type EquipmentSlot, equipmentSlots, isShadowSlot } from "../character-vocabulary.ts";

/** One random option rolled on a gear piece. */
export interface RandomOptionValue {
    readonly optionId: number;
    readonly value: number;
}

/** The random options of each worn piece, by position, `null` for an empty position. A slot that is not listed has none. */
export type RandomOptionsOfSlot = Readonly<Partial<Record<EquipmentSlot, readonly (RandomOptionValue | null)[]>>>;

export interface RatorioEngine {
    readonly jobIds: { readonly novice: number; readonly meister: number };
    readonly skillIds: {
        readonly basicAttack: number;
        readonly armsCannon: number;
        readonly madogear: number;
        readonly madogearLicense: number;
        readonly abrDualCannon: number;
    };
    readonly calcModelLayout: CalcModelLayout;
    /** The upstream item kind, which for a weapon is its weapon type. 0 for an unknown item or no item. */
    itemKind(itemId: number): number;
    hasItem(itemId: number): boolean;
    /** Whether the job may wear the item, by upstream's job restrictions. false for an unknown item or job. */
    canJobEquipItem(jobId: number, itemId: number): boolean;
    hasMonster(monsterId: number): boolean;
    /** Cards and enchants share one ID space upstream. */
    hasCardOrEnchant(cardOrEnchantId: number): boolean;
    hasRandomOption(optionId: number): boolean;
    hasTimedItem(timedItemId: number): boolean;
    hasSpeedPotion(speedPotion: number): boolean;
    hasElement(elementId: number): boolean;
    hasArrow(arrowId: number): boolean;
    /**
     * That job at level 1 with every base stat at 1, nothing equipped, no buffs,
     * using a basic attack. Every field holds a value the engine can calculate with.
     * @throws {UnknownJobError} when the engine has no job with that ID.
     */
    createBaselineCalcModel(jobId: number): RatorioCalcModel;
    /** @throws {UnknownJobError} when the engine has no job with that ID. */
    skillSlotsOfJob(jobId: number): JobSkillSlots;
    /**
     * Not re-entrant: finish reading one result before starting the next calculation.
     * The engine keeps gear random options outside its model; a call without them calculates with none.
     * @throws {UnknownMonsterError} when the engine has no monster with that ID.
     */
    calculateBattleResult(calcModel: RatorioCalcModel, targetMonsterId: number, randomOptionsOfSlot?: RandomOptionsOfSlot): RatorioBattleResult;
    /**
     * Every attack the character of the last `calculateBattleResult` call can
     * use: its job's skills, skills its gear and cards give it, and its
     * auto-spells, each with its levels and options.
     */
    attackMethodsOfLastCalculation(): AttackMethod[];
    /** The upstream number of each attack source, as `calcModel.attackMethod.sourceType` takes it. */
    readonly attackSourceTypes: Readonly<Record<AttackSource, number>>;
    isBattleResult(value: unknown): value is RatorioBattleResult;
    summarizeBattleResult(battleResult: RatorioBattleResult): BattleSummary;
    snapshotStats(battleResult: RatorioBattleResult): StatSnapshot;
    readonly names: EngineNames;
    readonly catalog: EngineCatalog;
    /** Loads upstream's save decoder on first use; it is not needed for calculating. */
    loadSaveReader(): Promise<RatorioSaveReader>;
    /** Loads upstream's save encoder on first use. */
    loadSaveWriter(): Promise<RatorioSaveWriter>;
}

/**
 * The model stores skill levels by position: `calcModel.passiveSkill[i]` is the
 * level of `passiveSkillIds[i]`, and `calcModel.learnedSkill[i]` the level of
 * `learnedSkillIds[i]`.
 */
export interface JobSkillSlots {
    readonly passiveSkillIds: readonly number[];
    readonly learnedSkillIds: readonly number[];
}

export class UnknownMonsterError extends Error {
    readonly monsterId: number;

    constructor(monsterId: number) {
        super(`The ratorio engine has no monster with ID ${monsterId}`);
        this.name = "UnknownMonsterError";
        this.monsterId = monsterId;
    }
}

export class UnknownJobError extends Error {
    readonly jobId: number;

    constructor(jobId: number) {
        super(`The ratorio engine has no job with ID ${jobId}`);
        this.name = "UnknownJobError";
        this.jobId = jobId;
    }
}

let loadingRatorioEngine: Promise<RatorioEngine> | undefined;

/**
 * Loads the single engine copy this realm can hold; later calls reuse it.
 * The engine reads `document` and other browser globals while it loads, so
 * they must already exist: a page or frame has them, Node needs
 * `loadRatorioEngine()` from `load-ratorio-engine-in-node.ts` instead.
 */
export function loadRatorioEngineWhereDomExists(): Promise<RatorioEngine> {
    loadingRatorioEngine ??= importRatorioEngine();
    return loadingRatorioEngine;
}

async function importRatorioEngine(): Promise<RatorioEngine> {

    const { calcFromModel } = await import("../../../../vendor/ratorio/engine/runtime/calc-headless.js");
    const readAttackMethods = await loadAttackMethodReader();
    const attackSourceTypeConstants = await import("../../../../vendor/ratorio/engine/const/EnumAttackMethodSource.js");
    const { createEmptyModel } = await import("../../../../vendor/ratorio/engine/runtime/calc-model.js");
    const { CBattleCalcResultAll } = await import("../../../../vendor/ratorio/engine/battle/CBattleCalcResultAll.js");
    const { JOB_ID_NOVICE, JOB_ID_MEISTER } = await import("../../../../vendor/ratorio/engine/const/EnumJobId.js");
    const {
        SKILL_ID_TUZYO_KOGEKI,
        SKILL_ID_ARMS_CANNON,
        SKILL_ID_MADOGEAR,
        SKILL_ID_MADOGEAR_LICENSE,
        SKILL_ID_ABR_DUAL_CANNON,
    } = await import("../../../../vendor/ratorio/engine/skill/skill.dat.js");
    const { CMonsterMapAreaComponentManager } = await import(
        "../../../../vendor/ratorio/engine/monster/CMonsterMapAreaComponentManager.js"
    );
    const { MonsterObjNew } = await import("../../../../vendor/ratorio/engine/monster/monster.dat.js");
    const { MONSTER_DATA_INDEX_ID } = await import("../../../../vendor/ratorio/engine/const/EnumMonsterDataIndex.js");
    const { g_constDataManager } = await import("../../../../vendor/ratorio/engine/runtime/global.js");
    const { CONST_DATA_KIND_JOB } = await import("../../../../vendor/ratorio/engine/const/EnumConstDataKind.js");
    const { ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN } = await import(
        "../../../../vendor/ratorio/engine/const/EnumAttackMethodSource.js"
    );
    const { ITEM_KIND_NONE } = await import("../../../../vendor/ratorio/engine/const/EnumItemKind.js");
    const { ELM_ID_VANITY } = await import("../../../../vendor/ratorio/engine/const/EnumElmId.js");
    const { ARROW_ID_NONE } = await import("../../../../vendor/ratorio/engine/equip/arrow.dat.js");
    const { EQUIP_REGION_ID_COUNT } = await import("../../../../vendor/ratorio/engine/const/EnumMigItemParamId.js");
    const { CARD_REGION_ID_COUNT, COSTUME_REGION_ID_COUNT, COSTUME_REGION_ID_HEAD_UNDER } = await import(
        "../../../../vendor/ratorio/engine/runtime/common.js"
    );

    const { ItemObjNew } = await import("../../../../vendor/ratorio/engine/equip/item.dat.js");
    const { CardObjNew } = await import("../../../../vendor/ratorio/engine/equip/card.dat.js");
    const { ITEM_DATA_INDEX_KIND } = await import("../../../../vendor/ratorio/engine/const/EnumItemDataIndex.js");
    const { IsMatchJobRestrict } = await import("../../../../vendor/ratorio/engine/data/mig.job.h.js");
    const { SetEquipRndOptTable } = await import("../../../../vendor/ratorio/engine/equip/rndopttype.h.js");
    const { g_rndOptArray } = await import("../../../../vendor/ratorio/engine/equip/rndopt.dat.js");
    const { RND_OPT_SLOT_COUNT } = await import("../../../../vendor/ratorio/engine/const/EnumRndOptTypeDataIndex.js");

    await standInForTheShadowGearPanel();
    const { locations: supportBuffLocations, settings: supportBuffSettings } = await assignAndReadSupportBuffSlotIds();
    await openBuffPanels();
    const snapshotStats = await loadStatSnapshotReader();
    const names = await loadEngineNames();
    let loadingSaveCodec: Promise<RatorioSaveCodec> | undefined;
    const loadSaveCodec = () => (loadingSaveCodec ??= loadRatorioSaveCodec(calcModelLayout));
    const calcModelLayout: CalcModelLayout = {
        ...(await loadGearAndStatLayout()),
        supportBuffLocations,
        customizations: await loadCustomizationLayouts(),
        targetSettings: await loadTargetSettingLayouts(),
        autoSpells: await loadAutoSpellLayout((skillId) => names.skillName(skillId)),
        costumePositionOfLowerHeadgear: COSTUME_REGION_ID_HEAD_UNDER,
    };
    const catalog = await loadEngineCatalog(calcModelLayout, names, supportBuffSettings);

    function skillSlotsOfJob(jobId: number): JobSkillSlots {
        const jobData = g_constDataManager.GetDataObject(CONST_DATA_KIND_JOB, jobId);
        if (jobData === null) {
            throw new UnknownJobError(jobId);
        }
        return {
            passiveSkillIds: jobData.GetPassiveSkillIdArray(),
            learnedSkillIds: jobData.GetLearnSkillIdArray(),
        };
    }

    // The engine reads its target from the page's monster selector, which does
    // not work without the page. Writing the selector's stored ID is the only
    // headless way in until docs/upstream/monster-id-in-model.md lands upstream.
    function selectTargetMonster(monsterId: number): void {
        if (MonsterObjNew[monsterId] === undefined) {
            throw new UnknownMonsterError(monsterId);
        }
        CMonsterMapAreaComponentManager.customSelectMonster.selectedDataId = monsterId;
    }

    function emptySlotsAsUpstreamHoldsThem(): number[] {
        const equip = new Array<number>(EQUIP_REGION_ID_COUNT).fill(0);
        for (const slot of equipmentSlots) {
            if (!isShadowSlot(slot)) {
                equip[calcModelLayout.equipPositionOfSlot[slot]] = calcModelLayout.emptyItemIdOfSlot[slot];
            }
        }
        return equip;
    }

    // The engine reads gear random options from a table that only the page
    // fills, and never clears it. Every position of every slot is written
    // before each calculation, so nothing is left over from the one before.
    // Remove when docs/upstream/random-options-in-model.md lands upstream.
    function writeRandomOptions(randomOptionsOfSlot: RandomOptionsOfSlot): void {
        for (const slot of equipmentSlots) {
            const randomOptions = randomOptionsOfSlot[slot] ?? [];
            for (let optionPosition = 0; optionPosition < RND_OPT_SLOT_COUNT; optionPosition++) {
                const randomOption = randomOptions[optionPosition];
                SetEquipRndOptTable(calcModelLayout.equipPositionOfSlot[slot], optionPosition, randomOption?.optionId ?? 0, randomOption?.value ?? 0);
            }
        }
    }

    return {
        jobIds: { novice: JOB_ID_NOVICE, meister: JOB_ID_MEISTER },
        skillIds: {
            basicAttack: SKILL_ID_TUZYO_KOGEKI,
            armsCannon: SKILL_ID_ARMS_CANNON,
            madogear: SKILL_ID_MADOGEAR,
            madogearLicense: SKILL_ID_MADOGEAR_LICENSE,
            abrDualCannon: SKILL_ID_ABR_DUAL_CANNON,
        },
        calcModelLayout,
        itemKind(itemId) {
            const itemKind = ItemObjNew[itemId]?.[ITEM_DATA_INDEX_KIND];
            return typeof itemKind === "number" ? itemKind : ITEM_KIND_NONE;
        },
        hasItem: (itemId) => ItemObjNew[itemId] !== undefined,
        canJobEquipItem(jobId, itemId) {
            if (ItemObjNew[itemId] === undefined || g_constDataManager.GetDataObject(CONST_DATA_KIND_JOB, jobId) === null) {
                return false;
            }
            return IsMatchJobRestrict(itemId, jobId);
        },
        hasMonster: (monsterId) => MonsterObjNew[monsterId] !== undefined,
        hasCardOrEnchant: (cardOrEnchantId) => CardObjNew[cardOrEnchantId] !== undefined,
        hasRandomOption: (optionId) => optionId > 0 && g_rndOptArray[optionId] !== undefined,
        hasTimedItem: (timedItemId) => names.describeTimedItem(timedItemId) !== undefined,
        hasSpeedPotion: (speedPotion) => names.speedPotionName(speedPotion) !== undefined,
        hasElement: (elementId) => names.elementName(elementId) !== undefined,
        hasArrow: (arrowId) => names.describeArrow(arrowId) !== undefined,
        createBaselineCalcModel(jobId) {
            const { passiveSkillIds } = skillSlotsOfJob(jobId);
            const noRefinePerArmorRegion = { head: 0, body: 0, shield: 0, shoulder: 0, shoes: 0 };
            return {
                ...createEmptyModel(),
                status: { jobId, baseLv: 1, jobLv: 1, str: 1, agi: 1, vit: 1, dex: 1, int: 1, luk: 1, speedPot: 0 },
                weapon: {
                    type: ITEM_KIND_NONE,
                    zokusei: ELM_ID_VANITY,
                    atkPlus: 0,
                    transcendence: 0,
                    weapon2Type: ITEM_KIND_NONE,
                    weapon2AtkPlus: 0,
                    weapon2Transcendence: 0,
                },
                defPlus: { ...noRefinePerArmorRegion },
                defTranscendence: { ...noRefinePerArmorRegion },
                arrow: ARROW_ID_NONE,
                attackMethod: {
                    skillId: SKILL_ID_TUZYO_KOGEKI,
                    sourceType: ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN,
                    skillLv: 1,
                    optionValueArray: [],
                },
                equip: emptySlotsAsUpstreamHoldsThem(),
                card: new Array<number>(CARD_REGION_ID_COUNT).fill(0),
                costume: new Array<number>(COSTUME_REGION_ID_COUNT).fill(0),
                passiveSkill: passiveSkillIds.map(() => 0),
            };
        },
        skillSlotsOfJob,
        calculateBattleResult(calcModel, targetMonsterId, randomOptionsOfSlot = {}) {
            selectTargetMonster(targetMonsterId);
            writeRandomOptions(randomOptionsOfSlot);
            return calcFromModel(calcModel);
        },
        attackMethodsOfLastCalculation: readAttackMethods,
        attackSourceTypes: {
            job: attackSourceTypeConstants.ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN,
            gear: attackSourceTypeConstants.ATTACK_METHOD_SOURCE_TYPE_USABLE_SKILL,
            autoSpell: attackSourceTypeConstants.ATTACK_METHOD_SOURCE_TYPE_AUTO_SPELL,
        },
        isBattleResult: (value): value is RatorioBattleResult => value instanceof CBattleCalcResultAll,
        summarizeBattleResult: (battleResult) => summarizeBattleResult(battleResult, MONSTER_DATA_INDEX_ID),
        snapshotStats,
        names,
        catalog,
        loadSaveReader: async () => (await loadSaveCodec()).read,
        loadSaveWriter: async () => (await loadSaveCodec()).write,
    };
}

// Upstream counts the random options of shadow gear only while the page's
// shadow gear panel is registered, although it reads them from the same
// table as those of regular gear. An object that stands in for the panel
// opens that gate. Remove when docs/upstream/shadow-random-options-gate.md
// lands upstream.
async function standInForTheShadowGearPanel(): Promise<void> {
    const { registerShadowEquipController } = await import("../../../../vendor/ratorio/engine/equip/CShadowEquipControllerDataBridge.js");
    registerShadowEquipController({
        rebuildAll: () => undefined,
        getEquippedID: () => 0,
        getRefined: () => 0,
        getRndOptInfoArray: () => [],
    });
}

// Upstream copies passiveSkill, buff4, buff7 and buff8 from the model only
// while the matching buff panel is open on the page, and all four start
// closed. Remove when docs/upstream/buff-panel-flags.md lands upstream.
async function openBuffPanels(): Promise<void> {
    const { setN_Skill1SW } = await import("../../../../vendor/ratorio/engine/ui/BuffJobSpecificSelf.js");
    const { setN_Skill4SW } = await import("../../../../vendor/ratorio/engine/ui/BuffGuildAndGospel.js");
    const { setN_Skill7SW } = await import("../../../../vendor/ratorio/engine/ui/BuffItemAndFood.js");
    const { setN_Skill8SW } = await import("../../../../vendor/ratorio/engine/ui/BuffOtherCategory.js");

    setN_Skill1SW(true);
    setN_Skill4SW(true);
    setN_Skill7SW(true);
    setN_Skill8SW(true);
}
