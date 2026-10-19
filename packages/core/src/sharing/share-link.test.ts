import { describe, expect, it } from "vitest";
import { publishedAppAddress, shareCodeInFragment, shareLinkOf } from "./share-link.ts";

describe("share links", () => {
    it("puts the code in the fragment and drops the query, and reads it back", () => {
        const link = shareLinkOf("https://example.org/branch/?utm=1#old", "B1.abc_DEF-123");

        expect(link).toBe("https://example.org/branch/#B1.abc_DEF-123");
        expect(shareCodeInFragment(new URL(link).hash)).toBe("B1.abc_DEF-123");
    });

    it.each(["", "#", "#tree", "#B1.", "#B1.abc def", "#xB1.abc"])("finds no share code in the fragment %j", (urlFragment) => {
        expect(shareCodeInFragment(urlFragment)).toBeNull();
    });

    it("makes links to the published app that the app reads back", () => {
        const link = new URL(shareLinkOf(publishedAppAddress, "B1.abc"));

        expect(link.origin + link.pathname).toBe(publishedAppAddress);
        expect(shareCodeInFragment(link.hash)).toBe("B1.abc");
    });
});
