import { type EquipmentSlot, equipmentSlots, randomOptionsPerGearPiece, isShadowSlot, socketCountOfSlot, socketsPerGearPiece } from "../character-vocabulary.ts";
import type { UpstreamEnchantOffer } from "../../../../vendor/ratorio/engine/equip/hmcard.js";
import type { CalcModelLayout, SupportBuffSetting } from "./calc-model-layout.ts";
import type { CustomizationSection, NamedSetting, TargetSettingSection } from "./named-settings.ts";
import type { EngineNames } from "./engine-names.ts";
import { choicesOf, type PanelChoice, panelDefinitions, selfBuffDefinitionOf, type PositionalBuffPanel, type PositionalBuffSetting, positionalBuffSettingsOf } from "../panels/panel-definitions.ts";

/** One thing the engine knows, by its ratorio ID and upstream Japanese name. */
export interface CatalogEntry {
    readonly id: number;
    readonly name: string;
    /** What it does, where upstream says so in a line. */
    readonly detail?: string;
    /** Everything it does, one effect per line, in a list that was asked for with its effects. */
    readonly effects?: readonly string[];
    /** The values it can take, for an entry that is chosen together with a value. */
    readonly range?: { readonly lowest: number; readonly highest: number; readonly step: number };
    /** The value the original starts it with, where it has one: for an auto-spell, the chance its item gives it, in per mille. */
    readonly defaultValue?: number;
}

export type MonsterElementKind = "neutral" | "water" | "earth" | "fire" | "wind" | "poison" | "holy" | "dark" | "ghost" | "undead";
export type MonsterRace = "formless" | "undead" | "animal" | "plant" | "insect" | "fish" | "demon" | "human" | "angel" | "dragon";
export type MonsterSize = "small" | "medium" | "large";

/** A monster's stats as the engine holds them. */
export interface MonsterInfo {
    readonly id: number;
    readonly name: string;
    readonly level: number;
    readonly hp: number;
    /** Its element and that element's level, 1 to 4. */
    readonly element: { readonly kind: MonsterElementKind; readonly level: number };
    readonly race: MonsterRace;
    readonly size: MonsterSize;
    readonly isBoss: boolean;
    /** DEF and MDEF without the parts that come from its stats. */
    readonly hardDef: number;
    readonly hardMdef: number;
    readonly res: number;
    readonly mres: number;
    readonly baseExp: number;
    readonly jobExp: number;
}

/** The stat points a character has earned by its level and spent on its stats; the same for trait points. */
export interface StatPointBudget {
    readonly earned: number;
    readonly spent: number;
    /** 0 for a job without trait stats. */
    readonly traitEarned: number;
    readonly traitSpent: number;
}

/** A skill whose level a character sets: one it has learned, or one of its own buffs. */
export interface SkillLevelSetting {
    readonly id: number;
    readonly name: string;
    /** 1 for a buff that is only on or off. */
    readonly highestLevel: number;
    /** Upstream's own label for each value, where the values are not plain levels or on and off. */
    readonly choices?: readonly PanelChoice[];
}

interface Limits {
    readonly lowest: number;
    readonly highest: number;
}

/** The levels and stat points the original lets a character of a job have. */
export interface JobLimits {
    readonly baseLevel: Limits;
    readonly jobLevel: Limits;
    readonly baseStat: Limits;
    /** `null` for a job without trait stats: only fourth jobs have them. */
    readonly traitStat: Limits | null;
}

/** What the engine has to choose from. Every list is in upstream ID order. */
/**
 * What a character wears that changes the SP a skill costs, as the engine
 * works it out in a calculation. Read with `skillCostChangesOfLastCalculation()`.
 */
export interface SkillCostChanges {
    /** Added to the skill's own cost; below 0 when it costs less. */
    readonly flat: number;
    /** The skill's cost in percent after this skill's own reductions: 100 is unchanged. */
    readonly percentOfThisSkill: number;
    /** Every skill's cost in percent ("スキル使用時の消費SP - 10%" makes it 90): 100 is unchanged. */
    readonly percentOfEverySkill: number;
}

/** Whether a skill hits as a physical or a magical attack, as upstream marks it. */
export type SkillDamageKind = "physical" | "magical" | "neither";

