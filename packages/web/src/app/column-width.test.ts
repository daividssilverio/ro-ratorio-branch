import { describe, expect, it } from "vitest";
import { widthAfterDrag, widthAfterKey, widthWithin } from "./column-width.ts";

const limits = { narrowest: 280, widest: 600 };

describe("column widths", () => {
    it("keeps a width within the column's limits, in whole pixels", () => {
        expect([widthWithin(100, limits), widthWithin(400.4, limits), widthWithin(900, limits)]).toEqual([280, 400, 600]);
    });

    it("grows a column left of its handle as the handle moves right, and shrinks one on its right", () => {
        expect(widthAfterDrag(400, 50, "left", limits)).toBe(450);
        expect(widthAfterDrag(400, 50, "right", limits)).toBe(350);
        expect(widthAfterDrag(400, -500, "left", limits)).toBe(280);
    });

    it("moves by a step for the arrow keys, and not at all for other keys", () => {
        expect(widthAfterKey(400, "ArrowRight", "left", limits)).toBe(416);
        expect(widthAfterKey(400, "ArrowLeft", "left", limits)).toBe(384);
        expect(widthAfterKey(400, "ArrowRight", "right", limits)).toBe(384);
        expect(widthAfterKey(400, "Enter", "left", limits)).toBeNull();
    });
});
