import {
    BuildConversionError,
    type BuildConversionIssue,
    type BuildIssue,
    buildJsonSchema,
    calculateBuild,
    calculatorOn,
    compareNodePair,
    describeEvaluation,
    evaluateTree,
    InvalidBuildError,
    InvalidTreeError,
    loadNameSearch,
    loadRatorioEngine,
    type NameSearch,
    parseBuild,
    parseTree,
    type RankingMetric,
    rankingMetrics,
    rankLeaves,
    type RatorioEngine,
    type TextKind,
    textKinds,
    type TreeIssue,
    treeJsonSchema,
    withNode,
} from "@ro-ratorio-branch/core";

/** What a tool needs that takes a moment to load. Each is loaded once, when a tool first asks for it. */
export interface ToolContext {
    engine(): Promise<RatorioEngine>;
    nameSearch(): Promise<NameSearch>;
}

export function createToolContext(): ToolContext {
    let engine: Promise<RatorioEngine> | undefined;
    let nameSearch: Promise<NameSearch> | undefined;
    return {
        engine: () => (engine ??= loadRatorioEngine()),
        nameSearch: () => (nameSearch ??= loadNameSearch()),
    };
}

/** Why a tool could not do what it was asked, in the shape `rocalc` reports failures. */
export type ToolFailure =
    | { readonly kind: "invalidArguments"; readonly problems: readonly ArgumentProblem[] }
    | { readonly kind: "invalidBuild"; readonly issues: readonly BuildIssue[] }
    | { readonly kind: "buildNotCalculable"; readonly issues: readonly BuildConversionIssue[] }
    | { readonly kind: "invalidTree"; readonly issues: readonly TreeIssue[] };

export interface ArgumentProblem {
    readonly argument: string;
    readonly expected: string;
}

export type ToolOutcome = { readonly state: "done"; readonly result: unknown } | { readonly state: "failed"; readonly failure: ToolFailure };

class InvalidArgumentsError extends Error {
    readonly problems: readonly ArgumentProblem[];

    constructor(problems: readonly ArgumentProblem[]) {
        super("invalid arguments");
        this.problems = problems;
    }
}

type Arguments = Readonly<Record<string, unknown>>;

interface Tool {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: object;
    call(toolArguments: Arguments, context: ToolContext): Promise<unknown>;
}

// The file formats are the published schemas; inside a tool's input they stand without a dialect and title of their own.
const withoutDocumentKeywords = ({ $schema: _dialect, title: _title, ...schema }: Record<string, unknown>) => schema;
const buildSchema = withoutDocumentKeywords(buildJsonSchema);
const treeSchema = withoutDocumentKeywords(treeJsonSchema);
const nodeSchema = (treeJsonSchema as unknown as { properties: { nodes: { items: object } } }).properties.nodes.items;
const nodeIdOrRoot = { type: ["string", "null"], description: "A node ID, or null for the tree's root." };
const idNote = "IDs are ROラトリオHUB's own numbers; find them with the search tool.";

function textArgument(toolArguments: Arguments, argument: string): string {
    const value = toolArguments[argument];
    if (typeof value !== "string" || value.trim() === "") {
        throw new InvalidArgumentsError([{ argument, expected: "a text that is not empty" }]);
    }
    return value;
}

function nodeIdArgument(toolArguments: Arguments, argument: string): string | null {
    const value = toolArguments[argument];
    if (value !== null && typeof value !== "string") {
        throw new InvalidArgumentsError([{ argument, expected: "a node ID, or null for the root" }]);
    }
    return value;
}

