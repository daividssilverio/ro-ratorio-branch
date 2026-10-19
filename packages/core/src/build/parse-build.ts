import { Value } from "typebox/value";
import { collectSchemaIssues, type SchemaIssue } from "../schema-issues.ts";
import { type Build, BuildSchema } from "./build-format.ts";
import { withEarlierUpstreamContentUpdated } from "./earlier-upstream-content.ts";

/** One reason a candidate is not a build. */
export type BuildIssue = SchemaIssue;

export class InvalidBuildError extends Error {
    readonly issues: readonly BuildIssue[];

    constructor(issues: readonly BuildIssue[]) {
        super(`Not a valid build: ${issues.map((issue) => `${issue.path} (${issue.kind})`).join(", ")}`);
        this.name = "InvalidBuildError";
        this.issues = issues;
    }
}

/** @throws {InvalidBuildError} listing every place the candidate breaks the build schema. */
export function parseBuild(content: unknown): Build {
    const candidate = withEarlierUpstreamContentUpdated(content);
    if (Value.Check(BuildSchema, candidate)) {
        return candidate;
    }
    throw new InvalidBuildError(collectSchemaIssues(BuildSchema, candidate));
}
