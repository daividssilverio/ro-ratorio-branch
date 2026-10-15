import type { BuildCalculator } from "../tree/evaluate-tree.ts";

/**
 * One calculator in front of several, each holding its own engine copy. An
 * engine copy handles one calculation at a time, so a build waits until a
 * calculator is free; with several calculators, builds run side by side.
 */
export function createCalculatorPool(calculators: readonly BuildCalculator[]): BuildCalculator {
    if (calculators.length === 0) {
        throw new RangeError("A calculator pool needs at least one calculator");
    }
    const idleCalculators = [...calculators];
    const handOverToNextWaiting: ((calculator: BuildCalculator) => void)[] = [];

    return async (build) => {
        const calculator =
            idleCalculators.pop() ?? (await new Promise<BuildCalculator>((resolve) => handOverToNextWaiting.push(resolve)));
        try {
            return await calculator(build);
        } finally {
            const handOver = handOverToNextWaiting.shift();
            if (handOver === undefined) {
                idleCalculators.push(calculator);
            } else {
                handOver(calculator);
            }
        }
    };
}
