import type { RatorioBattleResult } from "./ratorio-calc-model.ts";

/**
 * The character's computed values after one calculation, keyed by upstream
 * constant names so they stay stable when upstream reorders its arrays.
 */
export interface StatSnapshot {
    /** Derived stats, keyed by the `CHARA_DATA_INDEX_` constant name without that prefix (for example MAXHP). */
    readonly stats: Readonly<Record<string, number>>;
    /** Bonuses that are not 0, keyed by the `ITEM_SP_` constant name without that prefix (for example ATK_PLUS). */
    readonly bonuses: Readonly<Record<string, number>>;
}

export async function loadStatSnapshotReader(): Promise<(battleResult: RatorioBattleResult) => StatSnapshot> {
    const statPositions = positionsByName(
        await import("../../../../vendor/ratorio/engine/const/EnumCharaDataIndex.js"),
        "CHARA_DATA_INDEX_",
    );
    const bonusPositions = positionsByName(
        await import("../../../../vendor/ratorio/engine/const/EnumItemSpId.js"),
        "ITEM_SP_",
    );

    return (battleResult) => {
        const stats: Record<string, number> = {};
        for (const [name, position] of statPositions) {
            const value = battleResult.charaData[position];
            if (typeof value === "number") {
                stats[name] = value;
            }
        }
        const bonuses: Record<string, number> = {};
        for (const [name, position] of bonusPositions) {
            const value = battleResult.specData[position];
            if (typeof value === "number" && value !== 0) {
                bonuses[name] = value;
            }
        }
        return { stats, bonuses };
    };
}

function positionsByName(constants: Readonly<Record<string, unknown>>, namePrefix: string): [string, number][] {
    return Object.entries(constants).flatMap(([constantName, position]): [string, number][] =>
        constantName.startsWith(namePrefix) && typeof position === "number"
            ? [[constantName.slice(namePrefix.length), position]]
            : [],
    );
}
