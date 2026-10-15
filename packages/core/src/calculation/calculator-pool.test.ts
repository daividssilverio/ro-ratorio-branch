import { describe, expect, it } from "vitest";
import type { BuildCalculator, BuildOutcome } from "../tree/evaluate-tree.ts";
import { mechanicBuild } from "../tree/tree-test-support.ts";
import { createCalculatorPool } from "./calculator-pool.ts";

const noNumbers: BuildOutcome = { state: "notCalculable", issues: [] };

/** A calculator that finishes a calculation only when the test says so, and records overlap. */
function calculatorUnderTestControl() {
    const finishCalculation: (() => void)[] = [];
    let running = 0;
    let mostRunningAtOnce = 0;
    let started = 0;
    const calculate: BuildCalculator = () => {
        running += 1;
        started += 1;
        mostRunningAtOnce = Math.max(mostRunningAtOnce, running);
        return new Promise<BuildOutcome>((resolve) => {
            finishCalculation.push(() => {
                running -= 1;
                resolve(noNumbers);
            });
        });
    };
    return {
        calculate,
        finishOne: () => finishCalculation.shift()?.(),
        get started() {
            return started;
        },
        get mostRunningAtOnce() {
            return mostRunningAtOnce;
        },
    };
}

const letPendingWorkRun = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createCalculatorPool", () => {
    it("never gives one calculator two builds at once", async () => {
        const only = calculatorUnderTestControl();
        const pool = createCalculatorPool([only.calculate]);

        const outcomes = [pool(mechanicBuild), pool(mechanicBuild), pool(mechanicBuild)];
        await letPendingWorkRun();
        expect(only.started).toBe(1);
        for (let finished = 0; finished < 3; finished++) {
            only.finishOne();
            await letPendingWorkRun();
        }

        await Promise.all(outcomes);
        expect(only.started).toBe(3);
        expect(only.mostRunningAtOnce).toBe(1);
    });

    it("runs builds side by side when it has several calculators", async () => {
        const first = calculatorUnderTestControl();
        const second = calculatorUnderTestControl();
        const pool = createCalculatorPool([first.calculate, second.calculate]);

        const outcomes = [pool(mechanicBuild), pool(mechanicBuild)];
        await letPendingWorkRun();

        expect(first.started + second.started).toBe(2);
        expect([first.started, second.started]).toEqual([1, 1]);
        first.finishOne();
        second.finishOne();
        await Promise.all(outcomes);
    });

    it("frees a calculator again after its calculation failed", async () => {
        let calls = 0;
        const pool = createCalculatorPool([
            () => {
                calls += 1;
                if (calls === 1) {
                    throw new RangeError("engine host lost");
                }
                return noNumbers;
            },
        ]);

        await expect(pool(mechanicBuild)).rejects.toThrow(RangeError);

        expect(await pool(mechanicBuild)).toBe(noNumbers);
    });

    it("refuses to exist without a calculator", () => {
        expect(() => createCalculatorPool([])).toThrow(RangeError);
    });
});
