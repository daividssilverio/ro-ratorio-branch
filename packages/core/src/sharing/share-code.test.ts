import { describe, expect, it } from "vitest";
import { InvalidBuildError } from "../build/parse-build.ts";
import exampleTreeFileContent from "../tree/example-trees/mechanic-upgrades.tree.json" with { type: "json" };
import { parseTree } from "../tree/parse-tree.ts";
import { mechanicBuild } from "../tree/tree-test-support.ts";
import { decodeShareCode, encodeShareCode, InvalidShareCodeError, type ShareCodeFlaw } from "./share-code.ts";

const exampleTree = parseTree(exampleTreeFileContent);

async function flawOf(shareCode: string): Promise<ShareCodeFlaw | undefined> {
    try {
        await decodeShareCode(shareCode);
    } catch (error) {
        if (error instanceof InvalidShareCodeError) {
            return error.flaw;
        }
        throw error;
    }
    return undefined;
}

describe("share codes", () => {
    it("carry a build there and back unchanged", async () => {
        const shared = await decodeShareCode(await encodeShareCode(mechanicBuild));

        expect(shared).toEqual({ kind: "build", build: mechanicBuild });
    });

    it("carry a tree there and back unchanged", async () => {
        const shared = await decodeShareCode(await encodeShareCode(exampleTree));

        expect(shared).toEqual({ kind: "tree", tree: exampleTree });
    });

    it("use only characters that are safe in a URL fragment", async () => {
        expect(await encodeShareCode(exampleTree)).toMatch(/^B1\.[A-Za-z0-9_-]+$/);
    });

    it("are shorter than the JSON they carry and short enough for a URL", async () => {
        const shareCode = await encodeShareCode(exampleTree);

        expect(shareCode.length).toBeLessThan(JSON.stringify(exampleTree).length);
        expect(shareCode.length).toBeLessThan(1500);
    });

    it("give the same code for the same build, however its fields were ordered", async () => {
        const { scenario, character, formatVersion } = mechanicBuild;

        expect(await encodeShareCode({ scenario, character, formatVersion })).toBe(await encodeShareCode(mechanicBuild));
    });

    it("can be pasted with stray whitespace around them", async () => {
        const shareCode = await encodeShareCode(mechanicBuild);

        expect((await decodeShareCode(`  ${shareCode}\n`)).kind).toBe("build");
    });
});

describe("decodeShareCode on something else", () => {
    it.each([
        { situation: "text without the version prefix", shareCode: "hello", flaw: "unknownPrefix" },
        { situation: "a code of a version it does not know", shareCode: "B9.abc", flaw: "unknownPrefix" },
        { situation: "characters outside base64url", shareCode: "B1.abc$def", flaw: "notBase64Url" },
        { situation: "bytes that are not compressed data", shareCode: "B1.AAAAAAAAAAAAAAAA", flaw: "notCompressedData" },
    ] as const)("names the flaw for $situation", async ({ shareCode, flaw }) => {
        expect(await flawOf(shareCode)).toBe(flaw);
    });

    it("names compressed JSON that is neither a build nor a tree", async () => {
        const shareCodeOfSomethingElse = await encodeShareCode({ formatVersion: 1 } as never);

        expect(await flawOf(shareCodeOfSomethingElse)).toBe("neitherBuildNorTree");
    });

    it("reports a carried build that breaks the build format with the build's own issues", async () => {
        const brokenBuild = { ...mechanicBuild, formatVersion: 2 };

        await expect(decodeShareCode(await encodeShareCode(brokenBuild as never))).rejects.toThrow(InvalidBuildError);
    });
});
