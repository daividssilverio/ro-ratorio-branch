import { type AttackMethod, type AttackOptionList, type AttackSource, chosenOptionsOf, isOfferedByOption, type Scenario } from "@ro-ratorio-branch/core/platform-neutral";
import { t } from "./text/ui-text.ts";

const sourceLabels: Readonly<Record<AttackSource, string | undefined>> = {
    job: undefined,
    gear: t("装備 · カード · スクロール"),
    autoSpell: t("オートスペル"),
};

/**
 * One attack as a row of the picker. Attacks from different sources can
 * share a skill, so the row's ID is its place in the list; `textId` is the
 * skill, whose reading and aliases the row is found by.
 */
export interface AttackEntry {
    readonly id: number;
    readonly textId: number;
    readonly name: string;
    readonly detail?: string;
}

export function attackEntriesOf(attackMethods: readonly AttackMethod[]): AttackEntry[] {
    return attackMethods.map((attackMethod, index) => {
        const detail = sourceLabels[attackMethod.source];
        return { id: index, textId: attackMethod.skillId, name: attackMethod.name, ...(detail === undefined ? {} : { detail }) };
    });
}

/** The attack the scenario names, if the character has it. */
export function attackOfScenario(attackMethods: readonly AttackMethod[], scenario: Pick<Scenario, "skillId" | "skillSource">): AttackMethod | undefined {
    return attackMethods.find((attackMethod) => attackMethod.skillId === scenario.skillId && attackMethod.source === (scenario.skillSource ?? "job"));
}

function scenarioWithChoices(scenario: Scenario, attackMethod: AttackMethod, level: number | undefined, optionValues: readonly number[]): Scenario {
    const [chosenLevel, ...chosenOptions] = chosenOptionsOf(attackMethod, level, optionValues);
    const { skillName: _name, skillSource: _source, skillOptions: _options, ...scenarioWithoutAttackDetails } = scenario;
    return {
        ...scenarioWithoutAttackDetails,
        skillId: attackMethod.skillId,
        ...(attackMethod.source === "job" ? {} : { skillSource: attackMethod.source }),
        skillLevel: chosenLevel?.value ?? 1,
        ...(chosenOptions.length === 0 ? {} : { skillOptions: chosenOptions.map((chosen) => chosen.value) }),
    };
}

/** The scenario attacking with another attack, at its default level and with its default options. */
export function scenarioWithAttack(scenario: Scenario, attackMethod: AttackMethod): Scenario {
    return scenarioWithChoices(scenario, attackMethod, undefined, []);
}

/** One thing to set on the scenario's attack: its level (position 0) or one of its options. */
export interface AttackRow {
    readonly position: number;
    /** Empty where upstream gives the option no label. */
    readonly label: string;
    readonly optionList: AttackOptionList;
    readonly value: number;
    /** Whether the option takes the value the scenario has for it. */
    readonly isOffered: boolean;
}

export function attackRowsOf(attackMethod: AttackMethod, scenario: Pick<Scenario, "skillLevel" | "skillOptions">): AttackRow[] {
    return chosenOptionsOf(attackMethod, scenario.skillLevel, scenario.skillOptions ?? []).map(({ optionList, value }, position) => ({
        position,
        label: optionList.label,
        optionList,
        value,
        isOffered: isOfferedByOption(optionList, value),
    }));
}

/**
 * The scenario with one row set. What follows the row keeps its value where
 * the option still takes it, and falls back to its default where it does not
 * (another level can bring other options).
 */
export function scenarioWithAttackRow(scenario: Scenario, attackMethod: AttackMethod, position: number, value: number): Scenario {
    const level = position === 0 ? value : scenario.skillLevel;
    const wantedOptions = [...(scenario.skillOptions ?? [])];
    if (position > 0) {
        wantedOptions[position - 1] = value;
    }
    const chosen = chosenOptionsOf(attackMethod, level, wantedOptions);
    const keptOptions: number[] = [];
    for (const { optionList, value: wanted } of chosen.slice(1)) {
        const kept = isOfferedByOption(optionList, wanted) ? wanted : optionList.defaultValue;
        keptOptions.push(kept);
        if (kept !== wanted) {
            // What follows a replaced value is a different chain: take its defaults.
            return scenarioWithChoices(scenario, attackMethod, level, keptOptions);
        }
    }
    return scenarioWithChoices(scenario, attackMethod, level, keptOptions);
}
