import { weaponElementOf } from "../build/convert-build.ts";
import type { Build } from "../build/build-format.ts";
import { attackMethodsOfBuild, resolveAttack } from "../build/calculate-build.ts";
import { BuildConversionError } from "../build/convert-build.ts";
import { type EquipmentSlot, equipmentSlots, socketCountOfSlot } from "../character-vocabulary.ts";
import type { SupportBuffSection } from "../engine-adapter/calc-model-layout.ts";
import type { CustomizationSection, NamedSettingsLayout, TargetSettingSection } from "../engine-adapter/named-settings.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { RatorioSaveContent, RatorioSaveGearPiece } from "../engine-adapter/ratorio-save.ts";
import { panelDefinitions, type PositionalBuffPanel } from "../panels/panel-definitions.ts";

/** Something a build holds that a ratorio save has no place for. */
export type NotExportedPart =
    | { readonly kind: "skillWithoutSlot"; readonly list: "learnedSkills" | "selfBuffs"; readonly skillId: number }
    | { readonly kind: "unknownSupportBuff"; readonly name: string }
    | { readonly kind: "unknownPanelBuff"; readonly panel: PositionalBuffPanel; readonly position: number }
    /** The setting is not one upstream has, or one its saves have no place for. */
    | { readonly kind: "customizationNotInSaves"; readonly section: CustomizationSection; readonly name: string }
    | { readonly kind: "unknownTargetSetting"; readonly section: TargetSettingSection; readonly name: string }
    /** A ratorio save does not hold a costume. */
    | { readonly kind: "costumeNotInSaves" };

export interface RatorioSaveExport {
    readonly content: RatorioSaveContent;
    /** Everything the build held that the save does not carry. Empty when the export is complete. */
    readonly notExported: readonly NotExportedPart[];
}

const noTraitStats = { pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 };

/**
 * The value of every option of the build's attack, defaults included: a
 * save has no way of saying "the default". The scenario's own values for a
 * build that cannot be calculated.
 */
function optionValuesToSave(build: Build, engine: RatorioEngine): number[] {
    try {
        const attack = resolveAttack(build.scenario, attackMethodsOfBuild(build, engine));
        return "issues" in attack ? [...(build.scenario.skillOptions ?? [])] : attack.optionValues;
    } catch (error) {
        if (error instanceof BuildConversionError) {
            return [...(build.scenario.skillOptions ?? [])];
        }
        throw error;
    }
}

/**
 * Turns a build into what a ratorio save says, and reports what it could not carry over.
 * @throws {UnknownJobError} when the engine has no job with the build's job ID.
 */
