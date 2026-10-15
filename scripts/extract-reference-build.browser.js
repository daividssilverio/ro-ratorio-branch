// Prints a reference-build fixture for the golden tests.
//
// Open a saved build on the upstream calculator page, paste this file into the
// browser console, and copy the printed JSON into
// packages/core/src/engine-adapter/fixtures/<name>.reference.json. Fill in
// "description" by hand.
//
// The fixture is the calc model the page itself extracts, written as the
// positions that differ from an unequipped character. Buffs are read from the
// engine state instead, because the page leaves them out of the model while
// their panel is closed.

const engineUrl = new URL("/ratorio/engine/", location.href).href;
const engineRegistry = await import(`${engineUrl}runtime/engine-registry.js`);
const { CMonsterMapAreaComponentManager } = await import(`${engineUrl}monster/CMonsterMapAreaComponentManager.js`);
const skillState = await import(`${engineUrl}skill/skillstate.js`);

const calcModel = engineRegistry.get("extractModelFromDom")();
const battleResult = engineRegistry.get("calcFromModel")(calcModel);

const isUnsetValue = (value) => value === undefined || value === null || value === 0 || value === false;

function positionsThatAreSet(values, isUnset = isUnsetValue) {
    const positions = {};
    for (let position = 0; position < values.length; position++) {
        if (!isUnset(values[position])) {
            positions[position] = values[position];
        }
    }
    return positions;
}

const hasNoRandomOption = (randomOptions) =>
    isUnsetValue(randomOptions) || randomOptions.every(([optionId, optionValue]) => optionId === 0 && optionValue === 0);

const positions = {
    equip: positionsThatAreSet(calcModel.equip),
    card: positionsThatAreSet(calcModel.card),
    costume: positionsThatAreSet(calcModel.costume),
    passiveSkill: positionsThatAreSet(skillState.n_A_PassSkill),
    autoSpell: positionsThatAreSet(calcModel.autoSpell),
    buff4: positionsThatAreSet(skillState.n_A_PassSkill4),
    buff7: positionsThatAreSet(skillState.n_A_PassSkill7),
    buff8: positionsThatAreSet(skillState.n_A_PassSkill8),
    confIchizi: positionsThatAreSet(calcModel.confIchizi),
    confNizi: positionsThatAreSet(calcModel.confNizi),
    confSanzi: positionsThatAreSet(calcModel.confSanzi),
    confYozi: positionsThatAreSet(calcModel.confYozi),
    confDebuff: positionsThatAreSet(calcModel.confDebuff),
    confCustomStatus: positionsThatAreSet(calcModel.confCustomStatus),
    confCustomAtk: positionsThatAreSet(calcModel.confCustomAtk),
    confCustomDef: positionsThatAreSet(calcModel.confCustomDef),
    confCustomSkill: positionsThatAreSet(calcModel.confCustomSkill),
    confCustomSpecStatus: positionsThatAreSet(calcModel.confCustomSpecStatus),
    pureStatus: positionsThatAreSet(calcModel.pureStatus),
    timeItemConf: positionsThatAreSet(calcModel.timeItemConf),
    mobConfTaisei: positionsThatAreSet(calcModel.mobConfTaisei),
    mobConfIjyou: positionsThatAreSet(calcModel.mobConfIjyou),
    mobConfKyouka: positionsThatAreSet(calcModel.mobConfKyouka),
    learnedSkill: positionsThatAreSet(calcModel.learnedSkill),
};
for (const [sectionName, sectionPositions] of Object.entries(positions)) {
    if (Object.keys(sectionPositions).length === 0) {
        delete positions[sectionName];
    }
}

const displayedSummary = document.body.innerText.match(/平均(\d+)DPS(\d+)/);

JSON.stringify(
    {
        description: "",
        targetMonsterId: CMonsterMapAreaComponentManager.GetMonsterId(),
        status: calcModel.status,
        weapon: { ...calcModel.weapon, weapon2AtkPlus: calcModel.weapon.weapon2AtkPlus ?? 0 },
        defPlus: calcModel.defPlus,
        defTranscendence: calcModel.defTranscendence,
        arrow: Number(calcModel.arrow),
        attackMethod: calcModel.attackMethod,
        positions,
        notRepresentedInTheModel: {
            musicalBuffs: positionsThatAreSet(skillState.n_A_PassSkill3),
            shadowEquipItems: positionsThatAreSet(calcModel.shadowEquip.itemId),
            shadowEquipRefines: positionsThatAreSet(calcModel.shadowEquip.refined),
            shadowEquipRandomOptions: positionsThatAreSet(calcModel.shadowEquip.rndOpt, hasNoRandomOption),
            timeItemsSwitchedOff: positionsThatAreSet(calcModel.timeItemConfEffective, (isEffective) => isEffective !== false),
            bonusStatus: positionsThatAreSet(calcModel.bonusStatus),
        },
        shownByUpstreamPage: {
            averageDamagePerAttack: displayedSummary ? Number(displayedSummary[1]) : null,
            averageDamagePerSecond: displayedSummary ? Number(displayedSummary[2]) : null,
        },
        calculatedOnUpstreamPage: {
            averageDamagePerAttack: battleResult.GetDamageSummaryAvePerAtk(),
            averageDamagePerSecond: battleResult.GetDamageSummaryAvePerSec(),
            attacksToKill: battleResult.GetAttackCountSummaryAve(),
            secondsToKill: battleResult.GetAttackSecondSummaryAve(),
        },
    },
    null,
    4,
);
