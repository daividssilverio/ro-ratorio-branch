import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { answerLine, answerMessage, errorCodes, supportedProtocolVersions } from "./mcp-server.ts";
import { goldenSaveUrlOf } from "../../core/src/sharing/golden-save-urls.ts";
import { createToolContext, tools } from "./tools.ts";

const mechanicBuild = JSON.parse(readFileSync(new URL("../../core/src/build/golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8"));
const damageTheUpstreamPageShows = { averageDamagePerAttack: 911001, averageDamagePerSecond: 6507149 };
const tree = { formatVersion: 1, scenario: mechanicBuild.scenario, root: mechanicBuild.character, nodes: [] as unknown[] };
const strongerNode = { id: "stronger", parentId: null, label: "STR 130", zenyCost: 0, changes: [{ kind: "setBaseStat", stat: "str", value: 130 }] };
const shieldListing = "+ 7　剛勇無双の籠手[1]\nアリスカード\n固定詠唱時間 - 50%";
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

    it("lists its tools, each with a schema for its input", async () => {
        const listed = (await resultOf("tools/list")).tools as { name: string; inputSchema: { type: string; properties: object } }[];

        expect(listed.map((tool) => tool.name)).toEqual(["search", "calc", "apply_change", "import_build", "export_build", "rank_slot_candidates", "rank_socket_choices", "read_listing", "compare_nodes", "rank_leaves"]);
        expect(listed.every((tool) => tool.inputSchema.type === "object" && Object.keys(tool.inputSchema.properties).length > 0)).toBe(true);
        expect(tools).toHaveLength(10);
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
    // The context loads the engine and the name index on first use; doing it here keeps each test to its own work on a slow machine.
    beforeAll(async () => {
        await Promise.all([context.engine(), context.nameSearch()]);
    }, 60_000);

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

    it("import_build reads a ROラトリオHUB save URL as the build it was made from", async () => {
        const imported = (await call("import_build", { text: goldenSaveUrlOf["mechanic-arms-cannon"] })).structuredContent;

        expect(imported).toEqual({ kind: "build", build: mechanicBuild, notImported: [] });
    });

    it("export_build gives an app link, a build code and a ROラトリオHUB save URL, and each reads back as the same build", async () => {
        const exported = (await call("export_build", { build: mechanicBuild })).structuredContent;

        expect(exported.appLink.startsWith("https://daividssilverio.github.io/ro-ratorio-branch/#B")).toBe(true);
        expect(exported.notExported).toEqual([]);
        for (const text of [exported.appLink, exported.shareCode, exported.ratorioSaveUrl]) {
            expect((await call("import_build", { text })).structuredContent).toMatchObject({ kind: "build", build: mechanicBuild });
        }
    });

    it("export_build gives a tree as an app link that reads back as the same tree", async () => {
        const branched = { ...tree, nodes: [strongerNode] };
        const exported = (await call("export_build", { tree: branched })).structuredContent;

        expect(exported.ratorioSaveUrl).toBeUndefined();
        expect((await call("import_build", { text: exported.appLink })).structuredContent).toEqual({ kind: "tree", tree: branched });
    });

    it("rank_slot_candidates ranks the items for a slot, and links to a tree with the best as branches", async () => {
        const ranked = (await call("rank_slot_candidates", { build: mechanicBuild, slot: "garment", effectQuery: "物理 大型", limit: 3, branchCount: 2 })).structuredContent;
        const reopened = (await call("import_build", { text: ranked.appLink })).structuredContent;

        expect(ranked.slot).toBe("garment");
        expect(ranked.choices.length).toBeGreaterThan(0);
        expect(ranked.choices.length).toBeLessThanOrEqual(3);
        expect(ranked.choices.every((candidate: { matchedEffects: string[] }) => candidate.matchedEffects.length > 0)).toBe(true);
        expect(reopened.tree.nodes.map((node: { label: string }) => node.label)).toEqual(ranked.choices.slice(0, 2).map((candidate: { name: string }) => candidate.name));
    });

    it("rank_slot_candidates tries the best items at other refines too, as child branches", async () => {
        const ranked = (await call("rank_slot_candidates", { build: mechanicBuild, slot: "shoes", nameQuery: "剛勇無双", limit: 1, branchCount: 1, refineLevels: [7] })).structuredContent;
        const [choice] = ranked.choices;

        expect(choice.byRefine.map((option: { refine: number }) => option.refine)).toContain(7);
        expect(ranked.tree.nodes.slice(1).every((node: { parentId: string }) => node.parentId === ranked.tree.nodes[0].id)).toBe(true);
        expect(ranked.tree.nodes).toHaveLength(1 + choice.byRefine.length);
    });

    it("rank_slot_candidates keeps only the items whose name matches", async () => {
        const ranked = (await call("rank_slot_candidates", { build: mechanicBuild, slot: "shoes", nameQuery: "剛勇無双", branchCount: 0 })).structuredContent;

        expect(ranked.consideredCount).toBeGreaterThan(0);
        expect(ranked.choices.every((candidate: { name: string }) => candidate.name.includes("剛勇無双"))).toBe(true);
    });

    it("rank_socket_choices ranks what one socket takes, kept to an effect asked for", async () => {
        const ranked = (await call("rank_socket_choices", { build: mechanicBuild, slot: "shield", socketIndex: 3, effectQuery: "詠唱", branchCount: 1 })).structuredContent;
        const reopened = (await call("import_build", { text: ranked.appLink })).structuredContent;

        expect(ranked.choices.map((choice: { id: number }) => choice.id).sort()).toEqual([1179, 1246]);
        expect(reopened.tree.nodes).toHaveLength(1);
    });

    it("rank_slot_candidates starts from a node of a tree and gives the tree back with the branches under that node", async () => {
        const branched = { ...tree, nodes: [strongerNode] };
        const ranked = (await call("rank_slot_candidates", { tree: branched, nodeId: "stronger", slot: "shoes", nameQuery: "剛勇無双", branchCount: 1 })).structuredContent;
        const startingNode = (await call("apply_change", { tree, node: strongerNode })).structuredContent.node;
        const newBranch = (await call("apply_change", { tree: ranked.tree, node: ranked.tree.nodes[1] })).structuredContent.node;

        expect(ranked.tree.nodes.map((node: { parentId: string | null }) => node.parentId)).toEqual([null, "stronger"]);
        expect(ranked.current.averageDamagePerSecond).toBe(startingNode.battleSummary.averageDamagePerSecond);
        expect(newBranch.battleSummary.averageDamagePerSecond).toBe(ranked.choices[0].averageDamagePerSecond);
    });

    it("read_listing reads a listing from the official tool as a piece, line by line", async () => {
        const read = (await call("read_listing", { text: shieldListing })).structuredContent;

        expect(read.gearPiece).toEqual({ itemId: 4936, refine: 7, sockets: [231, null, null, 1246] });
        expect(read.lines.map((line: { reading: { kind: string } }) => line.reading.kind)).toEqual(["item", "cardOrEnchant", "cardOrEnchant"]);
        expect(read.slotsOfItem).toEqual(["shield"]);
    });

    it("read_listing puts the piece into the comparison as a branch, with the damage before and after", async () => {
        const branched = { ...tree, nodes: [strongerNode] };
        const read = (await call("read_listing", { text: shieldListing, tree: branched, nodeId: "stronger" })).structuredContent;
        const branch = read.tree.nodes[1];
        const applied = (await call("apply_change", { tree: read.tree, node: branch })).structuredContent;

        expect(branch).toMatchObject({ parentId: "stronger", label: "+7 剛勇無双の籠手", changes: [{ kind: "setGearPiece", slot: "shield", gearPiece: read.gearPiece }] });
        expect(read.after.averageDamagePerSecond).toBe(applied.node.battleSummary.averageDamagePerSecond);
        expect((await call("import_build", { text: read.appLink })).structuredContent.tree).toEqual(read.tree);
    });

    it("keeps to the highest refine asked for, and ranks a socket on the piece without its enchants", async () => {
        const capped = (await call("rank_slot_candidates", { build: mechanicBuild, slot: "shoes", nameQuery: "剛勇無双", limit: 1, branchCount: 1, highestRefine: 4, refineLevels: [4] })).structuredContent;
        const bare = (await call("rank_socket_choices", { build: mechanicBuild, slot: "shoes", socketIndex: 3, emptyOtherSockets: true, branchCount: 0 })).structuredContent;

        expect(capped.tree.nodes[0].changes[0].gearPiece.refine).toBe(4);
        expect(capped.choices[0].byRefine.every((option: { refine: number }) => option.refine < 4)).toBe(true);
        expect(bare.choices.map((choice: { id: number }) => choice.id)).toContain(mechanicBuild.character.equipment.shoes.sockets[3]);
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
        { situation: "text that is no build or tree", name: "import_build", toolArguments: { text: "hello" }, kind: "notImported" },
        { situation: "both a build and a tree", name: "export_build", toolArguments: { build: mechanicBuild, tree }, kind: "invalidArguments" },
        { situation: "a slot there is not", name: "rank_slot_candidates", toolArguments: { build: mechanicBuild, slot: "tail" }, kind: "invalidArguments" },
        { situation: "a socket of a slot with nothing in it", name: "rank_socket_choices", toolArguments: { build: mechanicBuild, slot: "leftHand", socketIndex: 0 }, kind: "noPieceInSlot" },
        { situation: "no socket asked for", name: "rank_socket_choices", toolArguments: { build: mechanicBuild, slot: "shield" }, kind: "invalidArguments" },
        { situation: "a listing of an item it does not know", name: "read_listing", toolArguments: { text: "+ 7　存在しない装備[1]" }, kind: "listingNotRead" },
        { situation: "a slot the listed item does not fit", name: "read_listing", toolArguments: { text: "+ 7　剛勇無双の籠手[1]", build: mechanicBuild, slot: "shoes" }, kind: "invalidArguments" },
        { situation: "a refine level above +10", name: "rank_slot_candidates", toolArguments: { build: mechanicBuild, slot: "shoes", refineLevels: [11] }, kind: "invalidArguments" },
        { situation: "a node the tree does not have", name: "rank_slot_candidates", toolArguments: { tree, nodeId: "nobody", slot: "shoes" }, kind: "unusableNode" },
        { situation: "a tree without the node to start from", name: "rank_slot_candidates", toolArguments: { tree, slot: "shoes" }, kind: "invalidArguments" },
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
