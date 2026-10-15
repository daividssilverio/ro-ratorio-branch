// Rewrites a reference fixture (the upstream page's positional calc model) as
// a version 1 build file, by reading the adapter's layout in reverse.
//
//   node scripts/write-golden-build.ts <name>
//
// reads  src/engine-adapter/fixtures/<name>.reference.json
// writes src/build/golden-builds/<name>.build.json
//
// It stops when the fixture holds something a build file cannot express.

import { readFileSync, writeFileSync } from "node:fs";
import { equipmentSlots, traitStatNames } from "../src/character-vocabulary.ts";
import type { SupportBuffSection } from "../src/engine-adapter/calc-model-layout.ts";
import type { RefinableArmorRegion } from "../src/engine-adapter/ratorio-calc-model.ts";
import { loadRatorioEngine } from "../src/engine-adapter/load-ratorio-engine-in-node.ts";
import type { PositionalSection, ReferenceBuild } from "../src/engine-adapter/reference-build.ts";
import type { Build, Equipment, GearPiece } from "../src/build/build-format.ts";
import { parseBuild } from "../src/build/parse-build.ts";

const fixtureName = process.argv[2];
if (fixtureName === undefined) {
    throw new Error("usage: node scripts/write-golden-build.ts <name>");
}
const referenceBuild: ReferenceBuild = JSON.parse(
    readFileSync(new URL(`../src/engine-adapter/fixtures/${fixtureName}.reference.json`, import.meta.url), "utf8"),
);

const engine = await loadRatorioEngine();
const layout = engine.calcModelLayout;
const positions = referenceBuild.positions;
const { passiveSkillIds, learnedSkillIds } = engine.skillSlotsOfJob(referenceBuild.status.jobId);

const supportBuffSections: readonly SupportBuffSection[] = ["confIchizi", "confNizi", "confSanzi", "confYozi", "confDebuff"];
const sectionsABuildCanExpress: readonly PositionalSection[] = [
    "equip",
    "card",
    "passiveSkill",
    "learnedSkill",
    "pureStatus",
    "timeItemConf",
    ...supportBuffSections,
];
const inexpressibleSections = Object.keys(positions).filter(
    (sectionName) => !sectionsABuildCanExpress.includes(sectionName as PositionalSection),
);
if (inexpressibleSections.length > 0 || referenceBuild.arrow !== 0 || referenceBuild.weapon.zokusei !== 0) {
    throw new Error(
        `A version 1 build cannot express: ${[...inexpressibleSections, "arrow or weapon element when set"].join(", ")}`,
    );
}

const armorRegionOfSlot: Partial<Record<(typeof equipmentSlots)[number], RefinableArmorRegion>> = {
    headTop: "head",
    shield: "shield",
    armor: "body",
    garment: "shoulder",
    shoes: "shoes",
};

const cardPositionsNotYetPlaced = new Set(Object.keys(positions.card ?? {}));
const equipment: Equipment = {};
for (const slot of equipmentSlots) {
    const itemId = positions.equip?.[layout.equipPositionOfSlot[slot]] ?? 0;
    const sockets = layout.cardPositionsOfSlot[slot].map((cardPosition) => {
        cardPositionsNotYetPlaced.delete(String(cardPosition));
        return positions.card?.[cardPosition] ?? null;
    });
    while (sockets.at(-1) === null) {
        sockets.pop();
    }
    const armorRegion = armorRegionOfSlot[slot];
    const refine =
        slot === "rightHand"
            ? referenceBuild.weapon.atkPlus
            : slot === "leftHand"
              ? referenceBuild.weapon.weapon2AtkPlus
              : armorRegion === undefined
                ? 0
                : referenceBuild.defPlus[armorRegion];
    const transcendence =
        slot === "rightHand"
            ? referenceBuild.weapon.transcendence
            : slot === "leftHand"
              ? referenceBuild.weapon.weapon2Transcendence
              : armorRegion === undefined
                ? 0
                : referenceBuild.defTranscendence[armorRegion];
    if (itemId === layout.emptyItemIdOfSlot[slot] && sockets.length === 0 && refine === 0 && transcendence === 0) {
        continue;
    }
    const gearPiece: GearPiece = { itemId };
    if (refine !== 0) gearPiece.refine = refine;
    if (transcendence !== 0) gearPiece.transcendence = transcendence;
    if (sockets.length > 0) gearPiece.sockets = sockets;
    equipment[slot] = gearPiece;
}
if (cardPositionsNotYetPlaced.size > 0) {
    throw new Error(`No equipment slot owns card positions ${[...cardPositionsNotYetPlaced].join(", ")}`);
}

