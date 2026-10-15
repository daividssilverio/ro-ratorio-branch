import { positionalBuffPanels } from "../panels/panel-definitions.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "./load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "./ratorio-engine.ts";

const mechanicJobId = 51;
const maceItemId = 4411;
const shieldItemId = 4936;
const targetMonsterId = 850;
const unknownId = 9_999_999;

const timedItemTheOriginalDoesNotList = 137;

describe("engine catalog", () => {
    let engine: RatorioEngine;
    const idsOf = (entries: readonly { id: number }[]) => entries.map((entry) => entry.id);

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("lists every job once, in ID order, with a name", () => {
        const jobs = engine.catalog.jobs();
        const jobIds = idsOf(jobs);

        expect(jobIds).toContain(engine.jobIds.novice);
        expect(jobIds).toContain(engine.jobIds.meister);
        expect(jobIds).toEqual([...new Set(jobIds)].sort((oneJobId, otherJobId) => oneJobId - otherJobId));
        expect(jobs.every((job) => job.name.length > 0)).toBe(true);
    });

    it("lists for a slot only gear that fits it and that the job may wear", () => {
        const weapons = engine.catalog.itemsForSlot("rightHand", mechanicJobId);
        const shields = engine.catalog.itemsForSlot("shield", mechanicJobId);

        expect(idsOf(weapons)).toContain(maceItemId);
        expect(idsOf(weapons)).not.toContain(shieldItemId);
        expect(idsOf(shields)).toContain(shieldItemId);
        expect(weapons.every((weapon) => engine.canJobEquipItem(mechanicJobId, weapon.id))).toBe(true);
        expect(weapons.every((weapon) => engine.calcModelLayout.itemKindsOfSlot.rightHand.includes(engine.itemKind(weapon.id)))).toBe(true);
    });

    it("puts what an item and a card do into lines, one effect each", () => {
        const maceEffects = engine.catalog.effectsOfItem(maceItemId);
        const cardEffects = engine.catalog.effectsOfCardOrEnchant(1262);

        expect(maceEffects).toHaveLength(12);
        expect(cardEffects).toHaveLength(3);
        expect([...maceEffects, ...cardEffects].every((line) => line.trim() === line && line !== "" && !/<br/i.test(line))).toBe(true);
        expect(engine.catalog.effectsOfItem(unknownId)).toEqual([]);
        expect(engine.catalog.effectsOfCardOrEnchant(unknownId)).toEqual([]);
    });

    it("names the learned skills that worn gear and cards do something more for, as the original marks them", () => {
        const concentrationSkillId = engine.catalog.learnedSkillsGearRewards([4359], [])[0];

        expect(engine.catalog.learnedSkillsGearRewards([4359], [])).toHaveLength(1);
        expect(engine.catalog.learnedSkillsGearRewards([maceItemId], [1262])).toEqual([]);
        expect(engine.catalog.learnedSkillsGearRewards([maceItemId, 4359, 4359], [])).toEqual([concentrationSkillId]);
        expect(engine.catalog.learnedSkillsGearRewards([unknownId], [unknownId])).toEqual([]);
        const everyCard = engine.catalog.learnedSkillsGearRewards([], Array.from({ length: 4000 }, (_unused, cardId) => cardId));
        expect(everyCard.length).toBeGreaterThan(0);
        expect(everyCard).toEqual([...new Set(everyCard)].sort((oneSkillId, otherSkillId) => oneSkillId - otherSkillId));
    });

    it("offers a job fewer weapons than exist", () => {
        const noviceWeaponCount = engine.catalog.itemsForSlot("rightHand", engine.jobIds.novice).length;
        const mechanicWeaponCount = engine.catalog.itemsForSlot("rightHand", mechanicJobId).length;

        expect(noviceWeaponCount).toBeGreaterThan(0);
        expect(mechanicWeaponCount).toBeGreaterThan(noviceWeaponCount);
    });

    it("lists the monsters the engine can target", () => {
        const monsters = engine.catalog.monsters();

        expect(idsOf(monsters)).toContain(targetMonsterId);
        expect(monsters.every((monster) => engine.hasMonster(monster.id))).toBe(true);
    });

    it("says which slots an item fits", () => {
        expect(engine.catalog.slotsOfItem(maceItemId)).toEqual(["rightHand"]);
        expect(engine.catalog.slotsOfItem(shieldItemId)).toEqual(["shield"]);
    });

    it("counts the stat points a level gives and stats cost, as the original does", () => {
        const allOnes = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
        const pointsOf = (jobId: number, baseLevel: number, baseStats = allOnes, isAdopted = false, traitStats?: Record<string, number>) =>
            engine.catalog.statPointsOf({ jobId, baseLevel, baseStats, traitStats }, isAdopted);
        const novice = pointsOf(engine.jobIds.novice, 1);
        const meister = pointsOf(engine.jobIds.meister, 200, allOnes, false, { pow: 3, sta: 0, wis: 0, spl: 0, con: 0, crt: 4 });

        expect(novice).toEqual({ earned: (novice?.earned ?? 0), spent: 0, traitEarned: 0, traitSpent: 0 });
        expect(novice?.earned).toBeGreaterThanOrEqual(48);
        // A reborn job starts with 52 more points than a first-life one, unless it is adopted.
        expect((meister?.earned ?? 0) - (pointsOf(engine.jobIds.meister, 200, allOnes, true)?.earned ?? 0)).toBe(52);
        expect(pointsOf(engine.jobIds.novice, 2)?.earned).toBeGreaterThan(novice?.earned ?? 0);
        // Past base level 200 a level gives trait points, not stat points.
        expect(pointsOf(engine.jobIds.meister, 201)?.earned).toBe(meister?.earned);
        expect(meister?.traitEarned).toBe(7);
        expect(meister?.traitSpent).toBe(7);
        expect(pointsOf(engine.jobIds.meister, 210)?.traitEarned).toBe(45);
        expect(pointsOf(engine.jobIds.novice, 1, { ...allOnes, str: 2 })?.spent).toBe(2);
        expect(pointsOf(engine.jobIds.novice, 1, { ...allOnes, str: 99 })?.spent).toBeGreaterThan(600);
        expect(pointsOf(999_999, 1)).toBeUndefined();
    });

    it("gives the levels and stats the original lets a job have, with trait stats for fourth jobs only", () => {
        const novice = engine.catalog.limitsOfJob(engine.jobIds.novice);
        const meister = engine.catalog.limitsOfJob(engine.jobIds.meister);

        expect(novice?.baseLevel.lowest).toBe(1);
        expect(novice?.traitStat).toBeNull();
        expect(meister?.baseLevel.lowest).toBe(200);
        expect(meister?.baseLevel.highest).toBeGreaterThan(200);
        expect(meister?.traitStat).toEqual({ lowest: 0, highest: 120 });
        expect(meister?.jobLevel.lowest).toBe(1);
        expect(meister?.baseStat.highest).toBeGreaterThan(novice?.baseStat.lowest ?? 0);
        expect(engine.catalog.limitsOfJob(unknownId)).toBeUndefined();
    });

    it("lists a job's learnable skills and own buffs with their highest levels", () => {
        const learnable = engine.catalog.learnableSkillsOfJob(engine.jobIds.meister);
        const selfBuffs = engine.catalog.selfBuffsOfJob(engine.jobIds.meister);

        expect(learnable.find((skill) => skill.id === engine.skillIds.madogearLicense)?.highestLevel).toBe(5);
        expect(idsOf(selfBuffs)).toEqual(engine.skillSlotsOfJob(engine.jobIds.meister).passiveSkillIds);
        expect(idsOf(learnable)).toEqual(engine.skillSlotsOfJob(engine.jobIds.meister).learnedSkillIds);
        expect([...learnable, ...selfBuffs].every((skill) => skill.name.length > 0 && skill.highestLevel >= 1)).toBe(true);
    });

    it("gives each own buff the range and the labels of the original's panel", () => {
        const knightJobId = 7;
        const cavalryMasterySkillId = 78;
        const autoBerserkSkillId = 12;
        const selfBuffs = engine.catalog.selfBuffsOfJob(knightJobId);

        expect(selfBuffs.find((buff) => buff.id === cavalryMasterySkillId)).toMatchObject({
            highestLevel: 6,
            choices: [
                { value: 0, label: "ペコなし" },
                { value: 1, label: "修練0" },
                { value: 2, label: "修練1" },
                { value: 3, label: "修練2" },
                { value: 4, label: "修練3" },
                { value: 5, label: "修練4" },
                { value: 6, label: "修練5" },
            ],
        });
        expect(selfBuffs.find((buff) => buff.id === autoBerserkSkillId)).toEqual({ id: autoBerserkSkillId, name: engine.names.skillName(autoBerserkSkillId), highestLevel: 1 });
        expect(idsOf(selfBuffs)).toEqual(engine.skillSlotsOfJob(knightJobId).passiveSkillIds);
    });

    it("offers one own buff differently to the jobs the original does", () => {
        const highestOf = (jobId: number, skillId: number) => engine.catalog.selfBuffsOfJob(jobId).find((buff) => buff.id === skillId)?.highestLevel;
        const jobsWithSkill185 = engine.catalog.jobs().filter((job) => highestOf(job.id, 185) !== undefined);

        expect(new Set(jobsWithSkill185.map((job) => highestOf(job.id, 185))).size).toBeGreaterThan(1);
    });

    it("has a definition for every own buff of every job", () => {
        for (const job of engine.catalog.jobs()) {
            expect(idsOf(engine.catalog.selfBuffsOfJob(job.id)), job.name).toEqual(engine.skillSlotsOfJob(job.id).passiveSkillIds);
        }
    });

    it("describes each support buff with its panel, control and limits", () => {
        const supportBuffs = engine.catalog.supportBuffs();

        expect(supportBuffs.find((buff) => buff.name === "BLESSING")).toEqual({
            name: "BLESSING",
            label: "ブレッシング",
            section: "confIchizi",
            control: "number",
            lowest: 0,
            highest: 10,
        });
        expect(supportBuffs.find((buff) => buff.name === "ADRENALINE_RUSH")?.choices).toEqual([
            { value: 0, label: "OFF" },
            { value: 1, label: "通常AR" },
            { value: 2, label: "フルAR" },
            { value: 3, label: "ｽｸﾛｰﾙ" },
        ]);
        expect(supportBuffs.find((buff) => buff.name === "BLESSING")?.choices).toBeUndefined();
        expect(supportBuffs.filter((buff) => buff.control === "toggle").every((buff) => buff.lowest === 0 && buff.highest === 1)).toBe(true);
        expect(supportBuffs.every((buff) => engine.calcModelLayout.supportBuffLocations.get(buff.name)?.section === buff.section)).toBe(true);
        expect(new Set(supportBuffs.map((buff) => buff.name)).size).toBe(supportBuffs.length);
    });

    it("lists the timed effects with what they do, and the three speed potions", () => {
        const timedItems = engine.catalog.timedItems();

        expect(idsOf(timedItems)).not.toContain(0);
        expect(timedItems.find((timedItem) => timedItem.id === 1)).toEqual({ id: 1, name: "アイシラカード", detail: "詠唱-50%、FLEE+30" });
        expect(timedItems.every((timedItem) => engine.hasTimedItem(timedItem.id))).toBe(true);
        expect(new Set(idsOf(timedItems)).size).toBe(timedItems.length);
        // In the engine's table, but not in the list the original offers.
        expect(engine.hasTimedItem(timedItemTheOriginalDoesNotList)).toBe(true);
        expect(idsOf(timedItems)).not.toContain(timedItemTheOriginalDoesNotList);
        // The original's own order, not the order of the IDs.
        expect(idsOf(timedItems)).not.toEqual([...idsOf(timedItems)].sort((oneId, otherId) => oneId - otherId));
        expect(idsOf(engine.catalog.speedPotions())).toEqual([1, 2, 3]);
        expect(positionalBuffPanels.map((panel) => engine.catalog.positionalBuffs(panel).length)).toEqual([18, 53, 15]);
        const positionsInOrder = engine.catalog.positionalBuffs("guildBuffs").map((buff) => buff.position);
        expect(positionsInOrder).toEqual([...positionsInOrder].sort((onePosition, otherPosition) => onePosition - otherPosition));
        expect(engine.hasSpeedPotion(0)).toBe(false);
        expect(engine.hasSpeedPotion(4)).toBe(false);
    });

    it("gives empty lists for an unknown job or item", () => {
        expect(engine.catalog.itemsForSlot("rightHand", unknownId)).toEqual([]);
        expect(engine.catalog.attackSkillsOfJob(unknownId)).toEqual([]);
        expect(engine.catalog.slotsOfItem(unknownId)).toEqual([]);
        expect(engine.catalog.learnableSkillsOfJob(unknownId)).toEqual([]);
        expect(engine.catalog.selfBuffsOfJob(unknownId)).toEqual([]);
    });
});
