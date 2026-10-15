import {
    type BuildConversionIssue,
    BuildConversionError,
    type BuildIssue,
    calculateBuild,
    calculatorOn,
    compareTree,
    InvalidBuildError,
    InvalidTreeError,
    loadNameSearch,
    loadRatorioEngine,
    parseBuild,
    parseTree,
    type TextKind,
    textKinds,
    type TreeIssue,
} from "@ro-ratorio-branch/core";

export interface RocalcIo {
    readTextFile(filePath: string): Promise<string>;
    writeResult(text: string): void;
    writeFailure(text: string): void;
}

/** What `rocalc` prints to standard error, as one JSON document, when it exits with a failure. */
export type RocalcFailure =
    | { readonly kind: "usage"; readonly usageLines: readonly string[] }
    | { readonly kind: "fileNotReadable"; readonly filePath: string }
    | { readonly kind: "notJson"; readonly filePath: string }
    | { readonly kind: "invalidBuild"; readonly issues: readonly BuildIssue[] }
    | { readonly kind: "buildNotCalculable"; readonly issues: readonly BuildConversionIssue[] }
    | { readonly kind: "invalidTree"; readonly issues: readonly TreeIssue[] };

export const exitCodes = { success: 0, fileRejected: 1, usage: 2 } as const;

const usageLines = [
    "rocalc calc <build.json>",
    "    Calculates the build's attack against its target monster: average damage",
    "    per attack, damage per second and time to kill.",
    "",
    "rocalc compare <tree.json>",
    "    Calculates every node of an upgrade tree, what each one changes against",
    "    its parent, and the rankings by gain, kill time, cost and value for money.",
    "",
    "rocalc search <words…> [--kind <kind>[,<kind>…]] [--limit <count>]",
    "    Finds items, cards and enchants, monsters, skills, jobs and timed effects",
    "    by name: part of the name, its reading, romaji, English words, an alias",
    "    or #ID, give or take a typing mistake. Gives each one's ratorio ID.",
    `    Kinds: ${textKinds.join(", ")}.`,
    "",
    "Results are JSON on standard output.",
    "",
    "© Gravity Co., Ltd. & Lee MyoungJin(studio DTDS). All rights reserved.",
    "© GungHo Online Entertainment, Inc. All Rights Reserved.",
    "Fan-made, non-commercial.",
];

class RocalcFailureError extends Error {
    readonly failure: RocalcFailure;

    constructor(failure: RocalcFailure) {
        super(failure.kind);
        this.failure = failure;
    }
}

const commands = {
    async calc(fileContent: unknown): Promise<unknown> {
        return calculateBuild(parseBuild(fileContent), await loadRatorioEngine());
    },
    async compare(fileContent: unknown): Promise<unknown> {
        return compareTree(parseTree(fileContent), calculatorOn(await loadRatorioEngine()));
    },
};

interface SearchRequest {
    readonly query: string;
    readonly kinds?: readonly TextKind[];
    readonly limit?: number;
}

/** What `rocalc search` was asked, or `undefined` when its arguments do not make sense. */
function searchRequestOf(searchArguments: readonly string[]): SearchRequest | undefined {
    const words: string[] = [];
    let kinds: TextKind[] | undefined;
    let limit: number | undefined;
    for (let position = 0; position < searchArguments.length; position++) {
        const argument = searchArguments[position] ?? "";
        const value = searchArguments[position + 1];
        if (argument === "--kind") {
            const askedKinds = (value ?? "").split(",");
            if (askedKinds.some((kind) => !textKinds.some((textKind) => textKind === kind))) {
                return undefined;
            }
            kinds = askedKinds as TextKind[];
            position++;
        } else if (argument === "--limit") {
            limit = Number(value);
            if (!Number.isInteger(limit) || limit < 1) {
                return undefined;
            }
            position++;
        } else if (argument.startsWith("--")) {
            return undefined;
        } else {
            words.push(argument);
        }
    }
    const query = words.join(" ");
    return query.trim() === "" ? undefined : { query, ...(kinds === undefined ? {} : { kinds }), ...(limit === undefined ? {} : { limit }) };
}

async function runSearch(searchArguments: readonly string[], io: RocalcIo): Promise<number> {
    const request = searchRequestOf(searchArguments);
    if (request === undefined) {
        return fail(io, { kind: "usage", usageLines }, exitCodes.usage);
    }
    const { query, ...options } = request;
    const results = (await loadNameSearch()).search(query, options);
    io.writeResult(`${JSON.stringify({ query, results }, null, 2)}\n`);
    return exitCodes.success;
}

/** Runs one `rocalc` invocation and returns its exit code. */
export async function runRocalc(commandLineArguments: readonly string[], io: RocalcIo): Promise<number> {
    if (commandLineArguments[0] === "search") {
        return runSearch(commandLineArguments.slice(1), io);
    }
    const [commandName, filePath, ...unexpectedArguments] = commandLineArguments;
    if (
        commandName === undefined ||
        !Object.hasOwn(commands, commandName) ||
        filePath === undefined ||
        unexpectedArguments.length > 0
    ) {
        return fail(io, { kind: "usage", usageLines }, exitCodes.usage);
    }

    try {
        const fileContent = await readJsonFile(filePath, io);
        const result = await commands[commandName as keyof typeof commands](fileContent);
        io.writeResult(`${JSON.stringify(result, null, 2)}\n`);
        return exitCodes.success;
    } catch (error) {
        const failure = failureOf(error);
        if (failure === undefined) {
            throw error;
        }
        return fail(io, failure, exitCodes.fileRejected);
    }
}

async function readJsonFile(filePath: string, io: RocalcIo): Promise<unknown> {
    let fileText: string;
    try {
        fileText = await io.readTextFile(filePath);
    } catch {
        throw new RocalcFailureError({ kind: "fileNotReadable", filePath });
    }
    try {
        return JSON.parse(fileText);
    } catch {
        throw new RocalcFailureError({ kind: "notJson", filePath });
    }
}

function failureOf(error: unknown): RocalcFailure | undefined {
    if (error instanceof RocalcFailureError) {
        return error.failure;
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

function fail(io: RocalcIo, failure: RocalcFailure, exitCode: number): number {
    io.writeFailure(`${JSON.stringify({ error: failure }, null, 2)}\n`);
    return exitCode;
}
