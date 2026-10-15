import { callTool, type ToolContext, tools } from "./tools.ts";

/** The protocol revisions this server speaks, newest first. */
export const supportedProtocolVersions = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const serverInfo = { name: "ro-ratorio-branch", title: "ROラトリオ Branch", version: "0.0.0" } as const;

const instructions = [
    "Damage calculations for Ragnarok Online Japan, on the ROラトリオHUB engine.",
    "Builds and upgrade trees are JSON documents you hold: every tool takes the document it works on and gives back what changed.",
    "Find the ratorio IDs of items, cards, monsters and skills with the search tool before writing them into a build.",
    "© Gravity Co., Ltd. & Lee MyoungJin(studio DTDS). All rights reserved. © GungHo Online Entertainment, Inc. All Rights Reserved. Fan-made, non-commercial.",
].join(" ");

/** JSON-RPC error codes the protocol uses. */
export const errorCodes = { parseError: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602 } as const;

type RequestId = string | number;

export type Response =
    | { readonly jsonrpc: "2.0"; readonly id: RequestId; readonly result: unknown }
    | { readonly jsonrpc: "2.0"; readonly id: RequestId | null; readonly error: { readonly code: number; readonly message: string } };

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Answers one message of the Model Context Protocol. `undefined` for a
 * notification, which gets no answer. The server keeps nothing between
 * messages: a client holds its own builds and trees.
 */
export async function answerMessage(message: unknown, context: ToolContext): Promise<Response | undefined> {
    if (!isObject(message) || message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
        return { jsonrpc: "2.0", id: null, error: { code: errorCodes.invalidRequest, message: "Not a JSON-RPC 2.0 request" } };
    }
    const id = message["id"];
    if (typeof id !== "string" && typeof id !== "number") {
        return undefined;
    }
    const params = isObject(message["params"]) ? message["params"] : {};
    const failed = (code: number, text: string): Response => ({ jsonrpc: "2.0", id, error: { code, message: text } });

    switch (message["method"]) {
        case "initialize": {
            const asked = params["protocolVersion"];
            const protocolVersion = supportedProtocolVersions.find((version) => version === asked) ?? supportedProtocolVersions[0];
            return { jsonrpc: "2.0", id, result: { protocolVersion, capabilities: { tools: {} }, serverInfo, instructions } };
        }
        case "ping":
            return { jsonrpc: "2.0", id, result: {} };
        case "tools/list":
            return { jsonrpc: "2.0", id, result: { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } };
        case "tools/call": {
            const name = params["name"];
            const outcome = typeof name === "string" ? await callTool(name, isObject(params["arguments"]) ? params["arguments"] : {}, context) : undefined;
            if (outcome === undefined) {
                return failed(errorCodes.invalidParams, `Unknown tool: ${String(name)}`);
            }
            // A tool that could not do its work still answers: the reason is for the model to read and act on.
            const structuredContent = outcome.state === "done" ? outcome.result : { error: outcome.failure };
            return {
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent, isError: outcome.state === "failed" },
            };
        }
        default:
            return failed(errorCodes.methodNotFound, `Unknown method: ${message["method"]}`);
    }
}

/** Answers one line of input: a message as JSON. `undefined` when there is nothing to send back. */
export async function answerLine(line: string, context: ToolContext): Promise<string | undefined> {
    if (line.trim() === "") {
        return undefined;
    }
    let message: unknown;
    try {
        message = JSON.parse(line);
    } catch {
        return JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: errorCodes.parseError, message: "Not JSON" } } satisfies Response);
    }
    const response = await answerMessage(message, context);
    return response === undefined ? undefined : JSON.stringify(response);
}