export const tools: readonly Tool[] = [
    {
        name: "search",
        description:
            "Find items, cards and enchants, monsters, skills, jobs and timed effects of Ragnarok Online Japan by name, and get their ratorio IDs. " +
            "A word may be part of the Japanese name, its reading in kana or romaji, an English word, an alias (AC) or #ID; typing mistakes are forgiven and words may come in any order. " +
            "An English name with isEnglishConfirmed false was put together from a glossary and may not be the official one.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "What to look for, for example 'diamond boots', 'sensha', 'メロンメイス' or '#4411'." },
                kinds: { type: "array", items: { enum: textKinds }, description: "The kinds to look in. Every kind when left out." },
                limit: { type: "integer", minimum: 1, maximum: 100, description: "The most results to give. 20 when left out." },
            },
            required: ["query"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const query = textArgument(toolArguments, "query");
            const { kinds, limit } = toolArguments;
            const problems: ArgumentProblem[] = [];
            if (kinds !== undefined && !(Array.isArray(kinds) && kinds.every((kind) => textKinds.some((textKind) => textKind === kind)))) {
                problems.push({ argument: "kinds", expected: `a list of: ${textKinds.join(", ")}` });
            }
            if (limit !== undefined && !(typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= 100)) {
                problems.push({ argument: "limit", expected: "a whole number from 1 to 100" });
            }
            if (problems.length > 0) {
                throw new InvalidArgumentsError(problems);
            }
            const results = (await context.nameSearch()).search(query, {
                ...(kinds === undefined ? {} : { kinds: kinds as TextKind[] }),
                ...(limit === undefined ? {} : { limit: limit as number }),
            });
            return { query, results };
        },
    },
    {
        name: "calc",
        description:
            "Calculate one build with the ROラトリオHUB damage engine: average damage per attack, damage per second and time to kill of the scenario's attack against its target monster. " +
            idNote,
        inputSchema: { type: "object", properties: { build: buildSchema }, required: ["build"], additionalProperties: false },
        async call(toolArguments, context) {
            return calculateBuild(parseBuild(toolArguments["build"]), await context.engine());
        },
    },
    {
        name: "apply_change",
        description:
            "Add an upgrade step to a tree as a node holding its changes against its parent (or put it in place of the node with the same ID), and calculate it. " +
            "Gives back the whole tree with the node in it, to pass to the next call, and what the node does against its parent and against the root. " +
            "A node whose state is stale names an item its parent does not wear; one that is notCalculable lists what the engine refused.",
        inputSchema: { type: "object", properties: { tree: treeSchema, node: nodeSchema }, required: ["tree", "node"], additionalProperties: false },
        async call(toolArguments, context) {
            const tree = withNode(parseTree(toolArguments["tree"]), toolArguments["node"] as never);
            const comparison = describeEvaluation(tree, await evaluateTree(tree, calculatorOn(await context.engine())));
            const nodeId = (toolArguments["node"] as { id: string }).id;
            return { tree, root: comparison.root, node: comparison.nodes.find((node) => node.id === nodeId) };
        },
    },
    {
        name: "compare_nodes",
        description:
            "Say what differs between two builds of a tree, each the root or a node: the gear by slot, the other inputs, the stats and bonuses the engine derived, and the damage per attack, per second and time to kill on both sides.",
        inputSchema: {
            type: "object",
            properties: { tree: treeSchema, fromNodeId: nodeIdOrRoot, toNodeId: nodeIdOrRoot },
            required: ["tree", "fromNodeId", "toNodeId"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const tree = parseTree(toolArguments["tree"]);
            const fromNodeId = nodeIdArgument(toolArguments, "fromNodeId");
            const toNodeId = nodeIdArgument(toolArguments, "toNodeId");
            return compareNodePair(tree, await evaluateTree(tree, calculatorOn(await context.engine())), fromNodeId, toNodeId);
        },
    },
    {
        name: "rank_leaves",
        description:
            "Rank the finished upgrade paths of a tree (the nodes nothing builds on), best first: by damage per second gained over the root, by time to kill, by what the path costs in zeny, or by damage gained per million zeny. " +
            "Nodes that are stale or cannot be calculated are left out.",
        inputSchema: {
            type: "object",
            properties: { tree: treeSchema, metric: { enum: rankingMetrics, description: "damagePerSecondGain when left out." } },
            required: ["tree"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const tree = parseTree(toolArguments["tree"]);
            const metric = toolArguments["metric"] ?? "damagePerSecondGain";
            if (!rankingMetrics.some((rankingMetric) => rankingMetric === metric)) {
                throw new InvalidArgumentsError([{ argument: "metric", expected: `one of: ${rankingMetrics.join(", ")}` }]);
            }
            const evaluation = await evaluateTree(tree, calculatorOn(await context.engine()));
            return { metric, root: describeEvaluation(tree, evaluation).root, leaves: rankLeaves(tree, evaluation, metric as RankingMetric) };
        },
    },
];

/** Runs a tool. `undefined` for a name that is not a tool. */
export async function callTool(name: string, toolArguments: Arguments, context: ToolContext): Promise<ToolOutcome | undefined> {
    const tool = tools.find((candidate) => candidate.name === name);
    if (tool === undefined) {
        return undefined;
    }
    try {
        return { state: "done", result: await tool.call(toolArguments, context) };
    } catch (error) {
        const failure = failureOf(error);
        if (failure === undefined) {
            throw error;
        }
        return { state: "failed", failure };
    }
}

function failureOf(error: unknown): ToolFailure | undefined {
    if (error instanceof InvalidArgumentsError) {
        return { kind: "invalidArguments", problems: error.problems };
    }
    if (error instanceof InvalidBuildError) {
        return { kind: "invalidBuild", issues: error.issues };
    }
    if (error instanceof BuildConversionError) {
        return { kind: "buildNotCalculable", issues: error.issues };
    }
    if (error instanceof InvalidTreeError) {
        return { kind: "invalidTree", issues: error.issues };
    }
    return undefined;
}
