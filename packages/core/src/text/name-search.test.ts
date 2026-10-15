import { beforeAll, describe, expect, it } from "vitest";
import { loadNameSearch, type NameSearch } from "./name-search.ts";

describe("the name search across everything the engine knows", () => {
    let nameSearch: NameSearch;

    beforeAll(async () => {
        nameSearch = await loadNameSearch();
    }, 60_000);

    it.each([
        { query: "メロンメイス", kind: "item", id: 4411 },
        { query: "meron meisu", kind: "item", id: 4411 },
        { query: "AC", kind: "skill", id: 554 },
        { query: "arms cannon", kind: "skill", id: 554 },
        { query: "NC_ARMSCANNON", kind: "skill", id: 554 },
        { query: "sensha", kind: "cardOrEnchant", id: 1262 },
        { query: "mechanic", kind: "job", id: 51 },
        { query: "#4411", kind: "item", id: 4411 },
    ] as const)("finds $kind $id by '$query'", ({ query, kind, id }) => {
        expect(nameSearch.search(query, { limit: 60 }).some((result) => result.kind === kind && result.id === id)).toBe(true);
    });

    it("gives the reading and the English name it knows, and whether someone checked it", () => {
        const [job] = nameSearch.search("mechanic", { kinds: ["job"] });
        const [card] = nameSearch.search("sensha", { kinds: ["cardOrEnchant"] });

        expect(job).toMatchObject({ kind: "job", id: 51, english: "Mechanic", isEnglishConfirmed: true, match: "exact", edits: 0 });
        expect(card?.reading).toMatch(/^センシャ/);
    });

    it("looks only in the kinds asked for and gives no more than the limit", () => {
        const items = nameSearch.search("リング", { kinds: ["item"], limit: 5 });

        expect(items).toHaveLength(5);
        expect(items.every((result) => result.kind === "item")).toBe(true);
    });

    it("puts better matches first across kinds", () => {
        const kindsOfMatch = nameSearch.search("ポリン", { limit: 40 }).map((result) => result.match);
        const order = ["exact", "startsWith", "substring", "typo"];

        expect(kindsOfMatch).toEqual([...kindsOfMatch].sort((one, other) => order.indexOf(one) - order.indexOf(other)));
    });

    it("finds nothing for an empty query", () => {
        expect(nameSearch.search("   ")).toEqual([]);
    });
});
