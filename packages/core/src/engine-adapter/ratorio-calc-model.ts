/**
 * Input of one ratorio calculation, mirroring `createEmptyModel()` upstream
 * but with every scalar filled in: the engine answers 0 or NaN, without an
 * error, when one is left undefined.
 * Arrays are indexed with upstream constants (`EQUIP_REGION_ID_*`,
 * `CARD_REGION_ID_*`, `CONF_ID_*`, ...), never with raw numbers.
 */
export interface RatorioCalcModel {
    status: {
        jobId: number;
        baseLv: number;
        jobLv: number;
        str: number;
        agi: number;
        vit: number;
        dex: number;
        int: number;
        luk: number;
        speedPot: number;
    };
    weapon: {
        type: number;
        zokusei: number;
        atkPlus: number;
        transcendence: number;
        weapon2Type: number;
        weapon2AtkPlus: number;
        weapon2Transcendence: number;
    };
    defPlus: Record<RefinableArmorRegion, number>;
    defTranscendence: Record<RefinableArmorRegion, number>;
    arrow: number;
    attackMethod: {
        skillId: number;
        sourceType: number;
        skillLv: number;
        optionValueArray: number[];
    };
    shadowEquip: {
        itemId: number[];
        refined: number[];
        rndOpt: [randomOptionId: number, randomOptionValue: number][][];
    };
    equip: number[];
    card: number[];
    costume: number[];
    passiveSkill: number[];
    autoSpell: number[];
    buff4: number[];
    buff7: number[];
    buff8: number[];
    confIchizi: number[];
    confNizi: number[];
    confSanzi: number[];
    confYozi: number[];
    confDebuff: number[];
    confCustomStatus: number[];
    confCustomAtk: number[];
    confCustomDef: number[];
    confCustomSkill: number[];
    confCustomSpecStatus: number[];
    pureStatus: number[];
    bonusStatus: number[];
    timeItemConf: number[];
    timeItemConfEffective: boolean[];
    mobConfTaisei: number[];
    mobConfIjyou: number[];
    mobConfKyouka: number[];
    learnedSkill: number[];
}

/** The sections upstream's `createEmptyModel()` already fills with usable values. */
export type RatorioCalcModelArrays = Omit<
    RatorioCalcModel,
    "status" | "weapon" | "defPlus" | "defTranscendence" | "arrow" | "attackMethod"
>;

export type RefinableArmorRegion = "head" | "body" | "shield" | "shoulder" | "shoes";

/**
 * `CBattleCalcResultAll` upstream, typed only as far as callers read it.
 * The kill-time getters return a display string instead of a number when the
 * attack deals no damage.
 */
export interface RatorioBattleResult {
    readonly charaData: readonly unknown[];
    readonly specData: readonly unknown[];
    readonly mobData: readonly unknown[];
    GetDamageSummaryAvePerAtk(): number;
    GetDamageSummaryAvePerSec(): number;
    GetAttackCountSummaryAve(): number | string;
    GetAttackSecondSummaryAve(): number | string;
}
