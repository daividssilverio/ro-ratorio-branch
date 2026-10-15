import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../load-ratorio-engine-in-node.ts";
import { sourceOfFunction } from "./upstream-function-source.ts";
import {
    currentFingerprintOf,
    documentTableOf,
    documentUrl,
    existsInRepository,
    manifestUrl,
    readManifest,
    serializeManifest,
    withCurrentFingerprints,
    withDocumentTable,
} from "./upstream-rules.ts";

const manifest = readManifest();

describe("rewritten rules", () => {
    it("were each rewritten from upstream functions that have not changed since; re-read the ones listed here, then run `pnpm --filter @ro-ratorio-branch/core run upstream-rules`", () => {
        const changed = manifest.rules.flatMap((rule) =>
            rule.upstream
                .filter((source) => currentFingerprintOf(source) !== source.fingerprint)
                .map((source) => ({ rule: `catalog.${rule.catalog}`, upstreamFile: source.file, upstreamFunction: source.function })),
        );

        expect(changed).toEqual([]);
    });

    it("name upstream functions of a size a rule could come from, not a stray match", () => {
        for (const source of manifest.rules.flatMap((rule) => rule.upstream)) {
            const functionSource = sourceOfFunction(readFileSync(new URL(`../../../../../vendor/ratorio/${source.file}`, import.meta.url), "utf8"), source.function);

            expect(functionSource?.split("\n").length ?? 0, `${source.file} ${source.function}`).toBeGreaterThan(5);
        }
    });

    it("are each pinned by a test that exists and exercises the rule", () => {
        for (const rule of manifest.rules) {
            expect(existsInRepository(rule.test), rule.test).toContain(`catalog.${rule.catalog}(`);
        }
    });

    it("and the data readers together cover every method of the catalog, each once", async () => {
        const engine = await loadRatorioEngine();
        const classified = [...manifest.rules.map((rule) => rule.catalog), ...Object.keys(manifest.dataReaders)];

        expect([...classified].sort()).toEqual(Object.keys(engine.catalog).sort());
        expect(new Set(classified).size).toBe(classified.length);
    });
});

describe("upstream-rules.json and the document", () => {
    it("is stored in the form the command writes", () => {
        expect(serializeManifest(withCurrentFingerprints(manifest))).toBe(readFileSync(manifestUrl, "utf8"));
    });

    it("shows the table generated from the manifest", () => {
        const documentText = readFileSync(documentUrl, "utf8");

        expect(withDocumentTable(documentText, documentTableOf(manifest))).toBe(documentText);
    });
});
