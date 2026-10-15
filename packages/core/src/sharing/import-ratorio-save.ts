import type { Build, Character, Equipment, GearPiece, Scenario } from "../build/build-format.ts";
import { attackMethodsOfBuild } from "../build/calculate-build.ts";
import { BuildConversionError } from "../build/convert-build.ts";
import { chosenOptionsOf } from "../engine-adapter/attack-methods.ts";
import { type EquipmentSlot, equipmentSlots } from "../character-vocabulary.ts";
import type { SupportBuffSection } from "../engine-adapter/calc-model-layout.ts";
import { type CustomizationSection, customizationSections, type NamedSettingsLayout, type TargetSettingSection, targetSettingSections } from "../engine-adapter/named-settings.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { RatorioSaveContent } from "../engine-adapter/ratorio-save.ts";
import { panelDefinitions, type PositionalBuffPanel, positionalBuffPanels } from "../panels/panel-definitions.ts";

/** Something a ratorio save holds that the import left out. */
export type NotImportedPart =
    | { readonly kind: "upstreamSection"; readonly section: string }
    | { readonly kind: "supportBuffWithoutName"; readonly section: SupportBuffSection; readonly position: number }
    | { readonly kind: "skillWithoutSlot"; readonly list: "learnedSkills" | "selfBuffs"; readonly position: number }
    | { readonly kind: "panelBuffWithoutDefinition"; readonly panel: PositionalBuffPanel; readonly position: number }
    | { readonly kind: "customizationWithoutName"; readonly section: CustomizationSection; readonly position: number }
    | { readonly kind: "targetSettingWithoutName"; readonly section: TargetSettingSection; readonly position: number };

export interface RatorioSaveImport {
    readonly character: Character;
    /** `null` when the save names no target monster or no attack. */
    readonly scenario: Scenario | null;
    /** Everything the save held that is not in the character or scenario. Empty when the import is complete. */
    readonly notImported: readonly NotImportedPart[];
}

