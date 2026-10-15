import { readFileSync } from "node:fs";
import { fingerprintOf, sourceOfFunction } from "./upstream-function-source.ts";

// Development-time bookkeeping, not part of what the app or the CLI run.
// Some of what the catalog answers is a rule the original has only inside
// the code that builds its page; the catalog holds a rewritten copy of each.
// upstream-rules.json names, for every such rule, the upstream functions it
// was rewritten from and a fingerprint of their source, so that a change
// upstream points at the rule to re-read.

export interface UpstreamSource {
    /** Relative to vendor/ratorio. */
    readonly file: string;
    readonly function: string;
    readonly fingerprint: string;
}

export interface RewrittenRule {
    /** The `EngineCatalog` method that holds the rule. */
    readonly catalog: string;
    readonly what: string;
    readonly upstream: readonly UpstreamSource[];
    /** Relative to the repository root: the test that pins the rule's behaviour. */
    readonly test: string;
}

export interface UpstreamRuleManifest {
    readonly rules: readonly RewrittenRule[];
    /** `EngineCatalog` methods that only read tables or call functions upstream exports, with what they read. */
    readonly dataReaders: Readonly<Record<string, string>>;
}

const repositoryRoot = new URL("../../../../../", import.meta.url);
export const manifestUrl = new URL("./upstream-rules.json", import.meta.url);
export const documentUrl = new URL("docs/upstream-ui-logic.md", repositoryRoot);

export const readManifest = (): UpstreamRuleManifest => JSON.parse(readFileSync(manifestUrl, "utf8")) as UpstreamRuleManifest;
export const serializeManifest = (manifest: UpstreamRuleManifest): string => `${JSON.stringify(manifest, null, 4)}\n`;
export const existsInRepository = (path: string): string | undefined => {
    try {
        return readFileSync(new URL(path, repositoryRoot), "utf8");
    } catch {
        return undefined;
    }
};

/** The fingerprint the pinned upstream gives a source today. `undefined` when the file or the function is gone. */
export function currentFingerprintOf(source: Pick<UpstreamSource, "file" | "function">): string | undefined {
    const fileText = existsInRepository(`vendor/ratorio/${source.file}`);
    const functionSource = fileText === undefined ? undefined : sourceOfFunction(fileText, source.function);
    return functionSource === undefined ? undefined : fingerprintOf(functionSource);
}

/** The manifest with every fingerprint taken again from the pinned upstream: what accepting upstream's changes writes. */
export function withCurrentFingerprints(manifest: UpstreamRuleManifest): UpstreamRuleManifest {
    return {
        ...manifest,
        rules: manifest.rules.map((rule) => ({
            ...rule,
            upstream: rule.upstream.map((source) => ({ ...source, fingerprint: currentFingerprintOf(source) ?? "missing" })),
        })),
    };
}

const tableStart = "<!-- rewritten-rules:start (generated from upstream-rules.json; do not edit by hand) -->";
const tableEnd = "<!-- rewritten-rules:end -->";

/** The table of rewritten rules as the document shows it. */
export function documentTableOf(manifest: UpstreamRuleManifest): string {
    const upstreamCell = (rule: RewrittenRule) => rule.upstream.map((source) => `\`${source.file}\`, \`${source.function}()\``).join("<br>");
    const rows = manifest.rules.map((rule) => `| ${rule.what} | ${upstreamCell(rule)} | \`catalog.${rule.catalog}()\` | \`${rule.test.split("/").at(-1)}\` |`);
    return [tableStart, "| What | In the original | In ours | Pinned by |", "| --- | --- | --- | --- |", ...rows, tableEnd].join("\n");
}

/** The document with its table of rewritten rules replaced. `undefined` when it has no place marked for one. */
export function withDocumentTable(documentText: string, table: string): string | undefined {
    const start = documentText.indexOf(tableStart);
    const end = documentText.indexOf(tableEnd);
    return start < 0 || end < 0 ? undefined : documentText.slice(0, start) + table + documentText.slice(end + tableEnd.length);
}
