import { beforeAll, describe, expect, it } from "vitest";
import type { BattleSummary } from "./battle-summary.ts";
import archMageFrozenSlash from "./fixtures/arch-mage-frozen-slash.reference.json" with { type: "json" };
import mechanicArmsCannon from "./fixtures/mechanic-arms-cannon.reference.json" with { type: "json" };
import mechanicArmsCannonSoulCannonball from "./fixtures/mechanic-arms-cannon-soul-cannonball.reference.json" with { type: "json" };
import summonerCarrotBeat from "./fixtures/summoner-carrot-beat.reference.json" with { type: "json" };
import { loadRatorioEngine } from "./load-ratorio-engine-in-node.ts";
import { calcModelOfReferenceBuild, type ReferenceBuild } from "./reference-build.ts";

const referenceBuilds: readonly ReferenceBuild[] = [
    mechanicArmsCannon,
    mechanicArmsCannonSoulCannonball,
    archMageFrozenSlash,
    summonerCarrotBeat,
];

describe.each(referenceBuilds)("reference build: $description", (referenceBuild) => {
    let battleSummary: BattleSummary;

    beforeAll(async () => {
        const engine = await loadRatorioEngine();
        const battleResult = engine.calculateBattleResult(
            calcModelOfReferenceBuild(engine, referenceBuild),
            referenceBuild.targetMonsterId,
        );
        battleSummary = engine.summarizeBattleResult(battleResult);
    }, 60_000);

    it("targets the monster of the build", () => {
        expect(battleSummary.targetMonsterId).toBe(referenceBuild.targetMonsterId);
    });

    it("deals the average damage per attack the upstream page shows", () => {
        expect(battleSummary.averageDamagePerAttack).toBe(referenceBuild.shownByUpstreamPage.averageDamagePerAttack);
    });

    it("deals the damage per second the upstream page shows", () => {
        expect(battleSummary.averageDamagePerSecond).toBe(referenceBuild.shownByUpstreamPage.averageDamagePerSecond);
    });

    it("needs the attacks and the time to kill the upstream engine calculates", () => {
        const { attacksToKill, secondsToKill } = referenceBuild.calculatedOnUpstreamPage;

        expect(battleSummary.averageTimeToKill?.attacks).toBe(attacksToKill);
        expect(battleSummary.averageTimeToKill?.seconds).toBeCloseTo(secondsToKill, 6);
    });
});
