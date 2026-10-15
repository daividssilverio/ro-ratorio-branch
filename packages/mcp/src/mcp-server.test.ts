import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { answerLine, answerMessage, errorCodes, supportedProtocolVersions } from "./mcp-server.ts";
import { createToolContext, tools } from "./tools.ts";

const mechanicBuild = JSON.parse(readFileSync(new URL("../../core/src/build/golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8"));
const damageTheUpstreamPageShows = { averageDamagePerAttack: 911001, averageDamagePerSecond: 6507149 };
const tree = { formatVersion: 1, scenario: mechanicBuild.scenario, root: mechanicBuild.character, nodes: [] as unknown[] };
const strongerNode = { id: "stronger", parentId: null, label: "STR 130", zenyCost: 0, changes: [{ kind: "setBaseStat", stat: "str", value: 130 }] };
const weakerNode = { id: "weaker", parentId: null, label: "STR 1", zenyCost: 1_000_000, changes: [{ kind: "setBaseStat", stat: "str", value: 1 }] };

const context = createToolContext();
let nextId = 1;

async function resultOf(method: string, params?: object): Promise<any> {
    const response = await answerMessage({ jsonrpc: "2.0", id: nextId++, method, ...(params === undefined ? {} : { params }) }, context);
    if (response === undefined || !("result" in response)) {
        throw new Error(`no result for ${method}: ${JSON.stringify(response)}`);
    }
    return response.result;
}

const call = (name: string, toolArguments: object) => resultOf("tools/call", { name, arguments: toolArguments });

describe("the protocol", () => {
    it("agrees on the revision the client asks for, or offers its newest", async () => {
        expect((await resultOf("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } })).protocolVersion).toBe("2024-11-05");
        expect((await resultOf("initialize", { protocolVersion: "1999-01-01" })).protocolVersion).toBe(supportedProtocolVersions[0]);
        expect((await resultOf("initialize", {})).capabilities).toEqual({ tools: {} });
    });

    it("lists its five tools, each with a schema for its input", async () => {
        const listed = (await resultOf("tools/list")).tools as { name: string; inputSchema: { type: string; required: string[] } }[];

        expect(listed.map((tool) => tool.name)).toEqual(["search", "calc", "apply_change", "compare_nodes", "rank_leaves"]);
        expect(listed.every((tool) => tool.inputSchema.type === "object" && tool.inputSchema.required.length > 0)).toBe(true);
        expect(tools).toHaveLength(5);
    });

    it("answers a ping and stays silent on a notification", async () => {
        expect(await resultOf("ping")).toEqual({});
        expect(await answerMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, context)).toBeUndefined();
    });

    it.each([
        { situation: "a method it does not have", message: { jsonrpc: "2.0", id: 1, method: "resources/list" }, code: errorCodes.methodNotFound },
        { situation: "a tool it does not have", message: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "delete_everything" } }, code: errorCodes.invalidParams },
        { situation: "something that is not a request", message: { hello: "there" }, code: errorCodes.invalidRequest },
    ])("refuses $situation", async ({ message, code }) => {
        expect(await answerMessage(message, context)).toMatchObject({ error: { code } });
    });

    it("refuses a line that is not JSON and skips an empty one", async () => {
        expect(JSON.parse((await answerLine("{not json", context)) ?? "")).toMatchObject({ id: null, error: { code: errorCodes.parseError } });
        expect(await answerLine("   ", context)).toBeUndefined();
    });
});

describe("the tools", () => {
    it("search finds a name and gives its ratorio ID", async () => {
        const found = await call("search", { query: "meron meisu", kinds: ["item"], limit: 3 });

        expect(found.isError).toBe(false);
        expect(found.structuredContent.results[0]).toMatchObject({ kind: "item", id: 4411 });
        expect(JSON.parse(found.content[0].text)).toEqual(found.structuredContent);
    });

    it("calc gives the numbers the upstream page shows", async () => {
        expect((await call("calc", { build: mechanicBuild })).structuredContent).toMatchObject(damageTheUpstreamPageShows);
    });

    it("apply_change gives back the tree with the node in it and what the node does", async () => {
        const applied = (await call("apply_change", { tree, node: strongerNode })).structuredContent;

        expect(applied.tree.nodes).toEqual([strongerNode]);
        expect(applied.root.battleSummary).toMatchObject(damageTheUpstreamPageShows);
        expect(applied.node).toMatchObject({ id: "stronger", state: "ready" });
        expect(applied.node.damagePerSecondGain).toBeGreaterThan(0);
    });

    it("compare_nodes says what differs between the root and a node", async () => {
        const compared = (await call("compare_nodes", { tree: { ...tree, nodes: [strongerNode] }, fromNodeId: null, toNodeId: "stronger" })).structuredContent;

        expect(compared.state).toBe("compared");
        expect(compared.diff.damage.averageDamagePerSecond.before).toBe(damageTheUpstreamPageShows.averageDamagePerSecond);
        expect(compared.diff.otherInputs.some((input: { before: number; after: number }) => input.after === 130)).toBe(true);
    });

    it("rank_leaves puts the best leaf first for the metric asked", async () => {
        const twoLeaves = { ...tree, nodes: [strongerNode, weakerNode] };
        const byGain = (await call("rank_leaves", { tree: twoLeaves })).structuredContent;
        const byCost = (await call("rank_leaves", { tree: twoLeaves, metric: "cumulativeZenyCost" })).structuredContent;

        expect(byGain.metric).toBe("damagePerSecondGain");
        expect(byGain.leaves.map((leaf: { nodeId: string }) => leaf.nodeId)).toEqual(["stronger", "weaker"]);
        expect(byCost.leaves[0]).toMatchObject({ nodeId: "stronger", cumulativeZenyCost: 0 });
    });

    it.each([
        { situation: "a build that breaks the format", name: "calc", toolArguments: { build: { formatVersion: 1 } }, kind: "invalidBuild" },
        { situation: "a build the engine refuses", name: "calc", toolArguments: { build: { ...mechanicBuild, character: { ...mechanicBuild.character, jobId: 9_999_999 } } }, kind: "buildNotCalculable" },
        { situation: "a node whose parent is missing", name: "apply_change", toolArguments: { tree, node: { ...strongerNode, parentId: "nobody" } }, kind: "invalidTree" },
        { situation: "a query that is empty", name: "search", toolArguments: { query: " " }, kind: "invalidArguments" },
        { situation: "a metric it does not rank by", name: "rank_leaves", toolArguments: { tree, metric: "luck" }, kind: "invalidArguments" },
    ])("say why they could not work on $situation", async ({ name, toolArguments, kind }) => {
        const refused = await call(name, toolArguments);

        expect(refused.isError).toBe(true);
        expect(refused.structuredContent.error.kind).toBe(kind);
    });
});

describe("the server as a process", () => {
    it("answers each line on standard input with a line on standard output, in order", async () => {
        const lines = [
            { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: supportedProtocolVersions[0], capabilities: {}, clientInfo: { name: "test", version: "0" } } },
            { jsonrpc: "2.0", method: "notifications/initialized" },
            { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "calc", arguments: { build: mechanicBuild } } },
            { jsonrpc: "2.0", id: 3, method: "ping" },
        ];
        const output = await new Promise<string>((resolve, reject) => {
            const child = execFile(process.execPath, [fileURLToPath(new URL("./rocalc-mcp.ts", import.meta.url))], (error, stdout) => (error === null ? resolve(stdout) : reject(error)));
            child.stdin?.end(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
        });
        const answers = output.trim().split("\n").map((line) => JSON.parse(line));

        expect(answers.map((answer) => answer.id)).toEqual([1, 2, 3]);
        expect(answers[0].result.serverInfo.name).toBe("ro-ratorio-branch");
        expect(answers[1].result.structuredContent).toMatchObject(damageTheUpstreamPageShows);
    }, 60_000);
});
