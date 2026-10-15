/**
 * What was, what is and what was undone, for stepping back and forth
 * through the changes of one visit. Kept in memory only: it starts empty
 * when the page loads.
 */
export interface UndoHistory<State> {
    /** Earlier states, oldest first. */
    readonly past: readonly State[];
    readonly current: State;
    /** States that were undone, the one to redo first at the front. */
    readonly future: readonly State[];
}

/** How many changes can be taken back. Older ones are forgotten. */
export const undoLimit = 50;

export function startHistory<State>(current: State): UndoHistory<State> {
    return { past: [], current, future: [] };
}

/** The history after a change: the state before it can be gone back to, and what was undone before can no longer be redone. */
export function afterChange<State>(history: UndoHistory<State>, next: State): UndoHistory<State> {
    return { past: [...history.past, history.current].slice(-undoLimit), current: next, future: [] };
}

/** The history with the present state replaced and nothing to go back to added: for what is not a change, such as looking at another tree. */
export function withCurrent<State>(history: UndoHistory<State>, current: State): UndoHistory<State> {
    return { ...history, current };
}

/** The history one change back, or the same history when there is nothing to take back. */
export function undone<State>(history: UndoHistory<State>): UndoHistory<State> {
    const previous = history.past.at(-1);
    return previous === undefined ? history : { past: history.past.slice(0, -1), current: previous, future: [history.current, ...history.future] };
}

/** The history one undone change forward again, or the same history when nothing was undone. */
export function redone<State>(history: UndoHistory<State>): UndoHistory<State> {
    const [next, ...laterFuture] = history.future;
    return next === undefined ? history : { past: [...history.past, history.current], current: next, future: laterFuture };
}
