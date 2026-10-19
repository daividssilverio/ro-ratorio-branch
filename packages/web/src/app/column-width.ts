export interface ColumnLimits {
    readonly narrowest: number;
    readonly widest: number;
}

/** A width kept within a column's limits. */
export function widthWithin(width: number, limits: ColumnLimits): number {
    return Math.round(Math.min(limits.widest, Math.max(limits.narrowest, width)));
}

/** Which way a handle moves its column: one on the handle's left grows as the handle moves right, one on its right shrinks. */
export type ColumnSide = "left" | "right";

/** The column's width once its handle has moved by a distance, right being positive. */
export function widthAfterDrag(startWidth: number, movedBy: number, side: ColumnSide, limits: ColumnLimits): number {
    return widthWithin(side === "left" ? startWidth + movedBy : startWidth - movedBy, limits);
}

const keyStep = 16;

/** The column's width after an arrow key on its handle, or `null` for a key that does not move it. */
export function widthAfterKey(width: number, key: string, side: ColumnSide, limits: ColumnLimits): number | null {
    const movedBy = key === "ArrowRight" ? keyStep : key === "ArrowLeft" ? -keyStep : null;
    return movedBy === null ? null : widthAfterDrag(width, movedBy, side, limits);
}
