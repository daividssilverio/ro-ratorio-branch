import type { TSchema } from "typebox";
import { Value } from "typebox/value";

/**
 * One place where a candidate breaks a schema. `path` is a JSON Pointer into
 * the candidate; `rule` is the JSON Schema keyword that failed.
 */
export interface SchemaIssue {
    readonly path: string;
    readonly kind: "missing" | "unexpected" | "invalid";
    readonly rule: string;
}

/** Every place where the candidate breaks the schema, with paths under `pathPrefix`. */
export function collectSchemaIssues(schema: TSchema, candidate: unknown, pathPrefix = ""): SchemaIssue[] {
    const issues: SchemaIssue[] = [];
    for (const { keyword, instancePath, params } of Value.Errors(schema, candidate)) {
        const path = `${pathPrefix}${instancePath}`;
        if (keyword === "required") {
            for (const propertyName of propertyNamesIn(params, "requiredProperties")) {
                issues.push({ path: `${path}/${propertyName}`, kind: "missing", rule: keyword });
            }
        } else if (keyword === "additionalProperties") {
            for (const propertyName of propertyNamesIn(params, "additionalProperties")) {
                issues.push({ path: `${path}/${propertyName}`, kind: "unexpected", rule: keyword });
            }
        } else if (keyword !== "boolean") {
            // "boolean" repeats each unexpected property that "additionalProperties" already names.
            issues.push({ path, kind: "invalid", rule: keyword });
        }
    }
    return issues;
}

function propertyNamesIn(errorParameters: unknown, parameterName: string): string[] {
    if (typeof errorParameters !== "object" || errorParameters === null) {
        return [];
    }
    const propertyNames: unknown = Reflect.get(errorParameters, parameterName);
    return Array.isArray(propertyNames) ? propertyNames.filter((name) => typeof name === "string") : [];
}