export function exportRatorioSave(build: Build, engine: RatorioEngine): RatorioSaveExport {
    const { character, scenario } = build;
    const notExported: NotExportedPart[] = [];

    const gear: Partial<Record<EquipmentSlot, RatorioSaveGearPiece>> = {};
    for (const slot of equipmentSlots) {
        const gearPiece = character.equipment[slot];
        if (gearPiece !== undefined) {
            gear[slot] = {
                itemId: gearPiece.itemId,
                refine: gearPiece.refine ?? 0,
                transcendence: gearPiece.transcendence ?? 0,
                cardOrEnchantIds: Array.from({ length: socketCountOfSlot(slot) }, (_unused, index) => gearPiece.sockets?.[index] ?? 0),
                randomOptions: (gearPiece.randomOptions ?? []).map((randomOption) => (randomOption === null ? null : { optionId: randomOption.optionId, value: randomOption.value })),
            };
        }
    }

    const { learnedSkillIds, passiveSkillIds } = engine.skillSlotsOfJob(character.jobId);
    const levelsInSlotOrder = (levelOfSkillId: Readonly<Record<string, number>>, skillIdsInSlotOrder: readonly number[], list: "learnedSkills" | "selfBuffs") => {
        for (const skillId of Object.keys(levelOfSkillId).map(Number)) {
            if (!skillIdsInSlotOrder.includes(skillId)) {
                notExported.push({ kind: "skillWithoutSlot", list, skillId });
            }
        }
        return skillIdsInSlotOrder.map((skillId) => levelOfSkillId[String(skillId)] ?? 0);
    };

    const learnedSkillLevels = levelsInSlotOrder(character.learnedSkills ?? {}, learnedSkillIds, "learnedSkills");
    const selfBuffLevels = levelsInSlotOrder(character.selfBuffs ?? {}, passiveSkillIds, "selfBuffs");

    const supportBuffValues: Record<SupportBuffSection, number[]> = { confIchizi: [], confNizi: [], confSanzi: [], confYozi: [], confDebuff: [] };
    for (const [buffName, value] of Object.entries(character.supportBuffs ?? {})) {
        const location = engine.calcModelLayout.supportBuffLocations.get(buffName);
        if (location === undefined) {
            notExported.push({ kind: "unknownSupportBuff", name: buffName });
            continue;
        }
        const values = supportBuffValues[location.section];
        while (values.length < location.position) {
            values.push(0);
        }
        values[location.position] = value;
    }

    const slotValuesOf = (valueOfName: Readonly<Record<string, number>>, settingsLayout: NamedSettingsLayout, reportMissing: (name: string) => void) => {
        const values: number[] = [];
        for (const [name, value] of Object.entries(valueOfName)) {
            const position = settingsLayout.positionOfName.get(name);
            if (position === undefined || settingsLayout.namesSavesDoNotCarry.has(name)) {
                reportMissing(name);
                continue;
            }
            while (values.length < position) {
                values.push(0);
            }
            values[position] = value;
        }
        return values;
    };
    const customizationValuesOf = (section: CustomizationSection) =>
        slotValuesOf(character.customization?.[section] ?? {}, engine.calcModelLayout.customizations[section], (name) => notExported.push({ kind: "customizationNotInSaves", section, name }));
    const targetSettingValuesOf = (section: TargetSettingSection) =>
        slotValuesOf(scenario.targetSettings?.[section] ?? {}, engine.calcModelLayout.targetSettings[section], (name) => notExported.push({ kind: "unknownTargetSetting", section, name }));

    if ((character.costumeId ?? 0) !== 0) {
        notExported.push({ kind: "costumeNotInSaves" });
    }

    const positionalBuffValuesOf = (panel: PositionalBuffPanel) => {
        const values: number[] = [];
        for (const [positionKey, value] of Object.entries(character[panel] ?? {})) {
            if (panelDefinitions[panel][positionKey] === undefined) {
                notExported.push({ kind: "unknownPanelBuff", panel, position: Number(positionKey) });
                continue;
            }
            const position = Number(positionKey);
            while (values.length < position) {
                values.push(0);
            }
            values[position] = value;
        }
        return values;
    };

    return {
        content: {
            jobId: character.jobId,
            baseLevel: character.baseLevel,
            jobLevel: character.jobLevel,
            baseStats: { ...character.baseStats },
            traitStats: { ...(character.traitStats ?? noTraitStats) },
            gear,
            learnedSkillLevels,
            selfBuffLevels,
            supportBuffValues,
            autoSpells: (character.autoSpells ?? []).map((autoSpell) => ({ autoSpellId: autoSpell.autoSpellId, level: autoSpell.level ?? 0, chancePerMille: autoSpell.chancePerMille })),
            customizationValues: {
                status: customizationValuesOf("status"),
                attack: customizationValuesOf("attack"),
                defense: customizationValuesOf("defense"),
                skill: customizationValuesOf("skill"),
                traitStatus: customizationValuesOf("traitStatus"),
            },
            targetSettingValues: { asPlayer: targetSettingValuesOf("asPlayer"), ailments: targetSettingValuesOf("ailments"), buffs: targetSettingValuesOf("buffs") },
            positionalBuffValues: {
                guildBuffs: positionalBuffValuesOf("guildBuffs"),
                itemBuffs: positionalBuffValuesOf("itemBuffs"),
                otherBuffs: positionalBuffValuesOf("otherBuffs"),
            },
            timedItemIds: [...(character.timedItems ?? [])],
            speedPotion: character.speedPotion ?? 0,
            // The original has no element on a piece: what a weapon's option gives it travels as the endowment.
            weaponElement: weaponElementOf(character),
            arrowId: character.arrowId ?? 0,
            targetMonsterId: scenario.targetMonsterId,
            attack: { skillId: scenario.skillId, source: scenario.skillSource ?? "job", skillLevel: scenario.skillLevel, options: optionValuesToSave(build, engine) },
            uninterpretedUnitTypes: [],
        },
        notExported,
    };
}
