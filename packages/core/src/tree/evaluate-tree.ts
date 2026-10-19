import { buildFormatVersion, type Build, type Character, type Scenario } from "../build/build-format.ts";
import { type BuildCalculation, calculateBuildInDetail } from "../build/calculate-build.ts";
import { BuildConversionError, type BuildConversionIssue } from "../build/convert-build.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { resolveTree, type StaleChange } from "./resolve-tree.ts";
import type { Tree } from "./tree-format.ts";

/** What calculating one build gives: numbers, or the reasons the engine cannot take it. */
export type BuildOutcome =
    | ({ readonly state: "ready" } & BuildCalculation)
    | { readonly state: "notCalculable"; readonly issues: readonly BuildConversionIssue[] };

export type NodeEvaluation =
    | ({ readonly state: "ready"; readonly character: Character } & BuildCalculation)
    | {
          readonly state: "notCalculable";
          readonly character: Character;
          readonly issues: readonly BuildConversionIssue[];
      }
    | { readonly state: "stale"; readonly staleChanges: readonly StaleChange[] };

export interface TreeEvaluation {
    readonly root: Exclude<NodeEvaluation, { state: "stale" }>;
    readonly nodes: ReadonlyMap<string, NodeEvaluation>;
}

export type BuildCalculator = (build: Build) => BuildOutcome | Promise<BuildOutcome>;

/** A calculator that runs on the given engine, in this thread. */
export function calculatorOn(engine: RatorioEngine): BuildCalculator {
    return (build) => outcomeOf(build, engine);
}

/** A build calculated on an engine, or why the engine cannot calculate it. */
export function outcomeOf(build: Build, engine: RatorioEngine): BuildOutcome {
    try {
        return { state: "ready", ...calculateBuildInDetail(build, engine) };
    } catch (error) {
        if (error instanceof BuildConversionError) {
            return { state: "notCalculable", issues: error.issues };
        }
        throw error;
    }
}

/** Calculates the root and every node that is not stale, each against the tree's shared scenario. */
export async function evaluateTree(tree: Tree, calculate: BuildCalculator): Promise<TreeEvaluation> {
    const evaluate = async (character: Character) =>
        ({ character, ...(await calculate(buildOf(character, tree.scenario))) }) as const;

    const nodeEvaluations = [...resolveTree(tree)].map(async ([nodeId, resolution]): Promise<[string, NodeEvaluation]> => {
        return [nodeId, resolution.state === "stale" ? resolution : await evaluate(resolution.character)];
    });

    return { root: await evaluate(tree.root), nodes: new Map(await Promise.all(nodeEvaluations)) };
}

export function buildOf(character: Character, scenario: Scenario): Build {
    return { formatVersion: buildFormatVersion, character, scenario };
}

export type ReadyNodeEvaluation = Extract<NodeEvaluation, { state: "ready" }>;
