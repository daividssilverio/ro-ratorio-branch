import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Build } from "@ro-ratorio-branch/core";
import { describe, expect, it } from "vitest";
import { exitCodes, type RocalcFailure, type RocalcIo, runRocalc } from "./run-rocalc.ts";

const mechanicBuildFilePath = fileURLToPath(
    new URL("../../core/src/build/golden-builds/mechanic-arms-cannon.build.json", import.meta.url),
);
const mechanicBuildFileText = readFileSync(mechanicBuildFilePath, "utf8");
const damageTheUpstreamPageShows = { averageDamagePerAttack: 911001, averageDamagePerSecond: 6507149 };

interface FakeIo extends RocalcIo {
    readonly resultTexts: string[];
    readonly failureTexts: string[];
}

function createFakeIo(textOfFile: Readonly<Record<string, string>>): FakeIo {
    const resultTexts: string[] = [];
    const failureTexts: string[] = [];
    return {
        resultTexts,
        failureTexts,
        async readTextFile(filePath) {
            const fileText = textOfFile[filePath];
            if (fileText === undefined) {
                throw new Error(`no such file: ${filePath}`);
            }
            return fileText;
        },
        writeResult: (text) => resultTexts.push(text),
        writeFailure: (text) => failureTexts.push(text),
    };
}

function onlyFailureOf(io: FakeIo): RocalcFailure {
    expect(io.resultTexts).toEqual([]);
    expect(io.failureTexts).toHaveLength(1);
    return JSON.parse(io.failureTexts[0] ?? "").error;
}

function mechanicBuildWith(change: (build: Build) => void): string {
    const build: Build = JSON.parse(mechanicBuildFileText);
    change(build);
    return JSON.stringify(build);
}

describe("rocalc calc", () => {
    it("prints the battle summary of a build file as JSON and exits with success", async () => {
        const io = createFakeIo({ "build.json": mechanicBuildFileText });

        const exitCode = await runRocalc(["calc", "build.json"], io);

        expect(exitCode).toBe(exitCodes.success);
        expect(io.failureTexts).toEqual([]);
        expect(JSON.parse(io.resultTexts.join(""))).toEqual({
            targetMonsterId: 850,
            ...damageTheUpstreamPageShows,
            averageTimeToKill: { seconds: 2.1, attacks: 15 },
        });
    }, 60_000);

    it("reports a file it cannot read", async () => {
        const io = createFakeIo({});

        const exitCode = await runRocalc(["calc", "missing.json"], io);

        expect(exitCode).toBe(exitCodes.fileRejected);
        expect(onlyFailureOf(io)).toEqual({ kind: "fileNotReadable", filePath: "missing.json" });
    });

    it("reports a file that is not JSON", async () => {
        const io = createFakeIo({ "build.json": "{ not json" });

        const exitCode = await runRocalc(["calc", "build.json"], io);

        expect(exitCode).toBe(exitCodes.fileRejected);
        expect(onlyFailureOf(io)).toEqual({ kind: "notJson", filePath: "build.json" });
    });

    it("reports where a file breaks the build format", async () => {
        const io = createFakeIo({
            "build.json": mechanicBuildWith((build) => {
                build.character.baseStats.str = 0;
            }),
        });

        const exitCode = await runRocalc(["calc", "build.json"], io);

        expect(exitCode).toBe(exitCodes.fileRejected);
        expect(onlyFailureOf(io)).toEqual({
            kind: "invalidBuild",
            issues: [{ path: "/character/baseStats/str", kind: "invalid", rule: "minimum" }],
        });
    });

    it("reports what the engine cannot calculate in a well-formed build", async () => {
        const io = createFakeIo({
            "build.json": mechanicBuildWith((build) => {
                build.scenario.targetMonsterId = 999_999;
            }),
        });

        const exitCode = await runRocalc(["calc", "build.json"], io);

        expect(exitCode).toBe(exitCodes.fileRejected);
        expect(onlyFailureOf(io)).toEqual({
            kind: "buildNotCalculable",
            issues: [{ kind: "unknownTargetMonster", monsterId: 999_999 }],
        });
    }, 60_000);
});

