/** The kinds of things whose names a search box lists. */
export const textKinds = ["item", "cardOrEnchant", "monster", "skill", "job", "timedItem"] as const;
export type TextKind = (typeof textKinds)[number];
