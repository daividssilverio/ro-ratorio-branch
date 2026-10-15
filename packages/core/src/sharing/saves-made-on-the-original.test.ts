import { beforeAll, describe, expect, it } from "vitest";
import type { Character, Scenario } from "../build/build-format.ts";
import { calculateBuild } from "../build/calculate-build.ts";
import { isAdopted } from "../build/convert-build.ts";
import { equipmentSlots } from "../character-vocabulary.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { RatorioSaveReader } from "../engine-adapter/ratorio-save.ts";
import { positionalBuffPanels } from "../panels/panel-definitions.ts";
import { savesMadeOnTheOriginal } from "./golden-save-urls.ts";
import { importRatorioSave } from "./import-ratorio-save.ts";

/**
 * Everything in the character and scenario that the catalog would not have
 * offered, one line each. Empty when the catalog's rules agree with the
 * page the save was made on.
 */
function notOfferedIn(character: Character, scenario: Scenario | null, engine: RatorioEngine): string[] {
    const { catalog } = engine;
    const { jobId } = character;
    const notOffered: string[] = [];
    const idsOf = (entries: readonly { readonly id: number }[]) => new Set(entries.map((entry) => entry.id));
    const isOutside = (value: number, range: { readonly lowest: number; readonly highest: number }) => value < range.lowest || value > range.highest;

    const limits = catalog.limitsOfJob(jobId, isAdopted(character));
    if (limits === undefined) {
        return [`limitsOfJob: no job ${jobId}`];
    }
    if (isOutside(character.baseLevel, limits.baseLevel)) notOffered.push(`limitsOfJob: base level ${character.baseLevel}`);
    if (isOutside(character.jobLevel, limits.jobLevel)) notOffered.push(`limitsOfJob: job level ${character.jobLevel}`);
    for (const [stat, value] of Object.entries(character.baseStats)) {
        if (isOutside(value, limits.baseStat)) notOffered.push(`limitsOfJob: ${stat} ${value}`);
    }
    for (const [stat, value] of Object.entries(character.traitStats ?? {})) {
        if (limits.traitStat === null ? value !== 0 : isOutside(value, limits.traitStat)) notOffered.push(`limitsOfJob: ${stat} ${value}`);
    }

    for (const slot of equipmentSlots) {
        const gearPiece = character.equipment[slot];
        if (gearPiece === undefined) {
            continue;
        }
        if (!idsOf(catalog.itemsForSlot(slot, jobId)).has(gearPiece.itemId)) notOffered.push(`itemsForSlot: ${slot} item ${gearPiece.itemId}`);
        if (!catalog.slotsOfItem(gearPiece.itemId).includes(slot)) notOffered.push(`slotsOfItem: item ${gearPiece.itemId} in ${slot}`);
        const choicesOfSocket = catalog.socketChoicesOfItem(slot, gearPiece.itemId);
        (gearPiece.sockets ?? []).forEach((cardOrEnchantId, socketIndex) => {
            if (cardOrEnchantId !== null && !idsOf(choicesOfSocket[socketIndex] ?? []).has(cardOrEnchantId)) {
                notOffered.push(`socketChoicesOfItem: ${slot} socket ${socketIndex + 1} card ${cardOrEnchantId}`);
            }
        });
        const optionsOfPosition = catalog.randomOptionsOfItem(gearPiece.itemId);
        (gearPiece.randomOptions ?? []).forEach((randomOption, positionIndex) => {
            const range = randomOption === null ? undefined : optionsOfPosition[positionIndex]?.find((choice) => choice.id === randomOption.optionId)?.range;
            if (randomOption !== null && (range === undefined || isOutside(randomOption.value, range))) {
                notOffered.push(`randomOptionsOfItem: ${slot} position ${positionIndex + 1} option ${randomOption.optionId} value ${randomOption.value}`);
            }
        });
    }

    const learnable = new Map(catalog.learnableSkillsOfJob(jobId).map((skill) => [skill.id, skill]));
    for (const [skillId, level] of Object.entries(character.learnedSkills ?? {})) {
        if (level > (learnable.get(Number(skillId))?.highestLevel ?? 0)) notOffered.push(`learnableSkillsOfJob: skill ${skillId} level ${level}`);
    }
    const selfBuffs = new Map(catalog.selfBuffsOfJob(jobId).map((buff) => [buff.id, buff]));
    for (const [skillId, value] of Object.entries(character.selfBuffs ?? {})) {
        const buff = selfBuffs.get(Number(skillId));
        const isOffered = buff !== undefined && value <= buff.highestLevel && (buff.choices === undefined || buff.choices.some((choice) => choice.value === value));
        if (!isOffered) notOffered.push(`selfBuffsOfJob: skill ${skillId} value ${value}`);
    }
    const supportBuffs = new Map(catalog.supportBuffs().map((buff) => [buff.name, buff]));
    for (const [buffName, value] of Object.entries(character.supportBuffs ?? {})) {
        const buff = supportBuffs.get(buffName);
        const isOffered = buff !== undefined && !isOutside(value, buff) && (buff.choices === undefined || buff.choices.some((choice) => choice.value === value));
        if (!isOffered) notOffered.push(`supportBuffs: ${buffName} value ${value}`);
    }

    for (const panel of positionalBuffPanels) {
        const buffOfPosition = new Map(catalog.positionalBuffs(panel).map((buff) => [buff.position, buff]));
        for (const [position, value] of Object.entries(character[panel] ?? {})) {
            const buff = buffOfPosition.get(Number(position));
            const isOffered = buff !== undefined && value <= buff.highest && (buff.choices === undefined || buff.choices.some((choice) => choice.value === value));
            if (!isOffered) notOffered.push(`positionalBuffs: ${panel} position ${position} value ${value}`);
        }
    }

    const timedItemIds = idsOf(catalog.timedItems());
    for (const timedItemId of character.timedItems ?? []) {
        if (!timedItemIds.has(timedItemId)) notOffered.push(`timedItems: ${timedItemId}`);
    }
    if (character.speedPotion !== undefined && !idsOf(catalog.speedPotions()).has(character.speedPotion)) notOffered.push(`speedPotions: ${character.speedPotion}`);
    if (character.weaponElement !== undefined && !idsOf(catalog.weaponElements()).has(character.weaponElement)) notOffered.push(`weaponElements: ${character.weaponElement}`);
    if (character.arrowId !== undefined && !idsOf(catalog.arrowsOfJob(jobId)).has(character.arrowId)) notOffered.push(`arrowsOfJob: ${character.arrowId}`);

    if (scenario !== null) {
        if (!idsOf(catalog.attackSkillsOfJob(jobId)).has(scenario.skillId)) notOffered.push(`attackSkillsOfJob: skill ${scenario.skillId}`);
        if (!idsOf(catalog.monsters()).has(scenario.targetMonsterId)) notOffered.push(`monsters: ${scenario.targetMonsterId}`);
    }
    if (!idsOf(catalog.jobs()).has(jobId)) notOffered.push(`jobs: ${jobId}`);
    return notOffered;
}

