import {
    buildFormatVersion,
    buildOfNode,
    BuildConversionError,
    type ChoiceRanking,
    type ChoiceRankingOptions,
    type BuildConversionIssue,
    type BuildIssue,
    buildJsonSchema,
    calculateBuild,
    calculatorOn,
    compareNodePair,
    describeEvaluation,
    encodeShareCode,
    type EnglishGlossary,
    type EquipmentSlot,
    equipmentSlots,
    evaluateTree,
    exportRatorioSave,
    type ImportRefusal,
    InvalidBuildError,
    InvalidTreeError,
    type GearListingLine,
    graftNodes,
    loadEffectWords,
    outcomeOf,
    readGearListing,
    loadNameSearch,
    NoPieceInSlotError,
    loadRatorioEngine,
    type NameSearch,
    parseBuild,
    parseTree,
    publishedAppAddress,
    type RankingMetric,
    rankingMetrics,
    rankLeaves,
    rankSlotCandidates,
    rankSocketChoices,
    ratorioPageUrl,
    type RatorioEngine,
    type RecognizedImport,
    recognizeImport,
    saveReadingOn,
    shareLinkOf,
    type TextKind,
    textKinds,
    type TreeIssue,
    treeJsonSchema,
    treeOf,
    type Tree,
    UnusableNodeError,
    withNode,
    withRankingUnder,
} from "@ro-ratorio-branch/core";

/** What a tool needs that takes a moment to load. Each is loaded once, when a tool first asks for it. */
export interface ToolContext {
    engine(): Promise<RatorioEngine>;
    nameSearch(): Promise<NameSearch>;
    effectWords(): Promise<EnglishGlossary>;
}

export function createToolContext(): ToolContext {
    let engine: Promise<RatorioEngine> | undefined;
    let nameSearch: Promise<NameSearch> | undefined;
    let effectWords: Promise<EnglishGlossary> | undefined;
    return {
        engine: () => (engine ??= loadRatorioEngine()),
        nameSearch: () => (nameSearch ??= loadNameSearch()),
        effectWords: () => (effectWords ??= loadEffectWords()),
    };
}

/** Why a tool could not do what it was asked, in the shape `rocalc` reports failures. */
export type ToolFailure =
    | { readonly kind: "invalidArguments"; readonly problems: readonly ArgumentProblem[] }
    | { readonly kind: "invalidBuild"; readonly issues: readonly BuildIssue[] }
    | { readonly kind: "buildNotCalculable"; readonly issues: readonly BuildConversionIssue[] }
    | { readonly kind: "invalidTree"; readonly issues: readonly TreeIssue[] }
    | { readonly kind: "notImported"; readonly refusal: ImportRefusal }
    | { readonly kind: "noPieceInSlot"; readonly slot: EquipmentSlot }
    | { readonly kind: "unusableNode"; readonly nodeId: string; readonly reason: "unknown" | "stale" }
    | { readonly kind: "listingNotRead"; readonly lines: readonly GearListingLine[] };

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

class ListingNotReadError extends Error {
    readonly lines: readonly GearListingLine[];

    constructor(lines: readonly GearListingLine[]) {
        super("listing not read");
        this.lines = lines;
    }
}

class NotImportedError extends Error {
    readonly refusal: ImportRefusal;

