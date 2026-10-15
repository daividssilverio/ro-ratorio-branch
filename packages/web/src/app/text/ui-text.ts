import englishOfJapanese from "./ui-english.json" with { type: "json" };
import { loadDisplayPreferences, type MenuLanguage } from "./display-preferences.ts";

/**
 * The language of the app's own words, fixed when the page loads: changing
 * it reloads the page, so that text held in module-level tables is right
 * too.
 */
export const menuLanguage: MenuLanguage = loadDisplayPreferences().menuLanguage;

const english: Readonly<Record<string, string>> = englishOfJapanese;

/** The text as it is in a language. `{0}`, `{1}`… stand for the values that follow. */
export function textIn(language: MenuLanguage, japanese: string, ...values: readonly (string | number)[]): string {
    const template = language === "en" ? (english[japanese] ?? japanese) : japanese;
    return values.length === 0 ? template : template.replaceAll(/\{(\d+)\}/g, (placeholder, position: string) => String(values[Number(position)] ?? placeholder));
}

/**
 * One of the app's own texts in the menu language. The Japanese text is the
 * key; a text without an English entry is shown in Japanese.
 */
export function t(japanese: string, ...values: readonly (string | number)[]): string {
    return textIn(menuLanguage, japanese, ...values);
}
