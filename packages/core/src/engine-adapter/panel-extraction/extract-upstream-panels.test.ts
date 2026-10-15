import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { panelDefinitions, serializePanelDefinitions } from "../../panels/panel-definitions.ts";
import { extractUpstreamPanels } from "./extract-upstream-panels.ts";

describe("upstream-panels.json", () => {
    it("is what upstream's panel-building code offers today; run `pnpm --filter @ro-ratorio-branch/core run panels` when it is not", async () => {
        const committedText = readFileSync(new URL("../../panels/upstream-panels.json", import.meta.url), "utf8");

        expect(serializePanelDefinitions(await extractUpstreamPanels())).toBe(committedText);
    }, 120_000);

    it("is written in the form the serializer gives, so a regenerated file differs only where upstream changed", () => {
        const committedText = readFileSync(new URL("../../panels/upstream-panels.json", import.meta.url), "utf8");

        expect(serializePanelDefinitions(panelDefinitions)).toBe(committedText);
    });
});