describe("rocalc sp", () => {
    const spiritHandlerBuildFileText = readFileSync(new URL("../../core/src/build/golden-builds/spirit-handler-abyss-armor.build.json", import.meta.url), "utf8");

    it("prints how SP holds up using the build's attack, with the chances given", async () => {
        const io = createFakeIo({ "build.json": spiritHandlerBuildFileText });

        const exitCode = await runRocalc(["sp", "build.json", "--chance", "card:2359=3", "--chance", "item:4404=5"], io);
        const { spSustain } = JSON.parse(io.resultTexts.join(""));

        expect(exitCode).toBe(exitCodes.success);
        expect(spSustain).toMatchObject({ maxSp: 3890, spCostPerUse: 100, usesPerSecond: 2, spentPerSecond: 200 });
        // 200 SP a second spent; back: 7.25 natural, 38 from 極限の魔力, and its set with the armor at an assumed 1%.
        expect(spSustain.fullBar.seconds).toBeCloseTo(3890 / (200 - 7.25 - 38 - (1 - 0.99 ** 20) * 389));
    }, 60_000);

    it("counts a state as on all the time with --active: the armor's set with 極限の魔力 then gives back more than the attack spends", async () => {
        const io = createFakeIo({ "build.json": spiritHandlerBuildFileText });

        const exitCode = await runRocalc(["sp", "build.json", "--active", "item:5486"], io);
        const { spSustain } = JSON.parse(io.resultTexts.join(""));

        expect(exitCode).toBe(exitCodes.success);
        expect(spSustain.fullBar).toBeNull();
        expect(spSustain.gains.find((gain: { from: { source?: { id: number } } }) => gain.from.source?.id === 5486).state).toMatchObject({ shareOfTimeOn: 1, perSecondWhileOn: 389, onBecause: "yours" });
    }, 60_000);
});

describe("rocalc compare", () => {
    const exampleTreeFileText = readFileSync(
        new URL("../../core/src/tree/example-trees/mechanic-upgrades.tree.json", import.meta.url),
        "utf8",
    );

    it("prints the root, every node and the rankings of a tree file", async () => {
        const io = createFakeIo({ "tree.json": exampleTreeFileText });

        const exitCode = await runRocalc(["compare", "tree.json"], io);

        expect(exitCode).toBe(exitCodes.success);
        const comparison = JSON.parse(io.resultTexts.join(""));
        expect(comparison.root.battleSummary).toMatchObject(damageTheUpstreamPageShows);
        expect(comparison.nodes.map((node: { id: string }) => node.id)).toEqual([
            "refine-10",
            "refine-10-shoes-10",
            "strength-130",
            "blessing",
        ]);
        expect(comparison.nodes.map((node: { state: string }) => node.state)).toEqual(["ready", "ready", "ready", "ready"]);
        expect(comparison.rankings.valueForMoney[0]).toBe("strength-130");
        expect(comparison.rankings.valueForMoney.at(-1)).toBe("blessing");
    }, 60_000);

    it("reports a tree whose node names a parent that is not there", async () => {
        const tree = JSON.parse(exampleTreeFileText);
        tree.nodes[1].parentId = "gone";
        const io = createFakeIo({ "tree.json": JSON.stringify(tree) });

        const exitCode = await runRocalc(["compare", "tree.json"], io);

        expect(exitCode).toBe(exitCodes.fileRejected);
        expect(onlyFailureOf(io)).toEqual({
            kind: "invalidTree",
            issues: [{ kind: "unknownParent", nodeId: "refine-10-shoes-10", parentId: "gone" }],
        });
    });
});

