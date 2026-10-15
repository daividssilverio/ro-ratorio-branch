import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { parseBuild } from "../build/parse-build.ts";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { RatorioSaveReader, RatorioSaveWriter } from "../engine-adapter/ratorio-save.ts";
import { exportRatorioSave } from "./export-ratorio-save.ts";
import { goldenSaveUrlOf } from "./golden-save-urls.ts";
import { importRatorioSave } from "./import-ratorio-save.ts";

const goldenBuildsDirectory = new URL("../build/golden-builds/", import.meta.url);
const goldenBuilds = readdirSync(goldenBuildsDirectory)
    .filter((fileName) => fileName.endsWith(".build.json"))
    .map((fileName) => ({ fileName, build: parseBuild(JSON.parse(readFileSync(new URL(fileName, goldenBuildsDirectory), "utf8"))) }));

describe("exporting a build as a ratorio save", () => {
    let engine: RatorioEngine;
    let readSave: RatorioSaveReader;
    let writeSave: RatorioSaveWriter;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
        readSave = await engine.loadSaveReader();
        writeSave = await engine.loadSaveWriter();
    });

    it.each(goldenBuilds)("writes $fileName as a save that imports to the same build, with nothing left out", ({ build }) => {
        const exported = exportRatorioSave(build, engine);

        const reimported = importRatorioSave(readSave(writeSave(exported.content)), engine);

        expect(exported.notExported).toEqual([]);
        expect(reimported).toEqual({ character: build.character, scenario: build.scenario, notImported: [] });
    });

    it.each(Object.entries(goldenSaveUrlOf))("writes what it read from the %s save so that it reads the same again", (_name, saveUrl) => {
        const content = readSave(saveUrl);

        expect(readSave(writeSave(content))).toEqual({ ...content, uninterpretedUnitTypes: [] });
    });

    it("writes only characters the page's own URLs use", () => {
        const [firstGolden] = goldenBuilds;
        if (firstGolden === undefined) {
            throw new Error("no golden build to export");
        }

        expect(writeSave(exportRatorioSave(firstGolden.build, engine).content)).toMatch(/^[-_.~a-zA-Z0-9]+$/);
    });

    it("reports a skill the job has no slot for and a support buff upstream does not have", () => {
        const [firstGolden] = goldenBuilds;
        if (firstGolden === undefined) {
            throw new Error("no golden build to export");
        }
        const { build } = firstGolden;
        const skillIdOfNoJob = 999_999;

        const exported = exportRatorioSave(
            {
                ...build,
                character: {
                    ...build.character,
                    learnedSkills: { ...build.character.learnedSkills, [skillIdOfNoJob]: 3 },
                    supportBuffs: { ...build.character.supportBuffs, NO_SUCH_BUFF: 1 },
                },
            },
            engine,
        );

        expect(exported.notExported).toEqual([
            { kind: "skillWithoutSlot", list: "learnedSkills", skillId: skillIdOfNoJob },
            { kind: "unknownSupportBuff", name: "NO_SUCH_BUFF" },
        ]);
    });
});
