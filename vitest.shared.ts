/**
 * Most tests drive the real damage engine, and on a shared CI machine one
 * can take several seconds; Vitest's default of five, meant for small unit
 * tests, then fails them for being slow rather than wrong. A test that hangs
 * still fails.
 */
export const engineTestTimeouts = { testTimeout: 30_000, hookTimeout: 60_000 } as const;
