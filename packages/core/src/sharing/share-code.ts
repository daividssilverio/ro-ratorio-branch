import type { Build } from "../build/build-format.ts";
import { parseBuild } from "../build/parse-build.ts";
import { canonicalJson } from "../calculation/remember-outcomes.ts";
import { parseTree } from "../tree/parse-tree.ts";
import type { Tree } from "../tree/tree-format.ts";

/** A build or a tree, as a share code carries it. */
export type SharedContent = { readonly kind: "build"; readonly build: Build } | { readonly kind: "tree"; readonly tree: Tree };

export type ShareCodeFlaw = "unknownPrefix" | "notBase64Url" | "notCompressedData" | "notJson" | "neitherBuildNorTree";

export class InvalidShareCodeError extends Error {
    readonly flaw: ShareCodeFlaw;

    constructor(flaw: ShareCodeFlaw) {
        super(`Not a share code: ${flaw}`);
        this.name = "InvalidShareCodeError";
        this.flaw = flaw;
    }
}

/** Names the encoding, so a later one can be told apart: version 1 is raw deflate of JSON, in base64url. */
const shareCodePrefix = "B1.";
const compressionFormat = "deflate-raw";

/** A compact text for a build or a tree that is safe in a URL fragment. */
export async function encodeShareCode(content: Build | Tree): Promise<string> {
    const compressed = await throughStream(new TextEncoder().encode(canonicalJson(content)), new CompressionStream(compressionFormat));
    return shareCodePrefix + base64UrlOf(compressed);
}

/**
 * @throws {InvalidShareCodeError} when the text is not a share code.
 * @throws {InvalidBuildError | InvalidTreeError} when it is one, but what it carries breaks the format.
 */
export async function decodeShareCode(shareCode: string): Promise<SharedContent> {
    const trimmedShareCode = shareCode.trim();
    if (!trimmedShareCode.startsWith(shareCodePrefix)) {
        throw new InvalidShareCodeError("unknownPrefix");
    }
    const compressed = bytesOfBase64Url(trimmedShareCode.slice(shareCodePrefix.length));

    let jsonText: string;
    try {
        jsonText = new TextDecoder("utf-8", { fatal: true }).decode(
            await throughStream(compressed, new DecompressionStream(compressionFormat)),
        );
    } catch {
        throw new InvalidShareCodeError("notCompressedData");
    }

    let content: unknown;
    try {
        content = JSON.parse(jsonText);
    } catch {
        throw new InvalidShareCodeError("notJson");
    }
    if (typeof content === "object" && content !== null && "root" in content) {
        return { kind: "tree", tree: parseTree(content) };
    }
    if (typeof content === "object" && content !== null && "character" in content) {
        return { kind: "build", build: parseBuild(content) };
    }
    throw new InvalidShareCodeError("neitherBuildNorTree");
}

async function throughStream(
    bytes: Uint8Array<ArrayBuffer>,
    transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
    const writer = transform.writable.getWriter();
    // Not awaited here: a failed write surfaces through the readable side below.
    void writer.write(bytes).catch(() => undefined);
    void writer.close().catch(() => undefined);
    return new Uint8Array(await new Response(transform.readable).arrayBuffer());
}

function base64UrlOf(bytes: Uint8Array<ArrayBuffer>): string {
    let binaryText = "";
    for (const byte of bytes) {
        binaryText += String.fromCharCode(byte);
    }
    return btoa(binaryText).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function bytesOfBase64Url(base64UrlText: string): Uint8Array<ArrayBuffer> {
    if (!/^[A-Za-z0-9_-]*$/.test(base64UrlText)) {
        throw new InvalidShareCodeError("notBase64Url");
    }
    let binaryText: string;
    try {
        binaryText = atob(base64UrlText.replaceAll("-", "+").replaceAll("_", "/"));
    } catch {
        throw new InvalidShareCodeError("notBase64Url");
    }
    return Uint8Array.from(binaryText, (character) => character.charCodeAt(0));
}
