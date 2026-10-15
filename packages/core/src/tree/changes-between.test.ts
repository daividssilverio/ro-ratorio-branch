import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Character } from "../build/build-format.ts";
import { parseBuild } from "../build/parse-build.ts";
import { applyChange } from "./apply-change.ts";
import { changesBetween } from "./changes-between.ts";
import type { Change } from "./tree-format.ts";
import { mechanicBuild } from "./tree-test-support.ts";

function goldenCharacter(goldenBuildName: string): Character {
    const buildFileUrl = new URL(`../build/golden-builds/${goldenBuildName}.build.json`, import.meta.url);
    return parseBuild(JSON.parse(readFileSync(buildFileUrl, "utf8"))).character;
}

function after(character: Character, changes: ReturnType<typeof changesBetween>["changes"]): Character {
    return changes.reduce((current, change) => {
        const application = applyChange(current, change);
        if (!application.applied) {
            throw new Error(`change did not apply: ${application.staleReason}`);
        }
        return application.character;
    }, character);
}

const firstMechanic = mechanicBuild.character;
const secondMechanic = goldenCharacter("mechanic-arms-cannon-soul-cannonball");

describe("changesBetween", () => {
    it("finds nothing between a character and itself", () => {
        expect(changesBetween(firstMechanic, firstMechanic)).toEqual({ changes: [], inexpressible: [] });
    });

    it("gives changes that turn the first character's gear, stats, skills and buffs into the second's", () => {
        const { changes } = changesBetween(firstMechanic, secondMechanic);

        const changed = after(firstMechanic, changes);

        expect(changed.equipment).toEqual(secondMechanic.equipment);
        expect(changed.baseStats).toEqual(secondMechanic.baseStats);
        expect(changed.learnedSkills).toEqual(secondMechanic.learnedSkills);
        expect(changed.supportBuffs ?? {}).toEqual(secondMechanic.supportBuffs ?? {});
    });

    it("replaces only the slots whose piece differs", () => {
        const { changes } = changesBetween(firstMechanic, secondMechanic);

        const replacedSlots = changes.flatMap((change) => (change.kind === "setGearPiece" ? [change.slot] : []));
        expect(replacedSlots).not.toContain("headMid");
        expect(replacedSlots).toContain("rightHand");
    });

    it("removes a skill or buff the second character does not have, with level 0", () => {
        const { changes } = changesBetween(firstMechanic, secondMechanic);

        expect(changes).toContainEqual({ kind: "setSupportBuff", name: "ADRENALINE_RUSH", value: 0 });
    });

    it("names what no change can express, such as another job or level", () => {
        const { inexpressible } = changesBetween(firstMechanic, goldenCharacter("arch-mage-frozen-slash"));

        expect(inexpressible).toEqual(["jobId", "baseLevel", "jobLevel"]);
    });

    it("turns consumables, endow, ammunition, timed effects, auto-spells, panel buffs and customisation into changes that give the second character", () => {
        const changed: Character = {
            ...firstMechanic,
            guildBuffs: { 5: 1 },
            itemBuffs: { 9: 1, 3: 10 },
            otherBuffs: { 0: 55 },
            customization: { attack: { ATK_PLUS: -50 }, skill: { SKILL_DAMAGE_UP: 25 } },
            timedItems: [79, 79],
            autoSpells: [{ autoSpellId: 2, level: 3, chancePerMille: 100 }],
            speedPotion: 2,
            weaponElement: 3,
            arrowId: 1,
        };
        const applyAll = (character: Character, changes: readonly Change[]) =>
            changes.reduce((current, change) => {
                const application = applyChange(current, change);
                if (!application.applied) {
                    throw new Error(`a change did not apply: ${change.kind}`);
                }
                return application.character;
            }, character);

        const there = changesBetween(firstMechanic, changed);
        const back = changesBetween(changed, firstMechanic);

        expect(there.inexpressible).toEqual([]);
        expect(new Set(there.changes.map((change) => change.kind))).toEqual(new Set(["setPanelBuff", "setCustomization", "setTimedItems", "setAutoSpells", "setSpeedPotion", "setWeaponElement", "setArrow"]));
        expect(changesBetween(applyAll(firstMechanic, there.changes), changed)).toEqual({ changes: [], inexpressible: [] });
        expect(changesBetween(applyAll(changed, back.changes), firstMechanic)).toEqual({ changes: [], inexpressible: [] });
        expect(parseBuild({ formatVersion: 1, character: applyAll(changed, back.changes), scenario: { skillId: 0, skillLevel: 1, targetMonsterId: 1 } }).character).toBeDefined();
    });
});
