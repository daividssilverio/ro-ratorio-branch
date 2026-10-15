/** How the app shows text. Kept per browser, apart from the workspace: sharing a workspace does not share these. */
export interface DisplayPreferences {
    /** The language of the app's own words. Names from the game stay Japanese in both. */
    readonly menuLanguage: MenuLanguage;
    /** Whether kanji in game names carry their reading. */
    readonly showsFurigana: boolean;
}

export const menuLanguages = ["ja", "en"] as const;
export type MenuLanguage = (typeof menuLanguages)[number];

export const defaultDisplayPreferences: DisplayPreferences = { menuLanguage: "ja", showsFurigana: true };

const storageKey = "ro-ratorio-branch.display";

/** Reads what was stored, falling back field by field: an unknown or damaged value never keeps the app from opening. */
export function parseDisplayPreferences(stored: string | null): DisplayPreferences {
    let value: unknown = null;
    try {
        value = stored === null ? null : JSON.parse(stored);
    } catch {
        value = null;
    }
    const fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    const menuLanguage = menuLanguages.find((language) => language === fields["menuLanguage"]) ?? defaultDisplayPreferences.menuLanguage;
    const showsFurigana = typeof fields["showsFurigana"] === "boolean" ? fields["showsFurigana"] : defaultDisplayPreferences.showsFurigana;
    return { menuLanguage, showsFurigana };
}

function storage(): Storage | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
        return null;
    }
}

export function loadDisplayPreferences(): DisplayPreferences {
    return parseDisplayPreferences(storage()?.getItem(storageKey) ?? null);
}

export function storeDisplayPreferences(preferences: DisplayPreferences): void {
    try {
        storage()?.setItem(storageKey, JSON.stringify(preferences));
    } catch {
        // A full or blocked store only means the choice does not outlive the page.
    }
}