export interface EngineCatalog {
    jobs(): CatalogEntry[];
    /**
     * The kinds of weapon the job may hold in its left hand: daggers,
     * one-handed swords and one-handed axes for the assassin line, daggers
     * for the ninja jobs, none for any other job. None either next to a
     * right-hand weapon that leaves them no second hand: a katar for the
     * assassin line, a fuuma shuriken for the ninja jobs.
     */
    leftHandItemKindsOfJob(jobId: number, rightHandItemId?: number): number[];
    /** The gear that fits the slot and that the job may wear, without the stand-in for an empty slot. Empty for an unknown job. */
    itemsForSlot(slot: EquipmentSlot, jobId: number): CatalogEntry[];
    /**
     * What an item does, one effect per line, each with its condition
     * ("精錬値が7以上の時、…"): the effects the engine calculates with, then
     * what upstream only describes in words. Empty for an unknown item.
     */
    effectsOfItem(itemId: number): string[];
    /** The same for a card or enchant. */
    effectsOfCardOrEnchant(cardOrEnchantId: number): string[];
    /** What a random option does at a value, in upstream's words. Empty for an unknown option. */
    wordingOfRandomOption(optionId: number, value: number): string;
    /**
     * A bonus of a build's stat snapshot (its `ITEM_SP_` name without the
     * prefix) at a value, in upstream's words, as its effect lists write it.
     * Empty for a name upstream does not have or does not put into words.
     */
    wordingOfBonus(bonusName: string, value: number): string;
    /**
     * The items of a name, given as names are compared (full and half
     * width alike, no case, no spaces, no card slot count behind it), each
     * with its number of card slots. Retired items come last.
     */
    itemsNamed(nameKey: string): { readonly id: number; readonly name: string; readonly socketCount: number }[];
    /**
     * The skills that worn gear does something more for when they are
     * learned ("[集中力向上]Lv10習得時、Atk + 50"), which the original marks in
     * its list of learned skills. In ID order, each once; unknown IDs are
     * passed over.
     */
    learnedSkillsGearRewards(itemIds: readonly number[], cardOrEnchantIds: readonly number[]): number[];
    /**
     * What each socket of an item worn in a slot takes, first socket first,
     * without "none". An item's own enchants take over the sockets they are
     * made for. Apart from those, armor takes a card in its first socket
     * only, a weapon in all four, and the lower headgear and shadow gear take
     * none. A socket with an empty list cannot be filled.
     */
    socketChoicesOfItem(slot: EquipmentSlot, itemId: number): CatalogEntry[][];
    monsters(): CatalogEntry[];
    /** `undefined` for an unknown monster. */
    monsterInfo(monsterId: number): MonsterInfo | undefined;
    /** The skills the job can attack with. Empty for an unknown job. */
    attackSkillsOfJob(jobId: number): CatalogEntry[];
    /** `undefined` for an unknown job. An adopted character has a lower highest base stat. */
    limitsOfJob(jobId: number, isAdopted?: boolean): JobLimits | undefined;
    /**
     * What the character's level gives it in stat points and what its stats
     * cost. `undefined` for an unknown job. An adopted character of a
     * reborn job starts with as few points as a first-life one.
     */
    statPointsOf(
        character: { readonly jobId: number; readonly baseLevel: number; readonly baseStats: Readonly<Record<string, number>>; readonly traitStats?: Readonly<Record<string, number>> | undefined },
        isAdopted?: boolean,
    ): StatPointBudget | undefined;
    /** The skills the job can learn, in upstream's order. Empty for an unknown job. */
    learnableSkillsOfJob(jobId: number): SkillLevelSetting[];
    /**
     * The job's own buffs and toggles, in upstream's order, each with the range
     * and labels of the original's own-buff panel. Empty for an unknown job.
     */
    selfBuffsOfJob(jobId: number): SkillLevelSetting[];
    /** Every support buff and debuff a user can set, in panel order. */
    supportBuffs(): readonly SupportBuffSetting[];
    /** The costumes the job is offered for its lower headgear, in reading order. The original has very few. */
    costumesOfJob(jobId: number): CatalogEntry[];
    /** The auto-spells that can be set, each with the level it has and the chance its item gives it. */
    autoSpells(): CatalogEntry[];
    /** The chances an auto-spell can be given, in per mille. */
    autoSpellChances(): number[];
    /** What each part of the performance customisation offers, in panel order. */
    customizations(): Record<CustomizationSection, readonly NamedSetting[]>;
    /** What each part of the monster settings offers, in panel order. */
    targetSettings(): Record<TargetSettingSection, readonly NamedSetting[]>;
    /** The buffs of one of the panels upstream knows by position only, in panel order. */
    positionalBuffs(panel: PositionalBuffPanel): PositionalBuffSetting[];
    /**
     * The time-limited effects the original lists, in its order, with what
     * each does. Every character is offered all of them, and the same one
     * can be set more than once.
     */
    timedItems(): CatalogEntry[];
    /** The attack-speed potions, without "none". */
    speedPotions(): CatalogEntry[];
    /** The elements a weapon can be endowed with. Entry 0 is the weapon's own element. */
    weaponElements(): CatalogEntry[];
    /**
     * The ammunition a job is offered, in reading order: arrows for the archer
     * and thief lines, bullets for the gunslinger line, nothing for the others.
     */
    arrowsOfJob(jobId: number): CatalogEntry[];
    /**
     * The random options an item can roll at each of its positions, with the
     * values each can take. Five lists; a list is empty where the item rolls
     * nothing, and all five are for an item that takes no random options.
     */
    randomOptionsOfItem(itemId: number): CatalogEntry[][];
    /** The slots the item fits. Empty for an unknown item or one that is not gear. */
    slotsOfItem(itemId: number): EquipmentSlot[];
    /**
     * The SP one use of a skill costs at a level, with what the character
     * wears changing it: never below 1 for a skill that costs SP, 0 for one
     * that costs none or that the engine does not have.
     */
    spCostOfSkill(skillId: number, skillLevel: number, costChanges: SkillCostChanges): number;
    /** Whether the skill hits as a physical or a magical attack; "neither" for one the engine does not have. */
    damageKindOfSkill(skillId: number): SkillDamageKind;
    /** The items, cards and enchants a timed item is the state of ("メロン武器" for every メロン weapon); none for an unknown one. */
    sourcesOfTimedItem(timedItemId: number): { readonly kind: "item" | "cardOrEnchant"; readonly id: number }[];
}

const jobIdNamePrefix = "JOB_ID_";

// Upstream shows the trait stat controls for jobs that start at this base
// level, and gives each control this maximum; both are literals of its stat
// panel builder (engine/chara/hmjob.js), repeated here.
const lowestBaseLevelOfAFourthJob = 200;
// The stat points a character starts with, from the same file's CalcStatusPoint().
const startingStatPoints = 48;
const startingStatPointsOfARebornJob = 100;
const highestTraitStat = 120;

