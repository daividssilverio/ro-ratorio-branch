import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { parseBuild } from "../build/parse-build.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { type RatorioSaveReader, UnreadableRatorioSaveError } from "../engine-adapter/ratorio-save.ts";
import { goldenSaveUrlOf } from "./golden-save-urls.ts";
import { importRatorioSave } from "./import-ratorio-save.ts";

const goldenBuildNames = Object.keys(goldenSaveUrlOf) as (keyof typeof goldenSaveUrlOf)[];

function goldenBuildNamed(goldenBuildName: string) {
    const buildFileUrl = new URL(`../build/golden-builds/${goldenBuildName}.build.json`, import.meta.url);
    return parseBuild(JSON.parse(readFileSync(buildFileUrl, "utf8")));
}

describe("importing a ratorio save", () => {
    let engine: RatorioEngine;
    let readSave: RatorioSaveReader;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        readSave = await engine.loadSaveReader();
    }, 60_000);

    it.each(goldenBuildNames)("gives the golden build %s from the save it was taken from", (goldenBuildName) => {
        const saveImport = importRatorioSave(readSave(goldenSaveUrlOf[goldenBuildName]), engine);

        expect({ formatVersion: 1, character: saveImport.character, scenario: saveImport.scenario }).toEqual(
            goldenBuildNamed(goldenBuildName),
        );
    });

    it.each(goldenBuildNames)("leaves nothing out of the save of %s", (goldenBuildName) => {
        expect(importRatorioSave(readSave(goldenSaveUrlOf[goldenBuildName]), engine).notImported).toEqual([]);
    });

    it("reads the data alone as well as the whole URL", () => {
        const saveUrl = goldenSaveUrlOf["arch-mage-frozen-slash"];
        const saveDataOnly = saveUrl.slice(saveUrl.indexOf("?") + 1);

        expect(readSave(saveDataOnly)).toEqual(readSave(saveUrl));
    });

    it("refuses text that is not a save", () => {
        expect(() => readSave("dxnot-a-save")).toThrow(UnreadableRatorioSaveError);
        expect(() => readSave("dxnot-a-save")).toThrow(expect.objectContaining({ flaw: "notSaveData" }));
    });
});
