import {
    addTreeToWorkspace,
    emptyWorkspace,
    encodeShareCode,
    parseBuild,
    parseTree,
    type RatorioSaveImport,
    resolveTree,
    treeOf,
} from "@ro-ratorio-branch/core/platform-neutral";
import exampleTreeFileContent from "@ro-ratorio-branch/core/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SaveReadOutcome } from "../engine-host/host-protocol.ts";
import { applyImport, importModesFor, recognizeImport, type RecognizedImport } from "./share-import-model.ts";

const exampleTree = parseTree(exampleTreeFileContent);
const goldenBuild = (goldenBuildName: string) =>
    parseBuild(JSON.parse(readFileSync(new URL(`../../../core/src/build/golden-builds/${goldenBuildName}.build.json`, import.meta.url), "utf8")));
const mechanicBuild = goldenBuild("mechanic-arms-cannon");
const otherMechanicBuild = goldenBuild("mechanic-arms-cannon-soul-cannonball");

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

describe("importModesFor", () => {
    it("lets a workspace backup only replace, and anything else only add", async () => {
        const workspace = addTreeToWorkspace(emptyWorkspace(), exampleTree, "tree").workspace;

        expect(importModesFor({ kind: "workspace", source: "json", workspace })).toEqual(["replaceEverything"]);
        expect(importModesFor({ kind: "tree", source: "json", tree: exampleTree })).toEqual(["addAsNew", "addAsBranch"]);
    });
});

describe("applyImport", () => {
    const start = addTreeToWorkspace(emptyWorkspace(), exampleTree, "mine");

    it("adds a tree as a new tree and shows it, leaving the open one as it was", () => {
        const applied = applyImport(start.workspace, start.treeId, { kind: "tree", source: "json", tree: exampleTree }, "addAsNew", "theirs");

        expect(applied.activeTreeId).not.toBe(start.treeId);
        expect(treeOf(applied.workspace, applied.activeTreeId)).toEqual(exampleTree);
        expect(treeOf(applied.workspace, start.treeId)).toEqual(exampleTree);
    });

    it("adds a character with a scenario as a new character with an empty tree", () => {
        const character = { kind: "character", source: "json", character: otherMechanicBuild.character, scenario: otherMechanicBuild.scenario, notImported: [] } as const;

        const applied = applyImport(start.workspace, start.treeId, character, "addAsNew", "theirs");

        expect(treeOf(applied.workspace, applied.activeTreeId)).toEqual({
            formatVersion: 1,
            scenario: otherMechanicBuild.scenario,
            root: otherMechanicBuild.character,
            nodes: [],
        });
    });

    it("adds a character as a branch of the open tree whose node turns the root into that character", () => {
        const character = { kind: "character", source: "json", character: otherMechanicBuild.character, scenario: null, notImported: [] } as const;

        const applied = applyImport(start.workspace, start.treeId, character, "addAsBranch", "theirs");

        expect(applied.activeTreeId).toBe(start.treeId);
        const tree = treeOf(applied.workspace, start.treeId);
        const branch = tree.nodes.at(-1);
        expect(branch?.label).toBe("theirs");
        const resolution = resolveTree(tree).get(branch?.id ?? "");
        expect(resolution?.state === "resolved" && resolution.character.equipment).toEqual(otherMechanicBuild.character.equipment);
        expect(resolution?.state === "resolved" && resolution.character.timedItems).toEqual(otherMechanicBuild.character.timedItems);
        expect(applied.inexpressible).toEqual([]);
    });

    it("replaces everything with a workspace backup and shows its first tree", () => {
        const backup = addTreeToWorkspace(emptyWorkspace(), { ...exampleTree, nodes: [] }, "backup");

        const applied = applyImport(start.workspace, start.treeId, { kind: "workspace", source: "json", workspace: backup.workspace }, "replaceEverything", "ignored");

        expect(applied).toEqual({ workspace: backup.workspace, activeTreeId: backup.treeId, inexpressible: [] });
    });
});
