import type { Character } from "../build/build-format.ts";
import { baseStatNames, equipmentSlots, traitStatNames } from "../character-vocabulary.ts";
import { canonicalJson } from "../calculation/remember-outcomes.ts";
import { customizationSections } from "../engine-adapter/named-settings.ts";
import { positionalBuffPanels } from "../panels/panel-definitions.ts";
import type { Change } from "./tree-format.ts";

/** A difference between two characters that no change kind can express. */
export type InexpressibleDifference = "jobId" | "baseLevel" | "jobLevel" | "costumeId";

export interface ChangesBetween {
    /** Applied in order to the first character, these give the second one, apart from `inexpressible`. */
    readonly changes: readonly Change[];
    readonly inexpressible: readonly InexpressibleDifference[];
}

/**
 * The changes that turn one character into another, so that someone else's
 * build can become a branch of your own tree. A slot whose piece differs in
 * any way is replaced as a whole.
 */
export function changesBetween(from: Character, to: Character): ChangesBetween {
    const changes: Change[] = [];

    for (const slot of equipmentSlots) {
        const pieceBefore = from.equipment[slot];
        const pieceAfter = to.equipment[slot];
        if (canonicalJson(pieceBefore ?? null) !== canonicalJson(pieceAfter ?? null)) {
            changes.push({ kind: "setGearPiece", slot, gearPiece: pieceAfter ?? null });
        }
    }
    for (const stat of baseStatNames) {
        if (from.baseStats[stat] !== to.baseStats[stat]) {
            changes.push({ kind: "setBaseStat", stat, value: to.baseStats[stat] });
        }
    }
    for (const stat of traitStatNames) {
        const pointsAfter = to.traitStats?.[stat] ?? 0;
        if ((from.traitStats?.[stat] ?? 0) !== pointsAfter) {
            changes.push({ kind: "setTraitStat", stat, value: pointsAfter });
        }
    }
    for (const [skillId, level] of differingEntries(from.learnedSkills, to.learnedSkills)) {
        changes.push({ kind: "setLearnedSkill", skillId: Number(skillId), level });
    }
    for (const [skillId, level] of differingEntries(from.selfBuffs, to.selfBuffs)) {
        changes.push({ kind: "setSelfBuff", skillId: Number(skillId), level });
    }
    for (const [name, value] of differingEntries(from.supportBuffs, to.supportBuffs)) {
        changes.push({ kind: "setSupportBuff", name, value });
    }

    for (const panel of positionalBuffPanels) {
        for (const [position, value] of differingEntries(from[panel], to[panel])) {
            changes.push({ kind: "setPanelBuff", panel, position: Number(position), value });
        }
    }
    for (const section of customizationSections) {
        for (const [name, value] of differingEntries(from.customization?.[section], to.customization?.[section])) {
            changes.push({ kind: "setCustomization", section, name, value });
        }
    }
    if (canonicalJson(from.timedItems ?? []) !== canonicalJson(to.timedItems ?? [])) changes.push({ kind: "setTimedItems", timedItems: [...(to.timedItems ?? [])] });
    if (canonicalJson(from.autoSpells ?? []) !== canonicalJson(to.autoSpells ?? [])) changes.push({ kind: "setAutoSpells", autoSpells: (to.autoSpells ?? []).map((autoSpell) => ({ ...autoSpell })) });
    if ((from.speedPotion ?? 0) !== (to.speedPotion ?? 0)) changes.push({ kind: "setSpeedPotion", speedPotion: to.speedPotion ?? 0 });
    if ((from.weaponElement ?? 0) !== (to.weaponElement ?? 0)) changes.push({ kind: "setWeaponElement", elementId: to.weaponElement ?? 0 });
    if ((from.arrowId ?? 0) !== (to.arrowId ?? 0)) changes.push({ kind: "setArrow", arrowId: to.arrowId ?? 0 });

    const inexpressible: InexpressibleDifference[] = [];
    if (from.jobId !== to.jobId) inexpressible.push("jobId");
    if (from.baseLevel !== to.baseLevel) inexpressible.push("baseLevel");
    if (from.jobLevel !== to.jobLevel) inexpressible.push("jobLevel");
    if ((from.costumeId ?? 0) !== (to.costumeId ?? 0)) inexpressible.push("costumeId");

    return { changes, inexpressible };
}

/** Each key whose value differs, with its value in `after`; 0 for a key that `after` no longer has. */
function differingEntries(
    before: Readonly<Record<string, number>> | undefined,
    after: Readonly<Record<string, number>> | undefined,
): [string, number][] {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    return [...keys].flatMap((key): [string, number][] => {
        const valueAfter = after?.[key] ?? 0;
        return (before?.[key] ?? 0) === valueAfter ? [] : [[key, valueAfter]];
    });
}
