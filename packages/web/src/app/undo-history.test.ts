import { describe, expect, it } from "vitest";
import { afterChange, redone, startHistory, undoLimit, undone, withCurrent } from "./undo-history.ts";

const changedTo = (states: readonly string[]) => states.slice(1).reduce(afterChange, startHistory(states[0] ?? ""));

describe("undo history", () => {
    it("starts with nothing to take back or to redo", () => {
        const history = startHistory("a");

        expect(undone(history)).toBe(history);
        expect(redone(history)).toBe(history);
    });

    it("steps back through the changes, newest first, and forward again", () => {
        const history = changedTo(["a", "b", "c"]);

        expect(undone(history).current).toBe("b");
        expect(undone(undone(history)).current).toBe("a");
        expect(undone(undone(undone(history))).current).toBe("a");
        expect(redone(undone(undone(history))).current).toBe("b");
        expect(redone(redone(undone(undone(history))))).toEqual(history);
    });

    it("forgets what was undone once something else is changed", () => {
        const history = afterChange(undone(changedTo(["a", "b"])), "c");

        expect(history).toEqual({ past: ["a"], current: "c", future: [] });
        expect(redone(history)).toBe(history);
    });

    it("replaces the present state without adding a step to take back", () => {
        expect(withCurrent(changedTo(["a", "b"]), "b on another tree")).toEqual({ past: ["a"], current: "b on another tree", future: [] });
    });

    it("keeps only the latest changes", () => {
        const history = changedTo(Array.from({ length: undoLimit + 5 }, (_unused, index) => `state ${index}`));

        expect(history.past).toHaveLength(undoLimit);
        expect(history.past[0]).toBe("state 4");
        expect(history.current).toBe(`state ${undoLimit + 4}`);
    });
});