describe("saves made on the original", () => {
    let engine: RatorioEngine;
    let readSave: RatorioSaveReader;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        readSave = await engine.loadSaveReader();
    });

    it.each(Object.entries(savesMadeOnTheOriginal))("%s holds nothing the catalog would not have offered, is read in full, and calculates to what the page showed", (_name, save) => {
        const { character, scenario, notImported } = importRatorioSave(readSave(save.url), engine);

        expect(notOfferedIn(character, scenario, engine)).toEqual([]);
        expect(scenario).not.toBeNull();
        if (scenario === null) {
            return;
        }
        const battleSummary = calculateBuild({ formatVersion: 1, character, scenario }, engine);
        if (save.shownByThePage !== undefined) {
            expect(notImported).toEqual([]);
            expect({ averageDamagePerAttack: battleSummary.averageDamagePerAttack, averageDamagePerSecond: battleSummary.averageDamagePerSecond }).toEqual(save.shownByThePage);
        }
    });

    it("would notice: a build the original could not have made is reported rule by rule", () => {
        const [firstSave] = Object.values(savesMadeOnTheOriginal);
        const { character, scenario } = importRatorioSave(readSave(firstSave?.url ?? ""), engine);
        const weapon = character.equipment.rightHand;
        if (weapon === undefined) {
            throw new Error("the first save has no weapon to misuse");
        }
        const shieldCardIds = new Set((engine.catalog.socketChoicesOfItem("shield", weapon.itemId)[0] ?? []).map((card) => card.id));
        const weaponOnlyCard = engine.catalog.socketChoicesOfItem("rightHand", weapon.itemId).flat().find((card) => !shieldCardIds.has(card.id));
        const impossible: Character = {
            ...character,
            baseLevel: 1,
            arrowId: 1,
            equipment: {
                ...character.equipment,
                rightHand: { ...weapon, randomOptions: [{ optionId: 20, value: 1 }] },
                shield: { itemId: weapon.itemId, sockets: [weaponOnlyCard?.id ?? 0] },
            },
        };

        const rulesThatObjected = new Set(notOfferedIn(impossible, scenario, engine).map((line) => line.split(":")[0]));

        expect(rulesThatObjected).toEqual(new Set(["limitsOfJob", "itemsForSlot", "slotsOfItem", "socketChoicesOfItem", "randomOptionsOfItem", "arrowsOfJob"]));
    });
});