/** Turns what a ratorio save says into a character and a scenario, and reports what it could not carry over. */
export function importRatorioSave(content: RatorioSaveContent, engine: RatorioEngine): RatorioSaveImport {
    const notImported: NotImportedPart[] = content.uninterpretedUnitTypes.map((section) => ({ kind: "upstreamSection", section }));

    const equipment: Equipment = {};
    for (const slot of equipmentSlots) {
        const savedPiece = content.gear[slot];
        // A save holds upstream's stand-in item in a slot that is empty.
        if (savedPiece === undefined || savedPiece.itemId === engine.calcModelLayout.emptyItemIdOfSlot[slot]) {
            continue;
        }
        const gearPiece: GearPiece = { itemId: savedPiece.itemId };
        if (savedPiece.refine !== 0) gearPiece.refine = savedPiece.refine;
        if (savedPiece.transcendence !== 0) gearPiece.transcendence = savedPiece.transcendence;
        const sockets = savedPiece.cardOrEnchantIds.map((cardOrEnchantId) => (cardOrEnchantId === 0 ? null : cardOrEnchantId));
        while (sockets.at(-1) === null) {
            sockets.pop();
        }
        if (sockets.length > 0) gearPiece.sockets = sockets;
        if (savedPiece.randomOptions.length > 0) gearPiece.randomOptions = savedPiece.randomOptions.map((randomOption) => (randomOption === null ? null : { ...randomOption }));
        equipment[slot] = gearPiece;
    }

    const { learnedSkillIds, passiveSkillIds } = engine.skillSlotsOfJob(content.jobId);
    const levelsBySkillId = (levels: readonly number[], skillIdsInSlotOrder: readonly number[], list: "learnedSkills" | "selfBuffs") => {
        const levelOfSkillId: Record<string, number> = {};
        levels.forEach((level, position) => {
            const skillId = skillIdsInSlotOrder[position];
            if (level === 0) {
                return;
            }
            if (skillId === undefined) {
                notImported.push({ kind: "skillWithoutSlot", list, position });
            } else {
                levelOfSkillId[String(skillId)] = level;
            }
        });
        return levelOfSkillId;
    };
    const learnedSkills = levelsBySkillId(content.learnedSkillLevels, learnedSkillIds, "learnedSkills");
    const selfBuffs = levelsBySkillId(content.selfBuffLevels, passiveSkillIds, "selfBuffs");

    const supportBuffs: Record<string, number> = {};
    for (const [section, values] of Object.entries(content.supportBuffValues) as [SupportBuffSection, readonly number[]][]) {
        values.forEach((value, position) => {
            if (value === 0) {
                return;
            }
            const buffName = supportBuffNameAt(engine, section, position);
            if (buffName === undefined) {
                notImported.push({ kind: "supportBuffWithoutName", section, position });
            } else {
                supportBuffs[buffName] = value;
            }
        });
    }

    const positionalBuffsOf = (panel: PositionalBuffPanel) => {
        const valueOfPosition: Record<string, number> = {};
        content.positionalBuffValues[panel].forEach((value, position) => {
            if (value === 0) {
                return;
            }
            if (panelDefinitions[panel][String(position)] === undefined) {
                notImported.push({ kind: "panelBuffWithoutDefinition", panel, position });
            } else {
                valueOfPosition[String(position)] = value;
            }
        });
        return valueOfPosition;
    };

    const namedValuesOf = (values: readonly number[], settingsLayout: NamedSettingsLayout, reportMissing: (position: number) => void) => {
        const nameOfPosition = new Map([...settingsLayout.positionOfName].map(([name, position]) => [position, name]));
        const valueOfName: Record<string, number> = {};
        values.forEach((value, position) => {
            const name = nameOfPosition.get(position);
            if (value === 0) {
                return;
            }
            if (name === undefined) {
                reportMissing(position);
            } else {
                valueOfName[name] = value;
            }
        });
        return valueOfName;
    };
    const customization: NonNullable<Character["customization"]> = {};
    for (const section of customizationSections) {
        const valueOfName = namedValuesOf(content.customizationValues[section], engine.calcModelLayout.customizations[section], (position) => notImported.push({ kind: "customizationWithoutName", section, position }));
        if (Object.keys(valueOfName).length > 0) customization[section] = valueOfName;
    }
    const targetSettings: NonNullable<Scenario["targetSettings"]> = {};
    for (const section of targetSettingSections) {
        const valueOfName = namedValuesOf(content.targetSettingValues[section], engine.calcModelLayout.targetSettings[section], (position) => notImported.push({ kind: "targetSettingWithoutName", section, position }));
        if (Object.keys(valueOfName).length > 0) targetSettings[section] = valueOfName;
    }

    const character: Character = {
        jobId: content.jobId,
        baseLevel: content.baseLevel,
        jobLevel: content.jobLevel,
        baseStats: { ...content.baseStats },
        equipment,
    };
    if (Object.values(content.traitStats).some((points) => points !== 0)) character.traitStats = { ...content.traitStats };
    if (Object.keys(learnedSkills).length > 0) character.learnedSkills = learnedSkills;
    if (Object.keys(selfBuffs).length > 0) character.selfBuffs = selfBuffs;
    if (Object.keys(supportBuffs).length > 0) character.supportBuffs = supportBuffs;
    for (const panel of positionalBuffPanels) {
        const valueOfPosition = positionalBuffsOf(panel);
        if (Object.keys(valueOfPosition).length > 0) character[panel] = valueOfPosition;
    }
    if (content.autoSpells.length > 0) {
        character.autoSpells = content.autoSpells.map(({ autoSpellId, level, chancePerMille }) => ({ autoSpellId, ...(level === 0 ? {} : { level }), chancePerMille }));
    }
    if (Object.keys(customization).length > 0) character.customization = customization;
    if (content.timedItemIds.length > 0) character.timedItems = [...content.timedItemIds];
    if (content.speedPotion !== 0) character.speedPotion = content.speedPotion;
    if (content.weaponElement !== 0) character.weaponElement = content.weaponElement;
    if (content.arrowId !== 0) character.arrowId = content.arrowId;

    const scenario = scenarioOf(content, character, engine);
    if (scenario !== null && Object.keys(targetSettings).length > 0) scenario.targetSettings = targetSettings;
    return { character, scenario, notImported };
}

function scenarioOf(content: RatorioSaveContent, character: Character, engine: RatorioEngine): Scenario | null {
    if (content.attack === undefined || content.targetMonsterId === undefined) {
        return null;
    }
    const scenario: Scenario = {
        skillId: content.attack.skillId,
        skillLevel: content.attack.skillLevel,
        targetMonsterId: content.targetMonsterId,
    };
    if (content.attack.source !== "job") scenario.skillSource = content.attack.source;
    const skillOptions = content.attack.options.slice(0, optionCountOfAttack({ formatVersion: 1, character, scenario }, engine) ?? content.attack.options.length);
    if (skillOptions.length > 0) scenario.skillOptions = skillOptions;
    return scenario;
}

/**
 * How many options the build's attack has after its level. A save pads its
 * options with 0, which is also a value an option can have, so the padding
 * can only be told apart by counting. `undefined` when the build cannot be
 * calculated or the character has no such attack.
 */
function optionCountOfAttack(build: Build, engine: RatorioEngine): number | undefined {
    try {
        const source = build.scenario.skillSource ?? "job";
        const attackMethod = attackMethodsOfBuild(build, engine).find((candidate) => candidate.skillId === build.scenario.skillId && candidate.source === source);
        return attackMethod === undefined ? undefined : chosenOptionsOf(attackMethod, build.scenario.skillLevel, build.scenario.skillOptions ?? []).length - 1;
    } catch (error) {
        if (error instanceof BuildConversionError) {
            return undefined;
        }
        throw error;
    }
}

function supportBuffNameAt(engine: RatorioEngine, section: SupportBuffSection, position: number): string | undefined {
    for (const [buffName, location] of engine.calcModelLayout.supportBuffLocations) {
        if (location.section === section && location.position === position) {
            return buffName;
        }
    }
    return undefined;
}
