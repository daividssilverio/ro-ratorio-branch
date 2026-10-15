import type { CatalogEntry } from "./engine-catalog.ts";

/** One auto-spell a character has set: which one, at which level, and how often it goes off. */
export interface AutoSpellValue {
    readonly autoSpellId: number;
    /** 0 leaves the level to the auto-spell itself. */
    readonly level: number;
    readonly chancePerMille: number;
}

export const highestAutoSpellLevel = 10;

export interface AutoSpellLayout {
    /** The auto-spells that can be set, in the original's order: by skill name, then level. */
    readonly entries: readonly CatalogEntry[];
    /** The chances the original offers, in per mille, ascending. */
    readonly chancesPerMille: readonly number[];
    /** How many a character can set. */
    readonly limit: number;
    /** Writes the set auto-spells into the list `calcModel.autoSpell` is. */
    toCalcModelList(autoSpells: readonly AutoSpellValue[]): number[];
    /** Reads them back from such a list. Rows without an auto-spell are left out. */
    fromCalcModelList(calcModelList: readonly (number | null | undefined)[]): AutoSpellValue[];
}

export async function loadAutoSpellLayout(skillNameOf: (skillId: number) => string | undefined): Promise<AutoSpellLayout> {
    const { AutoSpellSkill } = await import("../../../../vendor/ratorio/engine/skill/autospell.dat.js");
    const indexes = await import("../../../../vendor/ratorio/engine/const/EnumAutoSpellDataIndex.js");
    const settings = await import("../../../../vendor/ratorio/engine/skill/calcautospell.js");

    const entries = AutoSpellSkill.flatMap((dataRow): (CatalogEntry & { readonly sortKey: string })[] => {
        const id = dataRow?.[indexes.AUTO_SPELL_DATA_INDEX_ID];
        const skillLevel = dataRow?.[indexes.AUTO_SPELL_DATA_INDEX_SKILL_LEVEL];
        const skillName = skillNameOf(Number(dataRow?.[indexes.AUTO_SPELL_DATA_INDEX_SKILL_ID]));
        const chance = dataRow?.[indexes.AUTO_SPELL_DATA_INDEX_PROBABLY];
        if (typeof id !== "number" || id === 0 || dataRow?.[indexes.AUTO_SPELL_DATA_INDEX_ATTACKABLE] !== 1 || skillName === undefined) {
            return [];
        }
        // Upstream gives the chance its item has in percent.
        const chancePerMille = typeof chance === "number" ? Math.round(chance * 10) : 0;
        return [
            {
                id,
                name: `[Lv${String(skillLevel)}] ${skillName}`,
                sortKey: `${skillName}${String(skillLevel)}`,
                ...(chancePerMille > 0 ? { detail: `${chancePerMille / 10}%`, defaultValue: chancePerMille } : {}),
            },
        ];
    });
    entries.sort((oneEntry, otherEntry) => (oneEntry.sortKey < otherEntry.sortKey ? -1 : oneEntry.sortKey > otherEntry.sortKey ? 1 : 0));

    const chancesPerMille = [...settings.AUTO_SPELL_PROB_ARRAY];
    const limit = settings.AUTO_SPELL_SETTING_COUNT;
    return {
        entries: entries.map(({ sortKey: _sortKey, ...entry }) => entry),
        chancesPerMille,
        limit,
        toCalcModelList(autoSpells) {
            const calcModelList: number[] = [];
            for (let row = 0; row < limit; row++) {
                const autoSpell = autoSpells[row];
                calcModelList[settings.OBJID_OFFSET_AS_SKILL_ID + row] = autoSpell?.autoSpellId ?? 0;
                calcModelList[settings.OBJID_OFFSET_AS_SKILL_LV + row] = autoSpell?.level ?? 0;
                calcModelList[settings.OBJID_OFFSET_AS_SKILL_PROB + row] = Math.max(chancesPerMille.indexOf(autoSpell?.chancePerMille ?? 0), 0);
            }
            return Array.from(calcModelList, (value) => value ?? 0);
        },
        fromCalcModelList(calcModelList) {
            const autoSpells: AutoSpellValue[] = [];
            for (let row = 0; row < limit; row++) {
                const autoSpellId = Number(calcModelList[settings.OBJID_OFFSET_AS_SKILL_ID + row] ?? 0);
                if (autoSpellId !== 0) {
                    autoSpells.push({
                        autoSpellId,
                        level: Number(calcModelList[settings.OBJID_OFFSET_AS_SKILL_LV + row] ?? 0),
                        chancePerMille: chancesPerMille[Number(calcModelList[settings.OBJID_OFFSET_AS_SKILL_PROB + row] ?? 0)] ?? 0,
                    });
                }
            }
            return autoSpells;
        },
    };
}
