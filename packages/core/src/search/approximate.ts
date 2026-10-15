/** Where a term was found in a text, give or take some typing mistakes. */
export interface ApproximateMatch {
    /** Start and end (exclusive) of the part of the text that the term matched. */
    readonly start: number;
    readonly end: number;
    /** How many letters had to be added, dropped, changed or swapped. 0 for an exact occurrence. */
    readonly edits: number;
}

/**
 * The place in `text` that comes closest to `term`, if it is within
 * `maxEdits` mistakes: a letter too many, one missing, a wrong one, or two
 * neighbours swapped. Of several equally close places the first one wins.
 */
export function findApproximately(term: string, text: string, maxEdits: number): ApproximateMatch | null {
    if (term.length === 0) {
        return null;
    }
    const exactStart = text.indexOf(term);
    if (exactStart >= 0) {
        return { start: exactStart, end: exactStart + term.length, edits: 0 };
    }
    if (maxEdits === 0 || text.length === 0) {
        return null;
    }

    // costs[row][column]: the fewest mistakes turning the first `row` letters
    // of the term into some stretch of text that ends at `column`. The
    // stretch may start anywhere, so the top row costs nothing.
    const rows = term.length + 1;
    const columns = text.length + 1;
    const costs: number[][] = Array.from({ length: rows }, (_unused, row) => Array.from({ length: columns }, () => row));
    const starts: number[][] = Array.from({ length: rows }, () => Array.from({ length: columns }, (_unused, column) => column));
    for (let row = 1; row < rows; row++) {
        for (let column = 1; column < columns; column++) {
            const sameLetter = term[row - 1] === text[column - 1];
            let cost = (costs[row - 1]?.[column - 1] ?? 0) + (sameLetter ? 0 : 1);
            let start = starts[row - 1]?.[column - 1] ?? 0;
            const dropped = (costs[row - 1]?.[column] ?? 0) + 1;
            if (dropped < cost) {
                cost = dropped;
                start = starts[row - 1]?.[column] ?? 0;
            }
            const added = (costs[row]?.[column - 1] ?? 0) + 1;
            if (added < cost) {
                cost = added;
                start = starts[row]?.[column - 1] ?? 0;
            }
            const isSwap = row > 1 && column > 1 && term[row - 1] === text[column - 2] && term[row - 2] === text[column - 1];
            if (isSwap) {
                const swapped = (costs[row - 2]?.[column - 2] ?? 0) + 1;
                if (swapped < cost) {
                    cost = swapped;
                    start = starts[row - 2]?.[column - 2] ?? 0;
                }
            }
            (costs[row] as number[])[column] = cost;
            (starts[row] as number[])[column] = start;
        }
    }

    let best: ApproximateMatch | null = null;
    for (let column = 1; column < columns; column++) {
        const edits = costs[rows - 1]?.[column] ?? Number.POSITIVE_INFINITY;
        if (edits <= maxEdits && (best === null || edits < best.edits)) {
            best = { start: starts[rows - 1]?.[column] ?? 0, end: column, edits };
        }
    }
    return best;
}