describe("rocalc usage", () => {
    it.each([
        { situation: "no arguments", commandLineArguments: [] },
        { situation: "an unknown command", commandLineArguments: ["rank", "build.json"] },
        { situation: "calc without a file", commandLineArguments: ["calc"] },
        { situation: "calc with two files", commandLineArguments: ["calc", "one.json", "two.json"] },
        { situation: "calc with a chance", commandLineArguments: ["calc", "build.json", "--chance", "item:4404=5"] },
        { situation: "sp with a chance of no item or card", commandLineArguments: ["sp", "build.json", "--chance", "pet:1=5"] },
        { situation: "sp with a chance above 100%", commandLineArguments: ["sp", "build.json", "--chance", "item:4404=101"] },
        { situation: "sp with a chance left out", commandLineArguments: ["sp", "build.json", "--chance"] },
        { situation: "sp with an active state of no item or card", commandLineArguments: ["sp", "build.json", "--active", "pet:1"] },
    ])("exits with the usage code for $situation", async ({ commandLineArguments }) => {
        const io = createFakeIo({});

        const exitCode = await runRocalc(commandLineArguments, io);

        expect(exitCode).toBe(exitCodes.usage);
        expect(onlyFailureOf(io).kind).toBe("usage");
    });
});

describe("rocalc as a program", () => {
    const rocalcProgramPath = fileURLToPath(new URL("./rocalc.ts", import.meta.url));
    const runProgram = promisify(execFile);

    it("prints the summary on standard output and nothing on standard error", async () => {
        const { stdout, stderr } = await runProgram(process.execPath, [rocalcProgramPath, "calc", mechanicBuildFilePath]);

        expect(JSON.parse(stdout)).toMatchObject(damageTheUpstreamPageShows);
        expect(stderr).toBe("");
    }, 60_000);

    it("exits with the rejection code and a failure on standard error for a missing file", async () => {
        const rejection = await runProgram(process.execPath, [rocalcProgramPath, "calc", "no-such-build.json"]).then(
            () => undefined,
            (error: { code: number; stdout: string; stderr: string }) => error,
        );

        expect(rejection?.code).toBe(exitCodes.fileRejected);
        expect(rejection?.stdout).toBe("");
        expect(JSON.parse(rejection?.stderr ?? "").error.kind).toBe("fileNotReadable");
    }, 60_000);
});

describe("rocalc search", () => {
    const search = async (...searchArguments: string[]) => {
        const io = createFakeIo({});
        const exitCode = await runRocalc(["search", ...searchArguments], io);
        return { exitCode, io };
    };
    const resultsOf = (io: FakeIo): { kind: string; id: number }[] => JSON.parse(io.resultTexts[0] ?? "").results;

    it("finds a name by its words in any spelling and gives its ratorio ID", async () => {
        const { exitCode, io } = await search("meron", "meisu");

        expect(exitCode).toBe(exitCodes.success);
        expect(resultsOf(io)[0]).toMatchObject({ kind: "item", id: 4411 });
    });

    it("looks only in the kinds asked for and gives no more than the limit", async () => {
        const { io } = await search("ring", "--kind", "item,cardOrEnchant", "--limit", "3");

        expect(resultsOf(io)).toHaveLength(3);
        expect(resultsOf(io).every((result) => result.kind === "item" || result.kind === "cardOrEnchant")).toBe(true);
    });

    it.each([
        { situation: "no words", searchArguments: [] },
        { situation: "an unknown kind", searchArguments: ["ring", "--kind", "weapon"] },
        { situation: "a limit that is not a count", searchArguments: ["ring", "--limit", "many"] },
        { situation: "an unknown option", searchArguments: ["ring", "--fast"] },
    ])("explains its usage for $situation", async ({ searchArguments }) => {
        const { exitCode, io } = await search(...searchArguments);

        expect(exitCode).toBe(exitCodes.usage);
        expect(onlyFailureOf(io).kind).toBe("usage");
    });
});
