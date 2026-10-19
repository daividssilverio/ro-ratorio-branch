import { beforeAll, describe, expect, it } from "vitest";
import archMageFrozenSlashReference from "../engine-adapter/fixtures/arch-mage-frozen-slash.reference.json" with { type: "json" };
import mechanicArmsCannonReference from "../engine-adapter/fixtures/mechanic-arms-cannon.reference.json" with { type: "json" };
import mechanicArmsCannonSoulCannonballReference from "../engine-adapter/fixtures/mechanic-arms-cannon-soul-cannonball.reference.json" with { type: "json" };
import summonerCarrotBeatReference from "../engine-adapter/fixtures/summoner-carrot-beat.reference.json" with { type: "json" };
import spiritHandlerTigerSlashReference from "../engine-adapter/fixtures/spirit-handler-tiger-slash.reference.json" with { type: "json" };
import spiritHandlerEverythingPlus5Reference from "../engine-adapter/fixtures/spirit-handler-everything-plus5.reference.json" with { type: "json" };
import spiritHandlerAbyssArmorReference from "../engine-adapter/fixtures/spirit-handler-abyss-armor.reference.json" with { type: "json" };
import spiritHandlerConstellationSealReference from "../engine-adapter/fixtures/spirit-handler-constellation-seal.reference.json" with { type: "json" };
import spiritHandlerSatanFoxTailReference from "../engine-adapter/fixtures/spirit-handler-satan-fox-tail.reference.json" with { type: "json" };
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import { type RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { calcModelOfReferenceBuild, type ReferenceBuild } from "../engine-adapter/reference-build.ts";
import { convertBuildToCalcModel } from "./convert-build.ts";
import archMageFrozenSlashBuild from "./golden-builds/arch-mage-frozen-slash.build.json" with { type: "json" };
import mechanicArmsCannonBuild from "./golden-builds/mechanic-arms-cannon.build.json" with { type: "json" };
import mechanicArmsCannonSoulCannonballBuild from "./golden-builds/mechanic-arms-cannon-soul-cannonball.build.json" with { type: "json" };
import summonerCarrotBeatBuild from "./golden-builds/summoner-carrot-beat.build.json" with { type: "json" };
import spiritHandlerTigerSlashBuild from "./golden-builds/spirit-handler-tiger-slash.build.json" with { type: "json" };
import spiritHandlerEverythingPlus5Build from "./golden-builds/spirit-handler-everything-plus5.build.json" with { type: "json" };
import spiritHandlerAbyssArmorBuild from "./golden-builds/spirit-handler-abyss-armor.build.json" with { type: "json" };
import spiritHandlerConstellationSealBuild from "./golden-builds/spirit-handler-constellation-seal.build.json" with { type: "json" };
import spiritHandlerSatanFoxTailBuild from "./golden-builds/spirit-handler-satan-fox-tail.build.json" with { type: "json" };
import { parseBuild } from "./parse-build.ts";

interface GoldenBuild {
    readonly description: string;
    readonly buildFileContent: unknown;
    readonly upstreamReference: ReferenceBuild;
}

const goldenBuilds: readonly GoldenBuild[] = [
    { buildFileContent: mechanicArmsCannonBuild, upstreamReference: mechanicArmsCannonReference },
    { buildFileContent: mechanicArmsCannonSoulCannonballBuild, upstreamReference: mechanicArmsCannonSoulCannonballReference },
    { buildFileContent: archMageFrozenSlashBuild, upstreamReference: archMageFrozenSlashReference },
    { buildFileContent: summonerCarrotBeatBuild, upstreamReference: summonerCarrotBeatReference },
    { buildFileContent: spiritHandlerTigerSlashBuild, upstreamReference: spiritHandlerTigerSlashReference },
    { buildFileContent: spiritHandlerEverythingPlus5Build, upstreamReference: spiritHandlerEverythingPlus5Reference },
    { buildFileContent: spiritHandlerAbyssArmorBuild, upstreamReference: spiritHandlerAbyssArmorReference },
    { buildFileContent: spiritHandlerConstellationSealBuild, upstreamReference: spiritHandlerConstellationSealReference },
    { buildFileContent: spiritHandlerSatanFoxTailBuild, upstreamReference: spiritHandlerSatanFoxTailReference },
].map((goldenBuild) => ({ ...goldenBuild, description: goldenBuild.upstreamReference.description }));

describe.each(goldenBuilds)("golden build file: $description", ({ buildFileContent, upstreamReference }) => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    }, 60_000);

    it("converts to the calc model the upstream page extracted", () => {
        const calcModel = convertBuildToCalcModel(parseBuild(buildFileContent), engine);

        expect(calcModel).toEqual(calcModelOfReferenceBuild(engine, upstreamReference));
    });

    it("names the target monster of the upstream build", () => {
        expect(parseBuild(buildFileContent).scenario.targetMonsterId).toBe(upstreamReference.targetMonsterId);
    });

    it("calculates to the damage and DPS the upstream page shows", () => {
        const build = parseBuild(buildFileContent);

        const battleResult = engine.calculateBattleResult(
            convertBuildToCalcModel(build, engine),
            build.scenario.targetMonsterId,
        );

        const battleSummary = engine.summarizeBattleResult(battleResult);
        expect(battleSummary.averageDamagePerAttack).toBe(upstreamReference.shownByUpstreamPage.averageDamagePerAttack);
        expect(battleSummary.averageDamagePerSecond).toBe(upstreamReference.shownByUpstreamPage.averageDamagePerSecond);
    });
});
