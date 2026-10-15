import type { RatorioCalcModel } from "./ratorio-calc-model.ts";
import type { RatorioEngine } from "./ratorio-engine.ts";

export type PositionalSection =
    | "equip"
    | "card"
    | "costume"
    | "passiveSkill"
    | "autoSpell"
    | "buff4"
    | "buff7"
    | "buff8"
    | "confIchizi"
    | "confNizi"
    | "confSanzi"
    | "confYozi"
    | "confDebuff"
    | "confCustomStatus"
    | "confCustomAtk"
    | "confCustomDef"
    | "confCustomSkill"
    | "confCustomSpecStatus"
    | "pureStatus"
    | "timeItemConf"
    | "mobConfTaisei"
    | "mobConfIjyou"
    | "mobConfKyouka"
    | "learnedSkill";

/**
 * A build as `scripts/extract-reference-build.browser.js` prints it on the
 * upstream page: the page's own calc model plus the numbers it showed.
 */
export interface ReferenceBuild {
    readonly description: string;
    readonly targetMonsterId: number;
    readonly status: RatorioCalcModel["status"];
    readonly weapon: RatorioCalcModel["weapon"];
    readonly defPlus: RatorioCalcModel["defPlus"];
    readonly defTranscendence: RatorioCalcModel["defTranscendence"];
    readonly arrow: number;
    readonly attackMethod: RatorioCalcModel["attackMethod"];
    /** Per model array, the positions that differ from an unequipped character. */
    readonly positions: Partial<Record<PositionalSection, Readonly<Record<string, number>>>>;
    readonly shownByUpstreamPage: { averageDamagePerAttack: number; averageDamagePerSecond: number };
    readonly calculatedOnUpstreamPage: { attacksToKill: number; secondsToKill: number };
}

export function calcModelOfReferenceBuild(engine: RatorioEngine, referenceBuild: ReferenceBuild): RatorioCalcModel {
    const calcModel = engine.createBaselineCalcModel(referenceBuild.status.jobId);
    calcModel.status = { ...referenceBuild.status };
    calcModel.weapon = { ...referenceBuild.weapon };
    calcModel.defPlus = { ...referenceBuild.defPlus };
    calcModel.defTranscendence = { ...referenceBuild.defTranscendence };
    calcModel.arrow = referenceBuild.arrow;
    calcModel.attackMethod = {
        ...referenceBuild.attackMethod,
        optionValueArray: [...referenceBuild.attackMethod.optionValueArray],
    };
    for (const [sectionName, positionalValues] of Object.entries(referenceBuild.positions)) {
        const modelArray = calcModel[sectionName as PositionalSection];
        for (const [position, value] of Object.entries(positionalValues)) {
            modelArray[Number(position)] = value;
        }
    }
    return calcModel;
}
