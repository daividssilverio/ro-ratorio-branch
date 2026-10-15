import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultDisplayPreferences, parseDisplayPreferences } from "./display-preferences.ts";
import englishOfJapanese from "./ui-english.json" with { type: "json" };
import { textIn } from "./ui-text.ts";

const sourceDirectory = join(import.meta.dirname, "..", "..");

function sourceFilesIn(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return sourceFilesIn(path);
        }
        return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
    });
}

const textsInSource = new Set(
    sourceFilesIn(sourceDirectory).flatMap((path) => Array.from(readFileSync(path, "utf8").matchAll(/\bt\(("(?:[^"\\]|\\.)*")/g), (match) => JSON.parse(match[1] ?? '""') as string)),
);
const english: Readonly<Record<string, string>> = englishOfJapanese;
const placeholdersOf = (text: string) => Array.from(text.matchAll(/\{\d+\}/g), (match) => match[0]).sort();

describe("the English texts", () => {
    it("cover every text the app shows", () => {
        expect([...textsInSource].filter((text) => !(text in english))).toEqual([]);
    });

    it("hold nothing the app no longer shows", () => {
        expect(Object.keys(english).filter((text) => !textsInSource.has(text))).toEqual([]);
    });

    it("take the same values as the Japanese ones", () => {
        expect(Object.entries(english).filter(([japanese, englishText]) => englishText !== "" && placeholdersOf(japanese).join() !== placeholdersOf(englishText).join())).toEqual([]);
    });
});

describe("textIn", () => {
    it("puts the values where the text asks for them, in either order", () => {
        expect(textIn("ja", "{0} 件中 {1} 件を表示", 233, 80)).toBe("233 件中 80 件を表示");
        expect(textIn("en", "{0} 件中 {1} 件を表示", 233, 80)).toBe(english["{0} 件中 {1} 件を表示"]?.replace("{0}", "233").replace("{1}", "80"));
    });

    it("falls back to the Japanese text when there is no English one", () => {
        expect(textIn("en", "辞書にない文")).toBe("辞書にない文");
    });
});

describe("parseDisplayPreferences", () => {
    it.each([
        { stored: null, preferences: defaultDisplayPreferences },
        { stored: "not json", preferences: defaultDisplayPreferences },
        { stored: '{"menuLanguage":"en","showsFurigana":false}', preferences: { menuLanguage: "en", showsFurigana: false } },
        { stored: '{"menuLanguage":"fr","showsFurigana":"yes"}', preferences: defaultDisplayPreferences },
        { stored: '{"showsFurigana":false}', preferences: { menuLanguage: "ja", showsFurigana: false } },
    ])("reads $stored field by field", ({ stored, preferences }) => {
        expect(parseDisplayPreferences(stored)).toEqual(preferences);
    });
});
