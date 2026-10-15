import type { Build } from "../build/build-format.ts";
import type { BuildCalculator, BuildOutcome } from "../tree/evaluate-tree.ts";

/**
 * Wraps a calculator so that a build it has already calculated is answered
 * from memory. Evaluating a tree again after an edit then only calculates the
 * builds the edit changed: the edited node and the nodes below it.
 *
 * The least recently used builds are forgotten beyond `maximumRememberedBuilds`.
 */
export function rememberOutcomes(calculate: BuildCalculator, maximumRememberedBuilds = 500): BuildCalculator {
    const outcomeOfBuildKey = new Map<string, Promise<BuildOutcome>>();

    return (build) => {
        const buildKey = canonicalJson(build);
        const rememberedOutcome = outcomeOfBuildKey.get(buildKey);
        if (rememberedOutcome !== undefined) {
            // Re-inserting moves the entry to the most recently used end.
            outcomeOfBuildKey.delete(buildKey);
            outcomeOfBuildKey.set(buildKey, rememberedOutcome);
            return rememberedOutcome;
        }

        const outcome = Promise.resolve().then(() => calculate(build));
        outcomeOfBuildKey.set(buildKey, outcome);
        outcome.catch(() => outcomeOfBuildKey.delete(buildKey));
        for (const oldestBuildKey of outcomeOfBuildKey.keys()) {
            if (outcomeOfBuildKey.size <= maximumRememberedBuilds) {
                break;
            }
            outcomeOfBuildKey.delete(oldestBuildKey);
        }
        return outcome;
    };
}

/** JSON with object keys in sorted order, so two equal builds give the same text however they were assembled. */
export function canonicalJson(value: Build | unknown): string {
    return JSON.stringify(value, (_key, nestedValue: unknown) =>
        typeof nestedValue === "object" && nestedValue !== null && !Array.isArray(nestedValue)
            ? Object.fromEntries(Object.entries(nestedValue).sort(([firstKey], [secondKey]) => (firstKey < secondKey ? -1 : 1)))
            : nestedValue,
    );
}
