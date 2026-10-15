/** A piece of gear, a card or an enchant as upstream names and describes it. */
export interface ItemDescription {
    readonly name: string;
    readonly effectText: string;
}

/** Upstream's Japanese names. Each lookup returns `undefined` for an ID the engine does not have. */
export interface EngineNames {
    jobName(jobId: number): string | undefined;
    skillName(skillId: number): string | undefined;
    monsterName(monsterId: number): string | undefined;
    describeItem(itemId: number): ItemDescription | undefined;
    describeCardOrEnchant(cardOrEnchantId: number): ItemDescription | undefined;
    /** The name of the effect a random option gives, for example "ATK+". */
    randomOptionName(optionId: number): string | undefined;
    /** A time-limited effect of gear, a card or a consumable. */
    describeTimedItem(timedItemId: number): ItemDescription | undefined;
    speedPotionName(speedPotion: number): string | undefined;
    elementName(elementId: number): string | undefined;
    /** An arrow, a bullet or other ammunition. */
    describeArrow(arrowId: number): ItemDescription | undefined;
}

export async function loadEngineNames(): Promise<EngineNames> {
    const { ItemObjNew } = await import("../../../../vendor/ratorio/engine/equip/item.dat.js");
    const { CardObjNew } = await import("../../../../vendor/ratorio/engine/equip/card.dat.js");
    const { MonsterObjNew } = await import("../../../../vendor/ratorio/engine/monster/monster.dat.js");
    const { SkillObjNew } = await import("../../../../vendor/ratorio/engine/skill/skill.dat.js");
    const { ITEM_DATA_INDEX_NAME, ITEM_DATA_INDEX_DETAIL } = await import(
        "../../../../vendor/ratorio/engine/const/EnumItemDataIndex.js"
    );
    const { CARD_DATA_INDEX_NAME, CARD_DATA_INDEX_DETAIL } = await import(
        "../../../../vendor/ratorio/engine/const/EnumCardDataIndex.js"
    );
    const { MONSTER_DATA_INDEX_NAME } = await import("../../../../vendor/ratorio/engine/const/EnumMonsterDataIndex.js");
    const { SKILL_DATA_INDEX_NAME } = await import("../../../../vendor/ratorio/engine/const/EnumSkillDataIndex.js");
    const { GetJobName } = await import("../../../../vendor/ratorio/engine/data/mig.job.h.js");
    const { g_rndOptArray } = await import("../../../../vendor/ratorio/engine/equip/rndopt.dat.js");
    const { ITEM_SP_TIME_OBJ } = await import("../../../../vendor/ratorio/engine/equip/timeitem.dat.js");
    const { TIME_ITEM_DATA_INDEX_NAME, TIME_ITEM_DATA_INDEX_EXPLAIN } = await import("../../../../vendor/ratorio/engine/const/EnumTimeItemDataIndex.js");
    const { SpeedPotName } = await import("../../../../vendor/ratorio/engine/runtime/roro-state.js");
    const { GetElementText } = await import("../../../../vendor/ratorio/engine/runtime/common.js");
    const { ELM_ID_COUNT } = await import("../../../../vendor/ratorio/engine/const/EnumElmId.js");
    const { ArrowOBJNew, ARROW_ID_NONE } = await import("../../../../vendor/ratorio/engine/equip/arrow.dat.js");
    const { ARROW_DATA_INDEX_NAME, ARROW_DATA_INDEX_DETAIL } = await import("../../../../vendor/ratorio/engine/const/EnumArrowDataIndex.js");
    const { GetRndOptDispName } = await import("../../../../vendor/ratorio/engine/equip/rndopt.h.js");
    const { RND_OPT_DATA_INDEX_SPID } = await import("../../../../vendor/ratorio/engine/const/EnumRndOptDataIndex.js");

    const textAt = (dataRow: readonly unknown[] | undefined, position: number): string | undefined => {
        const text = dataRow?.[position];
        return typeof text === "string" ? text : undefined;
    };
    const describe = (
        dataRow: readonly unknown[] | undefined,
        namePosition: number,
        detailPosition: number,
    ): ItemDescription | undefined => {
        const name = textAt(dataRow, namePosition);
        return name === undefined ? undefined : { name, effectText: textAt(dataRow, detailPosition) ?? "" };
    };

    return {
        jobName(jobId) {
            try {
                return GetJobName(jobId);
            } catch {
                return undefined;
            }
        },
        skillName: (skillId) => textAt(SkillObjNew[skillId], SKILL_DATA_INDEX_NAME),
        monsterName: (monsterId) => textAt(MonsterObjNew[monsterId], MONSTER_DATA_INDEX_NAME),
        describeItem: (itemId) => describe(ItemObjNew[itemId], ITEM_DATA_INDEX_NAME, ITEM_DATA_INDEX_DETAIL),
        describeCardOrEnchant: (cardOrEnchantId) =>
            describe(CardObjNew[cardOrEnchantId], CARD_DATA_INDEX_NAME, CARD_DATA_INDEX_DETAIL),
        describeTimedItem: (timedItemId) =>
            timedItemId > 0 ? describe(ITEM_SP_TIME_OBJ[timedItemId], TIME_ITEM_DATA_INDEX_NAME, TIME_ITEM_DATA_INDEX_EXPLAIN) : undefined,
        speedPotionName: (speedPotion) => (Number.isInteger(speedPotion) && speedPotion > 0 ? SpeedPotName[speedPotion] : undefined),
        elementName(elementId) {
            const name = Number.isInteger(elementId) && elementId >= 0 && elementId < ELM_ID_COUNT ? GetElementText(elementId) : undefined;
            return typeof name === "string" && name !== "" ? name : undefined;
        },
        describeArrow: (arrowId) => (arrowId === ARROW_ID_NONE ? undefined : describe(ArrowOBJNew[arrowId], ARROW_DATA_INDEX_NAME, ARROW_DATA_INDEX_DETAIL)),
        randomOptionName(optionId) {
            const effectId = optionId > 0 ? g_rndOptArray[optionId]?.[RND_OPT_DATA_INDEX_SPID] : undefined;
            const name = effectId === undefined ? undefined : GetRndOptDispName(effectId);
            return typeof name === "string" && name !== "" ? name : undefined;
        },
    };
}