function levelsBySkillId(skillIdsInSlotOrder: readonly number[], levelsByPosition: Readonly<Record<string, number>>) {
    return Object.fromEntries(
        Object.entries(levelsByPosition).map(([position, level]) => {
            const skillId = skillIdsInSlotOrder[Number(position)];
            if (skillId === undefined) {
                throw new Error(`The job has no skill at position ${position}`);
            }
            return [String(skillId), level];
        }),
    );
}

const supportBuffs: Record<string, number> = {};
for (const section of supportBuffSections) {
    for (const [position, value] of Object.entries(positions[section] ?? {})) {
        const buffName = [...layout.supportBuffLocations].find(
            ([, location]) => location.section === section && location.position === Number(position),
        )?.[0];
        if (buffName === undefined) {
            throw new Error(`No upstream name for ${section} position ${position}`);
        }
        supportBuffs[buffName] = value;
    }
}

const traitStats = {
    pow: 0,
    sta: 0,
    wis: 0,
    spl: 0,
    con: 0,
    crt: 0,
};
for (const traitStatName of traitStatNames) {
    traitStats[traitStatName] = positions.pureStatus?.[layout.pureStatusPositionOfTraitStat[traitStatName]] ?? 0;
}

const character: Build["character"] = {
    jobId: referenceBuild.status.jobId,
    baseLevel: referenceBuild.status.baseLv,
    jobLevel: referenceBuild.status.jobLv,
    baseStats: {
        str: referenceBuild.status.str,
        agi: referenceBuild.status.agi,
        vit: referenceBuild.status.vit,
        int: referenceBuild.status.int,
        dex: referenceBuild.status.dex,
        luk: referenceBuild.status.luk,
    },
    equipment,
};
if (Object.values(traitStats).some((points) => points !== 0)) character.traitStats = traitStats;
if (positions.learnedSkill) character.learnedSkills = levelsBySkillId(learnedSkillIds, positions.learnedSkill);
if (positions.passiveSkill) character.selfBuffs = levelsBySkillId(passiveSkillIds, positions.passiveSkill);
if (Object.keys(supportBuffs).length > 0) character.supportBuffs = supportBuffs;
if (positions.timeItemConf) character.timedItems = Object.values(positions.timeItemConf);
if (referenceBuild.status.speedPot !== 0) character.speedPotion = referenceBuild.status.speedPot;

const scenario: Build["scenario"] = {
    skillId: referenceBuild.attackMethod.skillId,
    skillLevel: referenceBuild.attackMethod.skillLv,
    targetMonsterId: referenceBuild.targetMonsterId,
};
if (referenceBuild.attackMethod.optionValueArray.length > 0) {
    scenario.skillOptions = [...referenceBuild.attackMethod.optionValueArray];
}

const build = parseBuild({ formatVersion: 1, character, scenario });

writeFileSync(
    new URL(`../src/build/golden-builds/${fixtureName}.build.json`, import.meta.url),
    formatBuildFile(build),
);

/** Four-space JSON with stats, gear pieces and ID maps kept on one line each. */
function formatBuildFile(buildToFormat: Build): string {
    const onOneLine = (value: unknown): string =>
        JSON.stringify(value)
            .replace(/([,:])/g, "$1 ")
            .replace(/\{(?!\})/g, "{ ")
            .replace(/(?<!\{)\}/g, " }");
    const { equipment: equipmentToFormat, ...characterWithoutEquipment } = buildToFormat.character;
    const characterLines = Object.entries(characterWithoutEquipment).map(
        ([fieldName, value]) => `        ${JSON.stringify(fieldName)}: ${onOneLine(value)}`,
    );
    const equipmentLines = Object.entries(equipmentToFormat).map(
        ([slot, gearPiece]) => `            ${JSON.stringify(slot)}: ${onOneLine(gearPiece)}`,
    );
    return [
        "{",
        `    "formatVersion": ${buildToFormat.formatVersion},`,
        `    "character": {`,
        [...characterLines, `        "equipment": {\n${equipmentLines.join(",\n")}\n        }`].join(",\n"),
        "    },",
        `    "scenario": ${onOneLine(buildToFormat.scenario)}`,
        "}",
        "",
    ].join("\n");
}
