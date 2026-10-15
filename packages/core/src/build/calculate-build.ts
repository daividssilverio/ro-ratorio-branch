import { type AttackMethod, chosenOptionsOf, isOfferedByOption } from "../engine-adapter/attack-methods.ts";
import type { BattleSummary } from "../engine-adapter/battle-summary.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { StatSnapshot } from "../engine-adapter/stat-snapshot.ts";
import type { Build, Scenario } from "./build-format.ts";
import { BuildConversionError, type BuildConversionIssue, convertBuildToCalcModel, randomOptionsOfSlot } from "./convert-build.ts";

export interface BuildCalculation {
    readonly battleSummary: BattleSummary;
    readonly statSnapshot: StatSnapshot;
}

/**
 * Calculates the build's scenario: its attack against its target monster.
 * @throws {BuildConversionError} listing everything the engine cannot take.
 */
export function calculateBuild(build: Build, engine: RatorioEngine): BattleSummary {
    return calculateBuildInDetail(build, engine).battleSummary;
}

/**
 * Like `calculateBuild`, and also returns the character's computed stats and bonuses.
 *
 * Which attacks a character has depends on what it wears, which the engine
 * only knows once it has taken the character in. So the attack is checked
 * after a first calculation, and where the scenario leaves options out, the
 * build is calculated again with the skill's defaults for them.
 * @throws {BuildConversionError} listing everything the engine cannot take.
 */
export function calculateBuildInDetail(build: Build, engine: RatorioEngine): BuildCalculation {
    const calcModel = convertBuildToCalcModel(build, engine);
    const randomOptions = randomOptionsOfSlot(build.character.equipment);
    let battleResult: ReturnType<RatorioEngine["calculateBattleResult"]>;
    try {
        battleResult = engine.calculateBattleResult(calcModel, build.scenario.targetMonsterId, randomOptions);
    } catch (engineFailure) {
        // The engine can fail outright on an attack the character does not have; say so if that is the reason.
        const attackTheEngineFailedOn = resolveAttack(build.scenario, attackMethodsOfBuild(build, engine));
        throw "issues" in attackTheEngineFailedOn ? new BuildConversionError(attackTheEngineFailedOn.issues) : engineFailure;
    }

    const attack = resolveAttack(build.scenario, engine.attackMethodsOfLastCalculation());
    if ("issues" in attack) {
        throw new BuildConversionError(attack.issues);
    }
    const givenOptionValues = calcModel.attackMethod.optionValueArray;
    if (attack.optionValues.some((value, position) => value !== givenOptionValues[position])) {
        calcModel.attackMethod = { ...calcModel.attackMethod, optionValueArray: attack.optionValues };
        battleResult = engine.calculateBattleResult(calcModel, build.scenario.targetMonsterId, randomOptions);
    }
    return {
        battleSummary: engine.summarizeBattleResult(battleResult),
        statSnapshot: engine.snapshotStats(battleResult),
    };
}

/**
 * Every attack the build's character can use, whatever its scenario attacks with.
 * @throws {BuildConversionError} when the character itself cannot be calculated.
 */
export function attackMethodsOfBuild(build: Build, engine: RatorioEngine): AttackMethod[] {
    const { skillSource: _source, skillOptions: _options, ...scenario } = build.scenario;
    const withAPlainAttack: Build = { ...build, scenario: { ...scenario, skillId: engine.skillIds.basicAttack, skillLevel: 1 } };
    engine.calculateBattleResult(convertBuildToCalcModel(withAPlainAttack, engine), scenario.targetMonsterId, randomOptionsOfSlot(build.character.equipment));
    return engine.attackMethodsOfLastCalculation();
}

/**
 * The scenario's attack against what the character can use: the value of
 * every option the skill has, with its defaults where the scenario gives
 * none, or what is wrong with it.
 */
export function resolveAttack(scenario: Scenario, attackMethods: readonly AttackMethod[]): { readonly optionValues: number[] } | { readonly issues: BuildConversionIssue[] } {
    const source = scenario.skillSource ?? "job";
    const attackMethod = attackMethods.find((candidate) => candidate.skillId === scenario.skillId && candidate.source === source);
    if (attackMethod === undefined) {
        return { issues: [{ kind: "attackNotOffered", skillId: scenario.skillId, source }] };
    }
    const [level, ...options] = chosenOptionsOf(attackMethod, scenario.skillLevel, scenario.skillOptions ?? []);
    const issues: BuildConversionIssue[] = [];
    if (level !== undefined && !isOfferedByOption(level.optionList, level.value)) {
        issues.push({ kind: "attackLevelNotOffered", skillId: scenario.skillId, level: scenario.skillLevel });
    }
    options.forEach(({ optionList, value }, index) => {
        if (!isOfferedByOption(optionList, value)) {
            issues.push({ kind: "attackOptionNotOffered", skillId: scenario.skillId, position: index + 1, value });
        }
    });
    return issues.length > 0 ? { issues } : { optionValues: options.map(({ value }) => value) };
}