    constructor(refusal: ImportRefusal) {
        super("not imported");
        this.refusal = refusal;
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

function wholeNumberArgument(toolArguments: Arguments, argument: string, lowest: number, highest: number, fallback: number): number {
    const value = toolArguments[argument] ?? fallback;
    if (typeof value !== "number" || !Number.isInteger(value) || value < lowest || value > highest) {
        throw new InvalidArgumentsError([{ argument, expected: `a whole number from ${lowest} to ${highest}` }]);
    }
    return value;
}

function optionalTextArgument(toolArguments: Arguments, argument: string): string | undefined {
    const value = toolArguments[argument];
    if (value !== undefined && typeof value !== "string") {
        throw new InvalidArgumentsError([{ argument, expected: "a text" }]);
    }
    return value === undefined || value.trim() === "" ? undefined : value;
}

const appLinkOf = async (content: Parameters<typeof encodeShareCode>[0]) => shareLinkOf(publishedAppAddress, await encodeShareCode(content));

const startingPointSchemas = {
    build: { ...buildSchema, description: "The build to start from. Or give tree and nodeId instead." },
    tree: { ...treeSchema, description: "A tree to start from one of its nodes; the branches come back in it, under that node." },
    nodeId: { ...nodeIdOrRoot, description: "With tree: the node to start from (the app shows a node's ID in its node panel), or null for the root." },
};

const rankingOptionSchemas = (choices: string) => ({
    nameQuery: { type: "string", description: `Keep only ${choices} whose name matches.` },
    effectQuery: { type: "string", description: `Keep only ${choices} whose effects have every word of this.` },
    limit: { type: "integer", minimum: 1, maximum: 50, description: "How many of the best to give. 10 when left out." },
    branchCount: { type: "integer", minimum: 0, maximum: 20, description: "How many of the best become branches of the tree. 5 when left out." },
});

/** The build, the slot and the options a ranking tool was given, checked. A tree and a node stand for the node's build, and the branches go under that node. */
async function rankingArguments(toolArguments: Arguments, context: ToolContext, nameKind: "item" | "cardOrEnchant") {
    const hasBuild = toolArguments["build"] !== undefined;
    if (hasBuild === (toolArguments["tree"] !== undefined)) {
        throw new InvalidArgumentsError([{ argument: "build", expected: "a build, or a tree with nodeId, one of the two" }]);
    }
    const startingPoint = hasBuild ? undefined : { tree: parseTree(toolArguments["tree"]), nodeId: nodeIdArgument(toolArguments, "nodeId") };
    const build = startingPoint === undefined ? parseBuild(toolArguments["build"]) : buildOfNode(startingPoint.tree, startingPoint.nodeId);
    const slot = toolArguments["slot"];
    if (!equipmentSlots.some((equipmentSlot) => equipmentSlot === slot)) {
        throw new InvalidArgumentsError([{ argument: "slot", expected: `one of: ${equipmentSlots.join(", ")}` }]);
    }
    const limit = wholeNumberArgument(toolArguments, "limit", 1, 50, 10);
    const branchCount = wholeNumberArgument(toolArguments, "branchCount", 0, 20, 5);
    const nameQuery = optionalTextArgument(toolArguments, "nameQuery");
    const effectQuery = optionalTextArgument(toolArguments, "effectQuery");
    const idsNamed = nameQuery === undefined ? undefined : new Set((await context.nameSearch()).search(nameQuery, { kinds: [nameKind], limit: Number.MAX_SAFE_INTEGER }).map((result) => result.id));
    const options: ChoiceRankingOptions = {
        ...(idsNamed === undefined ? {} : { matchesName: (id: number) => idsNamed.has(id) }),
        ...(effectQuery === undefined ? {} : { effectQuery, effectWords: await context.effectWords() }),
        limit,
        branchCount,
    };
    return { build, slot: slot as EquipmentSlot, options, startingPoint };
}

/** What a ranking tool gives back: the ranking, its branches in the tree it started from (or a tree of their own), and a link to open that tree. */
async function rankingResult<Ranking extends ChoiceRanking>(ranking: Ranking, startingPoint: { readonly tree: Tree; readonly nodeId: string | null } | undefined) {
    const tree = startingPoint === undefined ? ranking.tree : withRankingUnder(startingPoint.tree, startingPoint.nodeId, ranking);
    return { ...ranking, tree, appLink: await appLinkOf(tree) };
}

/** What was read, in the formats the other tools take. */
function importedContentOf(recognized: RecognizedImport) {
    if (recognized.kind === "tree") {
        return { kind: "tree", tree: recognized.tree };
    }
    if (recognized.kind === "workspace") {
        const { workspace } = recognized;
        return { kind: "workspace", trees: Object.entries(workspace.trees).map(([treeId, tree]) => ({ treeId, name: tree.name, tree: treeOf(workspace, treeId) })) };
    }
    const { character, scenario, notImported } = recognized;
    return scenario === null
        ? { kind: "character", character, notImported, note: "The source names no attack or target; add a scenario to make it a build." }
        : { kind: "build", build: { formatVersion: buildFormatVersion, character, scenario }, notImported };
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
        name: "import_build",
        description:
            "Read a build or a tree from what ROラトリオHUB and this app share: a ROラトリオHUB save URL, a link to the app or a build code from its Share screen, the JSON of a build or tree file, or the app's JSON backup (which gives each of its trees). " +
            "Gives back the build or tree in the formats the other tools take. notImported lists what a ROラトリオHUB save held that the build format cannot carry yet.",
        inputSchema: {
            type: "object",
            properties: { text: { type: "string", description: "The URL, link, build code or JSON, as it was copied." } },
            required: ["text"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const text = textArgument(toolArguments, "text");
            const recognition = await recognizeImport(text, await saveReadingOn(await context.engine()));
            if ("refused" in recognition) {
                throw new NotImportedError(recognition.refused);
            }
            return importedContentOf(recognition.recognized);
        },
    },
    {
        name: "export_build",
        description:
            "Turn a build or a tree into what people open: appLink opens it in the app (a tree with its branches, a build as a character), shareCode is the same as the app's build code, and for a build ratorioSaveUrl opens it on ROラトリオHUB itself. " +
            "notExported lists what a ROラトリオHUB save has no place for. Give a build or a tree, not both.",
        inputSchema: { type: "object", properties: { build: buildSchema, tree: treeSchema }, additionalProperties: false },
        async call(toolArguments, context) {
            const hasBuild = toolArguments["build"] !== undefined;
            if (hasBuild === (toolArguments["tree"] !== undefined)) {
                throw new InvalidArgumentsError([{ argument: "build", expected: "a build or a tree, one of the two" }]);
            }
            if (!hasBuild) {
                const tree = parseTree(toolArguments["tree"]);
                const shareCode = await encodeShareCode(tree);
                return { appLink: shareLinkOf(publishedAppAddress, shareCode), shareCode };
            }
            const build = parseBuild(toolArguments["build"]);
            const engine = await context.engine();
            const shareCode = await encodeShareCode(build);
            const { content, notExported } = exportRatorioSave(build, engine);
            const writeRatorioSave = await engine.loadSaveWriter();
            return { appLink: shareLinkOf(publishedAppAddress, shareCode), shareCode, ratorioSaveUrl: `${ratorioPageUrl}?${writeRatorioSave(content)}`, notExported };
        },
    },
    {
        name: "rank_slot_candidates",
        description:
            "Find the best item for one equipment slot of a build: every item the build's job can wear there, worn in place of the current one and ranked by damage per second. " +
            "An item keeps the refine and transcendence of the piece it replaces and comes without cards, so damagePerSecondGain is measured against the current piece without its cards too (baseline); current is the build as it is. " +
            "With refineLevels, the best items are also tried at those refines and at the refines where their own effects start (+6, +8…), so an item that only pays off at +9 shows it. " +
            "highestRefine keeps to a refine the player can reach; the safe refine (no risk of breaking) is +4 for every item. " +
            "Narrow it with nameQuery (as the search tool reads names) or effectQuery (words in the item's effects, Japanese or English, for example '物理 大型' or 'critical'). " +
            "A whole slot takes some seconds: a few hundred items are calculated. tree has the build as its root and the best items as branches, and appLink opens that tree in the app. " +
            "To work from a node of a tree (\"starting from node branch-3\"), give tree and nodeId instead of build: the branches then come back in that tree, under that node. " +
            idNote,
        inputSchema: {
            type: "object",
            properties: {
                ...startingPointSchemas,
                slot: { enum: equipmentSlots, description: "The slot to fill." },
                ...rankingOptionSchemas("items"),
                highestRefine: {
                    type: "integer",
                    minimum: 0,
                    maximum: 10,
                    description: "The highest refine to consider, for example 4 for the safe refine or 7. Items are compared at it when the current piece is refined higher, and no refine above it is tried.",
                },
                refineLevels: {
                    type: "array",
                    items: { type: "integer", minimum: 0, maximum: 10 },
                    description:
                        "Refine levels to try the best items at as well, for example [7, 9]. Each item is also tried at the levels where its own effects start. They come back as byRefine, and as child branches of the item's branch.",
                },
            },
            required: ["slot"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const { build, slot, options, startingPoint } = await rankingArguments(toolArguments, context, "item");
            const refineLevels = toolArguments["refineLevels"];
            const highestRefine = toolArguments["highestRefine"] === undefined ? undefined : wholeNumberArgument(toolArguments, "highestRefine", 0, 10, Number.NaN);
            if (refineLevels !== undefined && !(Array.isArray(refineLevels) && refineLevels.every((level) => Number.isInteger(level) && level >= 0 && level <= 10))) {
                throw new InvalidArgumentsError([{ argument: "refineLevels", expected: "a list of whole numbers from 0 to 10" }]);
            }
            const refineOptions = { ...(refineLevels === undefined ? {} : { refineLevels: refineLevels as number[] }), ...(highestRefine === undefined ? {} : { highestRefine }) };
            return rankingResult(rankSlotCandidates(build, slot, await context.engine(), { ...options, ...refineOptions }), startingPoint);
        },
    },
    {
        name: "rank_socket_choices",
        description:
            "Find the best card or enchant for one socket of the piece worn in a slot: everything that socket takes, put in it and ranked by damage per second. " +
            "One socket at a time: rank a socket, put the chosen card or enchant into the build, then rank the next one, which then takes in what the others hold. " +
            "damagePerSecondGain is measured against the socket left empty (baseline); current is the build as it is, with what the socket holds now. " +
            "Use effectQuery for an effect the choice must give, for example '詠唱妨害不可', '石化' or 'petrification'; one that does not change damage still filters. " +
            "Socket 0 is the first: on armor and most gear it takes a card, the later ones the item's own enchants. tree has the best choices as branches, and appLink opens it in the app. " +
            "To work from a node of a tree (\"starting from node branch-3\"), give tree and nodeId instead of build: the branches then come back in that tree, under that node. " +
            idNote,
        inputSchema: {
            type: "object",
            properties: {
                ...startingPointSchemas,
                slot: { enum: equipmentSlots, description: "The slot whose piece has the socket." },
                socketIndex: { type: "integer", minimum: 0, maximum: 3, description: "The socket, 0 for the first." },
                emptyOtherSockets: { type: "boolean", description: "Rank on the piece without any cards or enchants yet: the other sockets are emptied, and what this one holds now is ranked with the rest." },
                ...rankingOptionSchemas("cards and enchants"),
            },
            required: ["slot", "socketIndex"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const { build, slot, options, startingPoint } = await rankingArguments(toolArguments, context, "cardOrEnchant");
            const socketIndex = wholeNumberArgument(toolArguments, "socketIndex", 0, 3, Number.NaN);
            const emptyOtherSockets = toolArguments["emptyOtherSockets"];
            if (emptyOtherSockets !== undefined && typeof emptyOtherSockets !== "boolean") {
                throw new InvalidArgumentsError([{ argument: "emptyOtherSockets", expected: "true or false" }]);
            }
            return rankingResult(rankSocketChoices(build, slot, socketIndex, await context.engine(), { ...options, ...(emptyOtherSockets === true ? { emptyOtherSockets } : {}) }), startingPoint);
        },
    },
    {
        name: "read_listing",
        description:
            "Read a market listing copied from the official tool (rotool's trade records: the item line '+ 9　メロンメイス[2]', then its cards, enchants and random options one per line) as a gear piece. " +
            "Each line says what it was read as, or why not (notUnderstood). " +
            "Given a build, or a tree and nodeId, it also puts the piece into the comparison: a branch wearing it, with the damage before and after, and appLink to open the tree in the app. " +
            "The slot is the first the item fits unless slot says another (accessory2, leftHand).",
        inputSchema: {
            type: "object",
            properties: {
                text: { type: "string", description: "The listing as it was copied." },
                ...startingPointSchemas,
                slot: { enum: equipmentSlots, description: "The slot to wear the piece in, when not the first it fits." },
                label: { type: "string", description: "The branch's name. The item's name and refine when left out." },
            },
            required: ["text"],
            additionalProperties: false,
        },
        async call(toolArguments, context) {
            const text = textArgument(toolArguments, "text");
            const engine = await context.engine();
            const listing = readGearListing(text, engine.catalog);
            if (listing.gearPiece === null) {
                throw new ListingNotReadError(listing.lines);
            }
            const gearPiece = listing.gearPiece;
            const slotsOfItem = engine.catalog.slotsOfItem(gearPiece.itemId);
            if (toolArguments["build"] === undefined && toolArguments["tree"] === undefined) {
                return { lines: listing.lines, gearPiece, slotsOfItem };
            }
            const startingTree: Tree =
                toolArguments["build"] === undefined
                    ? parseTree(toolArguments["tree"])
                    : (() => {
                          const build = parseBuild(toolArguments["build"]);
                          return { formatVersion: 1, scenario: build.scenario, root: build.character, nodes: [] };
                      })();
            const nodeId = toolArguments["build"] === undefined ? nodeIdArgument(toolArguments, "nodeId") : null;
            const requestedSlot = toolArguments["slot"];
            if (requestedSlot !== undefined && !slotsOfItem.some((slot) => slot === requestedSlot)) {
                throw new InvalidArgumentsError([{ argument: "slot", expected: `a slot the item fits: ${slotsOfItem.join(", ")}` }]);
            }
            const slot = (requestedSlot as EquipmentSlot | undefined) ?? slotsOfItem[0];
            if (slot === undefined) {
                throw new InvalidArgumentsError([{ argument: "text", expected: "a listing of an item that is worn in a slot" }]);
            }
            const before = buildOfNode(startingTree, nodeId);
            const after = { ...before, character: { ...before.character, equipment: { ...before.character.equipment, [slot]: gearPiece } } };
            const itemLine = listing.lines.find((line) => line.reading.kind === "item")?.reading;
            const itemName = itemLine?.kind === "item" ? itemLine.name : `#${gearPiece.itemId}`;
            const label = optionalTextArgument(toolArguments, "label") ?? (gearPiece.refine === undefined ? itemName : `+${gearPiece.refine} ${itemName}`);
            const branch = { id: "listing", parentId: null, label, changes: [{ kind: "setGearPiece" as const, slot, gearPiece }] };
            const tree = { ...startingTree, nodes: graftNodes(startingTree.nodes, nodeId, [branch]).nodes };
            const damageOf = (build: typeof before) => {
                const outcome = outcomeOf(build, engine);
                return outcome.state === "ready" ? outcome.battleSummary : { notCalculable: outcome.issues };
            };
            return { lines: listing.lines, gearPiece, slot, before: damageOf(before), after: damageOf(after), tree, appLink: await appLinkOf(tree) };
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
    if (error instanceof NotImportedError) {
        return { kind: "notImported", refusal: error.refusal };
    }
    if (error instanceof NoPieceInSlotError) {
        return { kind: "noPieceInSlot", slot: error.slot };
    }
    if (error instanceof ListingNotReadError) {
        return { kind: "listingNotRead", lines: error.lines };
    }
    if (error instanceof UnusableNodeError) {
        return { kind: "unusableNode", nodeId: error.nodeId, reason: error.reason };
    }
    return undefined;
}
