import type { TextKind } from "@ro-ratorio-branch/core/platform-neutral";

const officialToolOrigin = "https://rotool.gungho.jp";

/**
 * The search page of the official tool for a kind of thing, or `null` for
 * a kind it has no page for. Its pages for one item go by the game's own
 * item number, which the engine's data does not carry, and its search
 * takes no words from the address: the way in is this page, with the name
 * to paste.
 */
export function officialSearchPageOf(kind: TextKind): string | null {
    switch (kind) {
        case "item":
        case "cardOrEnchant":
            return `${officialToolOrigin}/item/`;
        case "monster":
            return `${officialToolOrigin}/monster/`;
        case "skill":
            return `${officialToolOrigin}/skill/`;
        default:
            return null;
    }
}

/**
 * A name as the official tool would list it: without the marks the
 * calculator puts in front of a skill it models only in part, and without
 * the socket count or note it puts behind a name.
 */
export function nameToSearchOfficially(name: string): string {
    return name
        .replace(/^(?:[(（][^)）]*[)）]\s*)+/, "")
        .replace(/(?:\s*(?:\[[^\]]*\]|[(（][^)）]*[)）]))+$/, "")
        .trim();
}