export async function loadEngineCatalog(
    {
        itemKindsOfSlot,
        emptyItemIdOfSlot,
        customizations,
        targetSettings,
        autoSpells,
    }: Pick<CalcModelLayout, "itemKindsOfSlot" | "emptyItemIdOfSlot" | "customizations" | "targetSettings" | "autoSpells">,
    names: Pick<EngineNames, "randomOptionName" | "describeTimedItem" | "speedPotionName" | "elementName" | "describeArrow">,
    supportBuffSettings: readonly SupportBuffSetting[],
): Promise<EngineCatalog> {
    const { g_rndOptArray } = await import("../../../../vendor/ratorio/engine/equip/rndopt.dat.js");
    const { g_rndOptTypeArray } = await import("../../../../vendor/ratorio/engine/equip/rndopttype.dat.js");
    const { g_rndOptListArray } = await import("../../../../vendor/ratorio/engine/equip/rndoptlist.dat.js");
    const { GetRndOptTypeId, GetItemExplainText } = await import("../../../../vendor/ratorio/engine/equip/item.h.js");
    const { RND_OPT_DATA_INDEX_MIN, RND_OPT_DATA_INDEX_MAX, RND_OPT_DATA_INDEX_STEP, RND_OPT_DATA_INDEX_SPID } = await import("../../../../vendor/ratorio/engine/const/EnumRndOptDataIndex.js");
    const itemSpIds = await import("../../../../vendor/ratorio/engine/const/EnumItemSpId.js");
    const { ITEM_SP_LEARNED_SKILL_EFFECT } = itemSpIds;
    const { ITEM_SP_TIME_OBJ_SORT } = await import("../../../../vendor/ratorio/engine/equip/timeitem.dat.js");
    const { SpeedPotName } = await import("../../../../vendor/ratorio/engine/runtime/roro-state.js");
    const { ELM_ID_COUNT } = await import("../../../../vendor/ratorio/engine/const/EnumElmId.js");
    const { ArrowOBJNew } = await import("../../../../vendor/ratorio/engine/equip/arrow.dat.js");
    const { ARROW_DATA_INDEX_KIND, ARROW_DATA_INDEX_KANA } = await import("../../../../vendor/ratorio/engine/const/EnumArrowDataIndex.js");
    const arrowKinds = await import("../../../../vendor/ratorio/engine/const/EnumArrowKind.js");
    const jobIdConstants: Readonly<Record<string, unknown>> = await import("../../../../vendor/ratorio/engine/const/EnumJobId.js");
    const jobLines = await import("../../../../vendor/ratorio/engine/data/mig.job.h.js");
    const { GetJobName, IsMatchJobRestrict, GetLowerJobSeriesID, GetHigherJobSeriesID, IsDualArmsJob } = jobLines;
    const { ITEM_KIND_KNIFE, ITEM_KIND_SWORD, ITEM_KIND_AXE, ITEM_KIND_KATAR, ITEM_KIND_FUMA } = await import("../../../../vendor/ratorio/engine/const/EnumItemKind.js");
    const { g_constDataManager } = await import("../../../../vendor/ratorio/engine/runtime/global.js");
    const { CONST_DATA_KIND_JOB, CONST_DATA_KIND_ENCHANT_LIST } = await import("../../../../vendor/ratorio/engine/const/EnumConstDataKind.js");
    const { RebuildCardSelectSubCollectEnchListData } = await import("../../../../vendor/ratorio/engine/equip/hmcard.js");
    const { MigGetBorderFlagText } = await import("../../../../vendor/ratorio/engine/data/mig.itemsp.h.js");
    const { MIG_BORDER_FLAG_ID_OVER } = await import("../../../../vendor/ratorio/engine/const/EnumMigBorderFlagId.js");
    const { ItemObjNew, ITEM_ID_KAITEI_SHINDENNO_ZAIHO_CARD_ENCHANTABLE, ITEM_ID_ALPHA_CORE_CARD_ENCHANTABLE } = await import("../../../../vendor/ratorio/engine/equip/item.dat.js");
    const { CardObjNew, CardSortOBJ } = await import("../../../../vendor/ratorio/engine/equip/card.dat.js");
    const { MonsterObjNew } = await import("../../../../vendor/ratorio/engine/monster/monster.dat.js");
    const { SkillObjNew } = await import("../../../../vendor/ratorio/engine/skill/skill.dat.js");
    const { g_skillManager } = await import("../../../../vendor/ratorio/engine/runtime/global.js");
    const { ITEM_SP_TIME_OBJ: timedItemRows } = await import("../../../../vendor/ratorio/engine/equip/timeitem.dat.js");
    const { TIME_ITEM_DATA_INDEX_SRC_DATA_ARRAY } = await import("../../../../vendor/ratorio/engine/const/EnumTimeItemDataIndex.js");
    const { CSkillData } = await import("../../../../vendor/ratorio/engine/skill/CSkillManager.js");
    const { ITEM_DATA_INDEX_KIND, ITEM_DATA_INDEX_NAME, ITEM_DATA_INDEX_WPNLV, ITEM_DATA_INDEX_DETAIL, ITEM_DATA_INDEX_SPBEGIN, ITEM_DATA_INDEX_SLOT } = await import("../../../../vendor/ratorio/engine/const/EnumItemDataIndex.js");
    const { CARD_DATA_INDEX_NAME, CARD_DATA_INDEX_DETAIL, CARD_DATA_INDEX_SPBEGIN } = await import("../../../../vendor/ratorio/engine/const/EnumCardDataIndex.js");
    const monsterIndexes = await import("../../../../vendor/ratorio/engine/const/EnumMonsterDataIndex.js");
    const { MONSTER_DATA_INDEX_NAME } = monsterIndexes;
    const monsterElements = await import("../../../../vendor/ratorio/engine/const/EnumMonsterElement.js");
    const raceIds = await import("../../../../vendor/ratorio/engine/const/EnumRaceId.js");
    const sizeIds = await import("../../../../vendor/ratorio/engine/const/EnumSizeId.js");
    const { MONSTER_BOSSTYPE_BOSS } = await import("../../../../vendor/ratorio/engine/const/EnumMonsterBossType.js");
    const { SKILL_DATA_INDEX_NAME, SKILL_DATA_INDEX_MAXLV } = await import("../../../../vendor/ratorio/engine/const/EnumSkillDataIndex.js");
    const cardKinds = await import("../../../../vendor/ratorio/engine/const/EnumCardKind.js");
    const statPoints = await import("../../../../vendor/ratorio/engine/chara/hmjob.js");
    const { CostumeOBJ } = await import("../../../../vendor/ratorio/engine/equip/costume.dat.js");
    const costumeIndexes = await import("../../../../vendor/ratorio/engine/const/EnumCostumeDataIndex.js");
    const { COSTUME_KIND_HEAD_UNDER } = await import("../../../../vendor/ratorio/engine/const/EnumCostumeKind.js");

    // The card lists upstream sorts per kind of socket, as its page lists them.
    const sortedCardIdsOfKinds = (...kinds: number[]) => [...new Set(kinds.flatMap((kind) => CardSortOBJ[kind] ?? []))];
    const cardIdsOfFirstSocket: Readonly<Partial<Record<EquipmentSlot, readonly number[]>>> = {
        rightHand: sortedCardIdsOfKinds(cardKinds.CARD_KIND_NONE),
        leftHand: sortedCardIdsOfKinds(cardKinds.CARD_KIND_NONE),
        headTop: sortedCardIdsOfKinds(cardKinds.CARD_KIND_HEAD, cardKinds.CARD_KIND_TOP),
        headMid: sortedCardIdsOfKinds(cardKinds.CARD_KIND_HEAD, cardKinds.CARD_KIND_MID),
        shield: sortedCardIdsOfKinds(cardKinds.CARD_KIND_SHIELD),
        armor: sortedCardIdsOfKinds(cardKinds.CARD_KIND_BODY),
        garment: sortedCardIdsOfKinds(cardKinds.CARD_KIND_SHOULDER),
        shoes: sortedCardIdsOfKinds(cardKinds.CARD_KIND_FOOT),
        accessory1: sortedCardIdsOfKinds(cardKinds.CARD_KIND_ACCESSORY, cardKinds.CARD_KIND_ACCESSORY_ON1),
        accessory2: sortedCardIdsOfKinds(cardKinds.CARD_KIND_ACCESSORY, cardKinds.CARD_KIND_ACCESSORY_ON2),
    };
    const cardIdsOfLaterWeaponSockets = sortedCardIdsOfKinds(cardKinds.CARD_KIND_ARMS);
    const tensOf = (elementValue: number) => Math.floor(elementValue / 10);
    const elementKindOfTens = new Map<number, MonsterElementKind>([
        [tensOf(monsterElements.MONSTER_ELM_VANITY_1), "neutral"],
        [tensOf(monsterElements.MONSTER_ELM_WATER_1), "water"],
        [tensOf(monsterElements.MONSTER_ELM_EARTH_1), "earth"],
        [tensOf(monsterElements.MONSTER_ELM_FIRE_1), "fire"],
        [tensOf(monsterElements.MONSTER_ELM_WIND_1), "wind"],
        [tensOf(monsterElements.MONSTER_ELM_POISON_1), "poison"],
        [tensOf(monsterElements.MONSTER_ELM_HOLY_1), "holy"],
        [tensOf(monsterElements.MONSTER_ELM_DARK_1), "dark"],
        [tensOf(monsterElements.MONSTER_ELM_PSYCO_1), "ghost"],
        [tensOf(monsterElements.MONSTER_ELM_UNDEAD_1), "undead"],
    ]);
    const raceOfId = new Map<number, MonsterRace>([
        [raceIds.RACE_ID_SOLID, "formless"],
        [raceIds.RACE_ID_UNDEAD, "undead"],
        [raceIds.RACE_ID_ANIMAL, "animal"],
        [raceIds.RACE_ID_PLANT, "plant"],
        [raceIds.RACE_ID_INSECT, "insect"],
        [raceIds.RACE_ID_FISH, "fish"],
        [raceIds.RACE_ID_DEMON, "demon"],
        [raceIds.RACE_ID_HUMAN, "human"],
        [raceIds.RACE_ID_ANGEL, "angel"],
        [raceIds.RACE_ID_DRAGON, "dragon"],
    ]);
    const sizeOfId = new Map<number, MonsterSize>([
        [sizeIds.SIZE_ID_SMALL, "small"],
        [sizeIds.SIZE_ID_MEDIUM, "medium"],
        [sizeIds.SIZE_ID_LARGE, "large"],
    ]);
    const weaponHands: readonly EquipmentSlot[] = ["rightHand", "leftHand"];
    // Two items take a card of their slot in the last socket, as an enchant.
    const itemIdsWithACardInTheLastSocket = [ITEM_ID_KAITEI_SHINDENNO_ZAIHO_CARD_ENCHANTABLE, ITEM_ID_ALPHA_CORE_CARD_ENCHANTABLE];

    function cardIdsAt(slot: EquipmentSlot, itemId: number, socketIndex: number): readonly number[] {
        if (weaponHands.includes(slot)) {
            return socketIndex === 0 ? (cardIdsOfFirstSocket[slot] ?? []) : cardIdsOfLaterWeaponSockets;
        }
        const takesACard = socketIndex === 0 || (socketIndex === socketsPerGearPiece - 1 && itemIdsWithACardInTheLastSocket.includes(itemId));
        return takesACard ? (cardIdsOfFirstSocket[slot] ?? []) : [];
    }

    const cardEntriesOfList = new Map<readonly number[], CatalogEntry[]>();
    function cardEntriesOf(cardIds: readonly number[]): CatalogEntry[] {
        let entries = cardEntriesOfList.get(cardIds);
        if (entries === undefined) {
            entries = cardIds.flatMap((cardId): CatalogEntry[] => {
                const name = CardObjNew[cardId]?.[CARD_DATA_INDEX_NAME];
                return cardId !== 0 && typeof name === "string" && name !== "" ? [{ id: cardId, name }] : [];
            });
            cardEntriesOfList.set(cardIds, entries);
        }
        return entries;
    }

    /** The enchants of every enchant list the item takes, per socket as upstream numbers them: always four. */
    const enchantEntriesOfItem = new Map<number, CatalogEntry[][]>();
    function enchantEntriesOf(itemId: number): CatalogEntry[][] {
        const known = enchantEntriesOfItem.get(itemId);
        if (known !== undefined) {
            return known;
        }
        let offersOfSocket: UpstreamEnchantOffer[][] = Array.from({ length: socketsPerGearPiece }, () => []);
        for (const enchantListId of g_constDataManager.GetDataManger(CONST_DATA_KIND_ENCHANT_LIST).GetEnchListIdArrayByItemId(itemId)) {
            const offersOfList = RebuildCardSelectSubCollectEnchListData(enchantListId, offersOfSocket);
            offersOfSocket = offersOfSocket.map((offers, socketIndex) => [...offers, ...(offersOfList[socketIndex] ?? [])]);
        }
        const entriesOfSocket = offersOfSocket.map((offers) => {
            const entryOfCardId = new Map<number, CatalogEntry>();
            for (const [enchantListId, cardId, { refinedBorderBase, refinedBorderFlag }] of offers) {
                const name = CardObjNew[cardId]?.[CARD_DATA_INDEX_NAME];
                if (entryOfCardId.has(cardId) || typeof name !== "string") {
                    continue;
                }
                const asksForARefine = Boolean(refinedBorderBase) && Boolean(refinedBorderFlag) && !(refinedBorderBase === 0 && refinedBorderFlag === MIG_BORDER_FLAG_ID_OVER);
                entryOfCardId.set(cardId, {
                    id: cardId,
                    name: asksForARefine ? `${name} (+${refinedBorderBase}${MigGetBorderFlagText(refinedBorderFlag ?? 0, true)})` : name,
                    detail: g_constDataManager.GetName(CONST_DATA_KIND_ENCHANT_LIST, enchantListId),
                });
            }
            return [...entryOfCardId.values()];
        });
        enchantEntriesOfItem.set(itemId, entriesOfSocket);
        return entriesOfSocket;
    }

    function namedEntries(
        dataRows: readonly (readonly unknown[] | undefined)[],
        namePosition: number,
        isListed: (dataRow: readonly unknown[], id: number) => boolean,
    ): CatalogEntry[] {
        const entries: CatalogEntry[] = [];
        dataRows.forEach((dataRow, id) => {
            const name = dataRow?.[namePosition];
            if (dataRow !== undefined && typeof name === "string" && name !== "" && isListed(dataRow, id)) {
                entries.push({ id, name });
            }
        });
        return entries;
    }

    const jobData = (jobId: number) => g_constDataManager.GetDataObject(CONST_DATA_KIND_JOB, jobId);

    function skillLevelSettings(skillIds: readonly number[], highestLevelFor: (skillId: number, highestSkillLevel: number) => number): SkillLevelSetting[] {
        return skillIds.flatMap((skillId) => {
            const name = SkillObjNew[skillId]?.[SKILL_DATA_INDEX_NAME];
            const highestLevel = SkillObjNew[skillId]?.[SKILL_DATA_INDEX_MAXLV];
            return typeof name === "string" && typeof highestLevel === "number"
                ? [{ id: skillId, name, highestLevel: highestLevelFor(skillId, highestLevel) }]
                : [];
        });
    }

    const timedItemEntries = ITEM_SP_TIME_OBJ_SORT.flatMap((timedItemId): CatalogEntry[] => {
        const description = names.describeTimedItem(timedItemId);
        return description === undefined ? [] : [{ id: timedItemId, name: description.name, detail: description.effectText }];
    });

    function leftHandItemKindsOfJob(jobId: number, rightHandItemId?: number): number[] {
        if (jobData(jobId) === null || !IsDualArmsJob(jobId)) {
            return [];
        }
        const isOfTheAssassinLine = GetHigherJobSeriesID(jobId) === jobLines.JOB_SERIES_ID_ASSASIN;
        const rightHandKind = rightHandItemId === undefined ? undefined : ItemObjNew[rightHandItemId]?.[ITEM_DATA_INDEX_KIND];
        if (rightHandKind === (isOfTheAssassinLine ? ITEM_KIND_KATAR : ITEM_KIND_FUMA)) {
            return [];
        }
        return isOfTheAssassinLine ? [ITEM_KIND_KNIFE, ITEM_KIND_SWORD, ITEM_KIND_AXE] : [ITEM_KIND_KNIFE];
    }

    type NamedItem = { readonly id: number; readonly name: string; readonly socketCount: number };
    let itemsOfNameKey: Map<string, NamedItem[]> | undefined;

    /** Every item under its name as names are compared, built the first time a name is asked for. */
    function itemsByNameKey(): Map<string, NamedItem[]> {
        const byNameKey = new Map<string, NamedItem[]>();
        const keyOf = (name: string) => name.normalize("NFKC").toLowerCase().replaceAll(/\s+/g, "").replace(/\[\d\]$/, "");
        ItemObjNew.forEach((dataRow, id) => {
            const name = dataRow?.[ITEM_DATA_INDEX_NAME];
            const socketCount = dataRow?.[ITEM_DATA_INDEX_SLOT];
            if (typeof name === "string" && name !== "") {
                byNameKey.set(keyOf(name), [...(byNameKey.get(keyOf(name)) ?? []), { id, name, socketCount: typeof socketCount === "number" ? socketCount % 10 : 0 }]);
            }
        });
        // A retired item keeps its name; the one in use is the one a listing means.
        const isRetired = (item: NamedItem) => item.name.includes("廃止");
        for (const [nameKey, items] of byNameKey) {
            byNameKey.set(nameKey, [...items.filter((item) => !isRetired(item)), ...items.filter(isRetired)]);
        }
        return byNameKey;
    }

    /**
     * A data row lists its effects as pairs of an effect ID and a value from
     * a fixed position on, ended by a 0, and has a line of free text besides.
     */
    function effectsOfDataRow(dataRow: readonly unknown[] | undefined, firstEffectPosition: number, detailPosition: number): string[] {
        if (dataRow === undefined) {
            return [];
        }
        const effects: string[] = [];
        for (let position = firstEffectPosition; position + 1 < dataRow.length; position += 2) {
            const effectId = dataRow[position];
            const effectValue = dataRow[position + 1];
            // An effect with conditions packs them into an ID too large for a number.
            const isIdOrValue = (value: unknown): value is number | bigint => typeof value === "number" || typeof value === "bigint";
            if (!isIdOrValue(effectId) || effectId === 0 || !isIdOrValue(effectValue)) {
                break;
            }
            const line = GetItemExplainText(effectId, effectValue)
                .map(([, text]) => text)
                .join("")
                .replaceAll(/\s+/g, " ")
                .trim();
            if (line !== "") {
                effects.push(line);
            }
        }
        const detail = dataRow[detailPosition];
        if (typeof detail === "string" && detail !== "" && detail !== "0") {
            effects.push(...detail.split(/<br\s*\/?>/i).map((line) => line.trim()).filter((line) => line !== ""));
        }
        return effects;
    }

    return {
        limitsOfJob(jobId, isAdopted = false) {
            if (jobData(jobId) === null) {
                return undefined;
            }
            const lowestBaseLevel = jobLines.GetBaseLevelMin(jobId);
            return {
                baseLevel: { lowest: lowestBaseLevel, highest: jobLines.GetBaseLevelMax(jobId) },
                jobLevel: { lowest: 1, highest: jobLines.GetJobLevelMax(jobId) },
                baseStat: { lowest: 1, highest: jobLines.GetStatusMax(jobId, isAdopted) },
                traitStat: lowestBaseLevel >= lowestBaseLevelOfAFourthJob ? { lowest: 0, highest: highestTraitStat } : null,
            };
        },
        jobs() {
            const jobIds = new Set<number>();
            for (const [constantName, jobId] of Object.entries(jobIdConstants)) {
                if (constantName.startsWith(jobIdNamePrefix) && typeof jobId === "number" && jobData(jobId) !== null) {
                    jobIds.add(jobId);
                }
            }
            return [...jobIds].sort((oneJobId, otherJobId) => oneJobId - otherJobId).map((jobId) => ({ id: jobId, name: GetJobName(jobId) }));
        },
        statPointsOf({ jobId, baseLevel, baseStats, traitStats }, isAdopted = false) {
            if (jobData(jobId) === null) {
                return undefined;
            }
            let earned = jobLines.IsReincarnatedJob(jobId) && !isAdopted ? startingStatPointsOfARebornJob : startingStatPoints;
            for (let level = 1; level <= baseLevel; level++) {
                earned += statPoints.GetEarningStatusPoint(level);
            }
            return {
                earned,
                spent: Object.values(baseStats).reduce((spent, statValue) => spent + statPoints.GetStatusTotalCost(statValue), 0),
                traitEarned: jobLines.IsYojiJob(jobId) ? statPoints.GetEarningTSStatusPoint(baseLevel) : 0,
                traitSpent: Object.values(traitStats ?? {}).reduce((spent, statValue) => spent + statValue, 0),
            };
        },
        leftHandItemKindsOfJob,
        learnedSkillsGearRewards(itemIds, cardOrEnchantIds) {
            const skillIds = new Set<number>();
            const collectFrom = (dataRow: readonly unknown[] | undefined, firstEffectPosition: number) => {
                for (let position = firstEffectPosition; dataRow !== undefined && position + 1 < dataRow.length && dataRow[position] !== 0; position += 2) {
                    const skillId = dataRow[position + 1];
                    if (dataRow[position] === ITEM_SP_LEARNED_SKILL_EFFECT && typeof skillId === "number") {
                        skillIds.add(skillId);
                    }
                }
            };
            itemIds.forEach((itemId) => collectFrom(ItemObjNew[itemId], ITEM_DATA_INDEX_SPBEGIN));
            cardOrEnchantIds.forEach((cardOrEnchantId) => collectFrom(CardObjNew[cardOrEnchantId], CARD_DATA_INDEX_SPBEGIN));
            return [...skillIds].sort((oneSkillId, otherSkillId) => oneSkillId - otherSkillId);
        },
        wordingOfRandomOption(optionId, value) {
            const effectId = g_rndOptArray[optionId]?.[RND_OPT_DATA_INDEX_SPID];
            return effectId === undefined
                ? ""
                : GetItemExplainText(effectId, value)
                      .map(([, text]) => text)
                      .join("")
                      .trim();
        },
        wordingOfBonus(bonusName, value) {
            const effectId: unknown = Reflect.get(itemSpIds, `ITEM_SP_${bonusName}`);
            if (typeof effectId !== "number") {
                return "";
            }
            try {
                return GetItemExplainText(effectId, value)
                    .map(([, text]) => text)
                    .join("")
                    .trim();
            } catch {
                // Some effects take a skill or an item as their value, which a summed bonus is not; those have no wording.
                return "";
            }
        },
        itemsNamed(nameKey) {
            itemsOfNameKey ??= itemsByNameKey();
            return itemsOfNameKey.get(nameKey) ?? [];
        },
        spCostOfSkill(skillId, skillLevel, costChanges) {
            if (SkillObjNew[skillId] === undefined) {
                return 0;
            }
            const ownCost = g_skillManager.GetCostFixed(skillId, skillLevel, null);
            if (ownCost <= 0) {
                return 0;
            }
            // Upstream's cast simulator rounds up before it divides by 100 here, and only at the end after that.
            let cost = Math.max(1, ownCost + costChanges.flat);
            cost = Math.max(1, Math.ceil(cost * costChanges.percentOfThisSkill) / 100);
            return Math.max(1, Math.ceil((cost * costChanges.percentOfEverySkill) / 100));
        },
        damageKindOfSkill(skillId) {
            if (SkillObjNew[skillId] === undefined) {
                return "neither";
            }
            const skillType = g_skillManager.GetSkillType(skillId);
            if ((skillType & CSkillData.TYPE_MAGICAL) !== 0) {
                return "magical";
            }
            return (skillType & CSkillData.TYPE_PHYSICAL) !== 0 ? "physical" : "neither";
        },
        sourcesOfTimedItem(timedItemId) {
            const sourcePairs = timedItemRows[timedItemId]?.[TIME_ITEM_DATA_INDEX_SRC_DATA_ARRAY];
            if (!Array.isArray(sourcePairs)) {
                return [];
            }
            const kindOfNumber: Readonly<Record<number, "item" | "cardOrEnchant">> = { 1: "item", 2: "cardOrEnchant" };
            return sourcePairs.flatMap((pair: unknown) => {
                const [kindNumber, id] = Array.isArray(pair) ? pair : [];
                const kind = typeof kindNumber === "number" ? kindOfNumber[kindNumber] : undefined;
                return kind === undefined || typeof id !== "number" ? [] : [{ kind, id }];
            });
        },
        effectsOfItem: (itemId) => effectsOfDataRow(ItemObjNew[itemId], ITEM_DATA_INDEX_SPBEGIN, ITEM_DATA_INDEX_DETAIL),
        effectsOfCardOrEnchant: (cardOrEnchantId) => effectsOfDataRow(CardObjNew[cardOrEnchantId], CARD_DATA_INDEX_SPBEGIN, CARD_DATA_INDEX_DETAIL),
        itemsForSlot(slot, jobId) {
            if (jobData(jobId) === null) {
                return [];
            }
            const itemKinds = slot === "leftHand" ? leftHandItemKindsOfJob(jobId) : itemKindsOfSlot[slot];
            return namedEntries(
                ItemObjNew,
                ITEM_DATA_INDEX_NAME,
                (dataRow, itemId) => itemKinds.includes(dataRow[ITEM_DATA_INDEX_KIND] as number) && itemId !== emptyItemIdOfSlot[slot] && IsMatchJobRestrict(itemId, jobId),
            );
        },
        socketChoicesOfItem(slot, itemId) {
            const enchantsOfSocket = enchantEntriesOf(itemId);
            if (isShadowSlot(slot)) {
                // Upstream numbers a shadow piece's three sockets as the second to the fourth of four.
                return enchantsOfSocket.slice(socketsPerGearPiece - socketCountOfSlot(slot));
            }
            return enchantsOfSocket.map((enchants, socketIndex) => (enchants.length > 0 ? enchants : cardEntriesOf(cardIdsAt(slot, itemId, socketIndex))));
        },
        monsters: () => namedEntries(MonsterObjNew, MONSTER_DATA_INDEX_NAME, () => true),
        monsterInfo(monsterId) {
            const dataRow = MonsterObjNew[monsterId];
            const name = dataRow?.[MONSTER_DATA_INDEX_NAME];
            if (dataRow === undefined || typeof name !== "string") {
                return undefined;
            }
            const numberAt = (index: number) => Number(dataRow[index] ?? 0);
            // Upstream writes an element as its kind in the tens and its level in the ones (water 2 is 12).
            const elementValue = numberAt(monsterIndexes.MONSTER_DATA_INDEX_ELEMENT);
            return {
                id: monsterId,
                name,
                level: numberAt(monsterIndexes.MONSTER_DATA_INDEX_LEVEL),
                hp: numberAt(monsterIndexes.MONSTER_DATA_INDEX_HP),
                element: { kind: elementKindOfTens.get(Math.floor(elementValue / 10)) ?? "neutral", level: elementValue % 10 },
                race: raceOfId.get(numberAt(monsterIndexes.MONSTER_DATA_INDEX_RACE)) ?? "formless",
                size: sizeOfId.get(numberAt(monsterIndexes.MONSTER_DATA_INDEX_SIZE)) ?? "medium",
                isBoss: numberAt(monsterIndexes.MONSTER_DATA_INDEX_BOSS_TYPE) === MONSTER_BOSSTYPE_BOSS,
                hardDef: numberAt(monsterIndexes.MONSTER_DATA_INDEX_DEF_DIV),
                hardMdef: numberAt(monsterIndexes.MONSTER_DATA_INDEX_MDEF_DIV),
                res: numberAt(monsterIndexes.MONSTER_DATA_INDEX_RES),
                mres: numberAt(monsterIndexes.MONSTER_DATA_INDEX_MRES),
                baseExp: numberAt(monsterIndexes.MONSTER_DATA_INDEX_BASE_EXP),
                jobExp: numberAt(monsterIndexes.MONSTER_DATA_INDEX_JOB_EXP),
            };
        },
        attackSkillsOfJob(jobId) {
            const skillIds = jobData(jobId)?.GetAttackSkillIdArray() ?? [];
            return skillIds.flatMap((skillId) => {
                const name = SkillObjNew[skillId]?.[SKILL_DATA_INDEX_NAME];
                return typeof name === "string" ? [{ id: skillId, name }] : [];
            });
        },
        learnableSkillsOfJob: (jobId) =>
            skillLevelSettings(jobData(jobId)?.GetLearnSkillIdArray() ?? [], (_skillId, highestSkillLevel) => highestSkillLevel),
        selfBuffsOfJob: (jobId) =>
            (jobData(jobId)?.GetPassiveSkillIdArray() ?? []).flatMap((skillId): SkillLevelSetting[] => {
                const name = SkillObjNew[skillId]?.[SKILL_DATA_INDEX_NAME];
                const definition = selfBuffDefinitionOf(panelDefinitions, jobId, skillId);
                if (typeof name !== "string" || definition === undefined) {
                    return [];
                }
                const choices = choicesOf(definition);
                return [{ id: skillId, name, highestLevel: definition.highest, ...(choices === undefined ? {} : { choices }) }];
            }),
        supportBuffs: () => supportBuffSettings,
        costumesOfJob(jobId) {
            const job = jobData(jobId);
            if (job === null) {
                return [];
            }
            return CostumeOBJ.flatMap((dataRow): (CatalogEntry & { readonly reading: string })[] => {
                const id = dataRow?.[costumeIndexes.COSTUME_DATA_INDEX_ID];
                const name = dataRow?.[costumeIndexes.COSTUME_DATA_INDEX_NAME];
                const isOffered =
                    typeof id === "number" &&
                    id !== 0 &&
                    typeof name === "string" &&
                    dataRow?.[costumeIndexes.COSTUME_DATA_INDEX_KIND] === COSTUME_KIND_HEAD_UNDER &&
                    job.IsEquipableEquipFlag(Number(dataRow[costumeIndexes.COSTUME_DATA_INDEX_EQPFLG]));
                return isOffered ? [{ id, name, reading: String(dataRow[costumeIndexes.COSTUME_DATA_INDEX_KANA]), detail: String(dataRow[costumeIndexes.COSTUME_DATA_INDEX_DETAIL] ?? "").replaceAll(/<BR>/gi, " ") }] : [];
            })
                .sort((oneCostume, otherCostume) => (oneCostume.reading < otherCostume.reading ? -1 : oneCostume.reading > otherCostume.reading ? 1 : 0))
                .map(({ reading: _reading, ...entry }) => entry);
        },
        autoSpells: () => [...autoSpells.entries],
        autoSpellChances: () => [...autoSpells.chancesPerMille],
        customizations: () => ({
            status: customizations.status.settings,
            attack: customizations.attack.settings,
            defense: customizations.defense.settings,
            skill: customizations.skill.settings,
            traitStatus: customizations.traitStatus.settings,
        }),
        targetSettings: () => ({ asPlayer: targetSettings.asPlayer.settings, ailments: targetSettings.ailments.settings, buffs: targetSettings.buffs.settings }),
        positionalBuffs: (panel) => positionalBuffSettingsOf(panelDefinitions, panel),
        timedItems: () => [...timedItemEntries],
        speedPotions: () =>
            SpeedPotName.flatMap((_name, speedPotion) => {
                const name = names.speedPotionName(speedPotion);
                return name === undefined ? [] : [{ id: speedPotion, name }];
            }),
        weaponElements: () =>
            Array.from({ length: ELM_ID_COUNT }, (_unused, elementId) => elementId).flatMap((elementId) => {
                const name = names.elementName(elementId);
                return name === undefined ? [] : [{ id: elementId, name }];
            }),
        arrowsOfJob(jobId) {
            if (jobData(jobId) === null) {
                return [];
            }
            const jobLine = GetLowerJobSeriesID(jobId);
            const offeredKind = [jobLines.JOB_SERIES_ID_THIEF, jobLines.JOB_SERIES_ID_ARCHER].includes(jobLine)
                ? arrowKinds.ARROW_KIND_ARROW
                : jobLine === jobLines.JOB_SERIES_ID_GUNSLINGER
                  ? arrowKinds.ARROW_KIND_BULLET
                  : undefined;
            const entries: (CatalogEntry & { readonly reading: string })[] = [];
            ArrowOBJNew.forEach((dataRow, arrowId) => {
                const description = names.describeArrow(arrowId);
                if (description !== undefined && dataRow?.[ARROW_DATA_INDEX_KIND] === offeredKind) {
                    entries.push({ id: arrowId, name: description.name, detail: description.effectText, reading: String(dataRow?.[ARROW_DATA_INDEX_KANA] ?? "") });
                }
            });
            return entries
                .sort((oneArrow, otherArrow) => (oneArrow.reading < otherArrow.reading ? -1 : oneArrow.reading > otherArrow.reading ? 1 : 0))
                .map(({ reading: _reading, ...entry }) => entry);
        },
        randomOptionsOfItem(itemId) {
            const weaponLevelField = ItemObjNew[itemId]?.[ITEM_DATA_INDEX_WPNLV];
            const listIdOfPosition = (typeof weaponLevelField === "number" ? g_rndOptTypeArray[GetRndOptTypeId(weaponLevelField)]?.[1] : undefined) ?? [];
            return Array.from({ length: randomOptionsPerGearPiece }, (_unused, position) =>
                (g_rndOptListArray[listIdOfPosition[position] ?? 0]?.[1] ?? []).flatMap((optionId): CatalogEntry[] => {
                    const name = names.randomOptionName(optionId);
                    const dataRow = g_rndOptArray[optionId];
                    if (name === undefined || dataRow === undefined) {
                        return [];
                    }
                    const range = {
                        lowest: dataRow[RND_OPT_DATA_INDEX_MIN] ?? 0,
                        highest: dataRow[RND_OPT_DATA_INDEX_MAX] ?? 0,
                        step: dataRow[RND_OPT_DATA_INDEX_STEP] ?? 1,
                    };
                    return [{ id: optionId, name, detail: `${range.lowest}〜${range.highest}`, range }];
                }),
            );
        },
        slotsOfItem(itemId) {
            const itemKind = ItemObjNew[itemId]?.[ITEM_DATA_INDEX_KIND];
            return equipmentSlots.filter((slot) => typeof itemKind === "number" && itemKindsOfSlot[slot].includes(itemKind));
        },
    };
}
