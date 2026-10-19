/**
 * Most tests drive the real damage engine, and on a shared CI machine one
 * can take several seconds; Vitest's default of five, meant for small unit
 * tests, then fails them for being slow rather than wrong. A test that hangs
 * still fails.
 *
 * The engine's own files are loaded by Node as they are rather than through
 * Vitest's transform, which otherwise makes every calculation several times
 * slower.
 */
export const engineTestSettings = { testTimeout: 30_000, hookTimeout: 60_000, server: { deps: { external: [/\/vendor\/ratorio\//] } } };
