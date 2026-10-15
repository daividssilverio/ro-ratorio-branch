import { type TextKind, textKinds } from "../text/text-kinds.ts";

export { type TextKind, textKinds };

/** One upstream name, with what upstream has besides it. */
export interface TextSource {
    readonly id: number;
    readonly name: string;
    /** Upstream's kana sort key of the name, where it has one. It drops voicing marks, so it is a check on a reading, not a reading. */
    readonly sortKey?: string;
    /** Upstream's own identifier for it, where it has one: a skill's constant name without its SKILL_ID_ prefix. */
    readonly code?: string;
    /** The game's own identifier for a skill, such as NC_ARMSCANNON, where upstream records it. */
    readonly gameCode?: string;
}

/** Every name of every kind, for building the text index. Not for the app, which gets names per screen. */
export async function loadTextSources(): Promise<Record<TextKind, TextSource[]>> {
    const { ItemObjNew } = await import("../../../../vendor/ratorio/engine/equip/item.dat.js");
    const { CardObjNew } = await import("../../../../vendor/ratorio/engine/equip/card.dat.js");
    const { MonsterObjNew } = await import("../../../../vendor/ratorio/engine/monster/monster.dat.js");
    const skills: Readonly<Record<string, unknown>> = await import("../../../../vendor/ratorio/engine/skill/skill.dat.js");
    const { ITEM_SP_TIME_OBJ } = await import("../../../../vendor/ratorio/engine/equip/timeitem.dat.js");
    const itemIndexes = await import("../../../../vendor/ratorio/engine/const/EnumItemDataIndex.js");
    const cardIndexes = await import("../../../../vendor/ratorio/engine/const/EnumCardDataIndex.js");
    const monsterIndexes = await import("../../../../vendor/ratorio/engine/const/EnumMonsterDataIndex.js");
    const { SKILL_DATA_INDEX_NAME, SKILL_DATA_INDEX_REFID } = await import("../../../../vendor/ratorio/engine/const/EnumSkillDataIndex.js");
    const { TIME_ITEM_DATA_INDEX_NAME } = await import("../../../../vendor/ratorio/engine/const/EnumTimeItemDataIndex.js");
    const jobIds: Readonly<Record<string, unknown>> = await import("../../../../vendor/ratorio/engine/const/EnumJobId.js");
    const { GetJobName } = await import("../../../../vendor/ratorio/engine/data/mig.job.h.js");

    const fromRows = (dataRows: readonly (readonly unknown[] | undefined)[], namePosition: number, sortKeyPosition?: number): TextSource[] =>
        dataRows.flatMap((dataRow, id): TextSource[] => {
            const name = dataRow?.[namePosition];
            const sortKey = sortKeyPosition === undefined ? undefined : dataRow?.[sortKeyPosition];
            return typeof name === "string" && name !== "" ? [{ id, name, ...(typeof sortKey === "string" && sortKey !== "" ? { sortKey } : {}) }] : [];
        });

    const skillIdPrefix = "SKILL_ID_";
    const codeOfSkillId = new Map<number, string>();
    for (const [constantName, skillId] of Object.entries(skills)) {
        // The engine's internal parts of a plain attack share IDs past the real skills; the first name of an ID is its own.
        if (constantName.startsWith(skillIdPrefix) && typeof skillId === "number" && !codeOfSkillId.has(skillId)) {
            codeOfSkillId.set(skillId, constantName.slice(skillIdPrefix.length));
        }
    }
    const skillRows = skills["SkillObjNew"] as readonly (readonly unknown[] | undefined)[];

    const jobIdPrefix = "JOB_ID_";
    const jobs = new Map<number, TextSource>();
    for (const [constantName, jobId] of Object.entries(jobIds)) {
        if (constantName.startsWith(jobIdPrefix) && typeof jobId === "number" && !jobs.has(jobId)) {
            try {
                jobs.set(jobId, { id: jobId, name: GetJobName(jobId), code: constantName.slice(jobIdPrefix.length) });
            } catch {
                // A constant for a job the engine has no data for.
            }
        }
    }

    return {
        item: fromRows(ItemObjNew, itemIndexes.ITEM_DATA_INDEX_NAME, itemIndexes.ITEM_DATA_INDEX_KANA),
        cardOrEnchant: fromRows(CardObjNew, cardIndexes.CARD_DATA_INDEX_NAME, cardIndexes.CARD_DATA_INDEX_KANA),
        monster: fromRows(MonsterObjNew, monsterIndexes.MONSTER_DATA_INDEX_NAME, monsterIndexes.MONSTER_DATA_INDEX_KANA),
        skill: fromRows(skillRows, SKILL_DATA_INDEX_NAME).map((source) => {
            const code = codeOfSkillId.get(source.id);
            const gameCode = skillRows[source.id]?.[SKILL_DATA_INDEX_REFID];
            return { ...source, ...(code === undefined ? {} : { code }), ...(typeof gameCode === "string" && gameCode !== "" ? { gameCode } : {}) };
        }),
        job: [...jobs.values()].sort((oneJob, otherJob) => oneJob.id - otherJob.id),
        timedItem: fromRows(ITEM_SP_TIME_OBJ, TIME_ITEM_DATA_INDEX_NAME),
    };
}
