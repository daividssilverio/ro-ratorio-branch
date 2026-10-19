import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBuild } from "../build/parse-build.ts";
import exampleTreeFileContent from "../tree/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { parseTree } from "../tree/parse-tree.ts";
import { addTreeToWorkspace, emptyWorkspace } from "../workspace/add-to-workspace.ts";
import type { RatorioSaveImport } from "./import-ratorio-save.ts";
import { type RecognizedImport, recognizeImport, type SaveReadOutcome } from "./recognize-import.ts";
import { encodeShareCode } from "./share-code.ts";
import { publishedAppAddress, shareLinkOf } from "./share-link.ts";

const exampleTree = parseTree(exampleTreeFileContent);
const mechanicBuild = parseBuild(JSON.parse(readFileSync(new URL("../build/golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8")));

const notASave = async (): Promise<SaveReadOutcome> => ({ state: "unreadable", flaw: "notSaveData" });

async function recognized(text: string, readSave = notASave): Promise<RecognizedImport> {
    const recognition = await recognizeImport(text, readSave);
    if (!("recognized" in recognition)) {
        throw new Error(`refused: ${recognition.refused.kind}`);
    }
    return recognition.recognized;
}

describe("recognizeImport", () => {
    it("recognizes a share code of a tree", async () => {
        expect(await recognized(await encodeShareCode(exampleTree))).toEqual({ kind: "tree", source: "shareCode", tree: exampleTree });
    });

    it("recognizes a share code of a build as a character with its scenario", async () => {
        const recognizedImport = await recognized(await encodeShareCode(mechanicBuild));

        expect(recognizedImport).toEqual({
            kind: "character",
            source: "shareCode",
            character: mechanicBuild.character,
            scenario: mechanicBuild.scenario,
            notImported: [],
        });
    });

    it("recognizes a link to the app that carries a share code", async () => {
        const link = shareLinkOf(publishedAppAddress, await encodeShareCode(exampleTree));

        expect(await recognized(link)).toEqual({ kind: "tree", source: "shareCode", tree: exampleTree });
        expect(await recognized(`  ${link}\n`)).toEqual({ kind: "tree", source: "shareCode", tree: exampleTree });
    });

    it("recognizes the JSON of a tree file, a build file and a workspace backup", async () => {
        const workspace = addTreeToWorkspace(emptyWorkspace(), exampleTree, "tree").workspace;

        expect((await recognized(JSON.stringify(exampleTree))).kind).toBe("tree");
        expect((await recognized(JSON.stringify(mechanicBuild))).kind).toBe("character");
        expect(await recognized(JSON.stringify(workspace))).toEqual({ kind: "workspace", source: "json", workspace });
    });

    it("hands anything else to the ratorio save reader, and carries over what it could not import", async () => {
        const saveImport: RatorioSaveImport = {
            character: mechanicBuild.character,
            scenario: null,
            notImported: [{ kind: "upstreamSection", section: "SKILL_BUFF_GUILD" }],
        };

        const recognizedImport = await recognized("https://example.org/calcx.html?cx1cy1", async () => ({ state: "read", saveImport }));

        expect(recognizedImport).toEqual({ kind: "character", source: "ratorioSave", ...saveImport });
    });

    it.each([
        { situation: "nothing", text: "   ", refusal: { kind: "empty" } },
        { situation: "text that is none of them", text: "hello", refusal: { kind: "notRecognized" } },
        { situation: "JSON of something else", text: '{"hello":1}', refusal: { kind: "notRecognized" } },
        { situation: "a damaged share code", text: "B1.$$$", refusal: { kind: "invalidShareCode", flaw: "notBase64Url" } },
    ])("refuses $situation and says why", async ({ text, refusal }) => {
        expect(await recognizeImport(text, notASave)).toEqual({ refused: refusal });
    });

    it("refuses a build file that breaks the format and counts what is wrong with it", async () => {
        const recognition = await recognizeImport('{"character":{}}', notASave);

        expect(recognition).toMatchObject({ refused: { kind: "invalidContent", what: "build" } });
        expect("refused" in recognition && recognition.refused.kind === "invalidContent" && recognition.refused.issueCount).toBeGreaterThan(0);
    });
});
