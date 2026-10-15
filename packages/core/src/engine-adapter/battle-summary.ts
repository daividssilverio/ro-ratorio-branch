import type { RatorioBattleResult } from "./ratorio-calc-model.ts";

export interface BattleSummary {
    readonly targetMonsterId: number;
    readonly averageDamagePerAttack: number;
    readonly averageDamagePerSecond: number;
    /** `null` when the attack deals no damage, so the target never dies. */
    readonly averageTimeToKill: TimeToKill | null;
}

export interface TimeToKill {
    readonly seconds: number;
    readonly attacks: number;
}

export function summarizeBattleResult(
    battleResult: RatorioBattleResult,
    monsterIdIndexInMonsterData: number,
): BattleSummary {
    const targetMonsterId = battleResult.mobData[monsterIdIndexInMonsterData];
    if (typeof targetMonsterId !== "number") {
        throw new TypeError("The battle result carries no numeric monster ID");
    }
    const secondsToKill = battleResult.GetAttackSecondSummaryAve();
    const attacksToKill = battleResult.GetAttackCountSummaryAve();

    return {
        targetMonsterId,
        averageDamagePerAttack: battleResult.GetDamageSummaryAvePerAtk(),
        averageDamagePerSecond: battleResult.GetDamageSummaryAvePerSec(),
        averageTimeToKill:
            typeof secondsToKill === "number" && typeof attacksToKill === "number"
                ? { seconds: secondsToKill, attacks: attacksToKill }
                : null,
    };
}
