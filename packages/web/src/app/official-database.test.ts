import { textKinds } from "@ro-ratorio-branch/core/platform-neutral";
import { describe, expect, it } from "vitest";
import { nameToSearchOfficially, officialSearchPageOf } from "./official-database.ts";

describe("officialSearchPageOf", () => {
    it("knows a page for items, cards, monsters and skills, on the official tool only", () => {
        const pages = textKinds.map((kind) => officialSearchPageOf(kind));

        expect(pages.map((page) => page !== null)).toEqual([true, true, true, true, false, false]);
        expect(pages.every((page) => page === null || new URL(page).origin === "https://rotool.gungho.jp")).toBe(true);
        expect(officialSearchPageOf("item")).toBe(officialSearchPageOf("cardOrEnchant"));
    });
});

describe("nameToSearchOfficially", () => {
    it.each([
        { name: "メロンメイス", searched: "メロンメイス" },
        { name: "(△)アームズキャノン", searched: "アームズキャノン" },
        { name: "サバイバルロッド(INT)[0]", searched: "サバイバルロッド" },
        { name: "ファラオ（MD）", searched: "ファラオ" },
        { name: "(×)(△)二重（特殊） [1]", searched: "二重" },
    ])("searches $name as $searched", ({ name, searched }) => {
        expect(nameToSearchOfficially(name)).toBe(searched);
    });
});
