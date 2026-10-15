import { Value } from "typebox/value";
import { collectSchemaIssues, type SchemaIssue } from "../schema-issues.ts";
import type { TSchema } from "typebox";
import { changeSchemaOfKind, type Tree, TreeSchema, TreeSchemaWithUncheckedChanges } from "./tree-format.ts";

/** One reason a candidate is not a tree. */
export type TreeIssue =
    | ChangeIssue
    | NodeStructureIssue;

export type ChangeIssue = SchemaIssue | { readonly kind: "unknownChangeKind"; readonly path: string };

/** A flaw in how nodes hang together, which a schema cannot express. */
export type NodeStructureIssue =
    | { readonly kind: "duplicateNodeId"; readonly nodeId: string }
    | { readonly kind: "unknownParent"; readonly nodeId: string; readonly parentId: string }
    | { readonly kind: "parentCycle"; readonly nodeId: string };

export class InvalidTreeError extends Error {
    readonly issues: readonly TreeIssue[];

    constructor(issues: readonly TreeIssue[]) {
        super(`Not a valid tree: ${issues.map((issue) => issue.kind).join(", ")}`);
        this.name = "InvalidTreeError";
        this.issues = issues;
    }
}

/**
 * @throws {InvalidTreeError} listing every place the candidate breaks the tree
 * schema, and every node whose parent is missing, duplicated or circular.
 */
export function parseTree(candidate: unknown): Tree {
    if (!Value.Check(TreeSchema, candidate)) {
        throw new InvalidTreeError(collectTreeSchemaIssues(candidate));
    }
    const structureIssues = collectNodeStructureIssues(candidate.nodes);
    if (structureIssues.length > 0) {
        throw new InvalidTreeError(structureIssues);
    }
    return candidate;
}

function collectTreeSchemaIssues(candidate: unknown): TreeIssue[] {
    const nodes: unknown = typeof candidate === "object" && candidate !== null ? Reflect.get(candidate, "nodes") : [];
    return [
        ...collectSchemaIssues(TreeSchemaWithUncheckedChanges, candidate),
        ...collectChangeIssues(nodes, "/nodes", changeSchemaOfKind),
    ];
}

/**
 * Checks every change of a node list against the schema of the kind it names,
 * so a wrong change gives one precise issue instead of one per change kind.
 */
export function collectChangeIssues(
    nodes: unknown,
    nodesPath: string,
    schemaOfChangeKind: Readonly<Record<string, TSchema>>,
): ChangeIssue[] {
    if (!Array.isArray(nodes)) {
        return [];
    }
    return nodes.flatMap((node: unknown, nodeIndex): ChangeIssue[] => {
        const changes: unknown = typeof node === "object" && node !== null ? Reflect.get(node, "changes") : [];
        if (!Array.isArray(changes)) {
            return [];
        }
        return changes.flatMap((change: unknown, changeIndex): ChangeIssue[] => {
            const path = `${nodesPath}/${nodeIndex}/changes/${changeIndex}`;
            const changeKind = typeof change === "object" && change !== null ? Reflect.get(change, "kind") : undefined;
            const changeSchema = typeof changeKind === "string" && Object.hasOwn(schemaOfChangeKind, changeKind) ? schemaOfChangeKind[changeKind] : undefined;
            return changeSchema === undefined ? [{ kind: "unknownChangeKind" as const, path }] : collectSchemaIssues(changeSchema, change, path);
        });
    });
}

export function collectNodeStructureIssues(
    nodes: readonly { readonly id: string; readonly parentId: string | null }[],
): NodeStructureIssue[] {
    const issues: NodeStructureIssue[] = [];
    const parentIdOfNode = new Map<string, string | null>();
    for (const node of nodes) {
        if (parentIdOfNode.has(node.id)) {
            issues.push({ kind: "duplicateNodeId", nodeId: node.id });
        }
        parentIdOfNode.set(node.id, node.parentId);
    }
    for (const node of nodes) {
        if (node.parentId !== null && !parentIdOfNode.has(node.parentId)) {
            issues.push({ kind: "unknownParent", nodeId: node.id, parentId: node.parentId });
        }
    }
    for (const nodeId of parentIdOfNode.keys()) {
        if (leadsBackToItself(nodeId, parentIdOfNode)) {
            issues.push({ kind: "parentCycle", nodeId });
        }
    }
    return issues;
}

function leadsBackToItself(startNodeId: string, parentIdOfNode: ReadonlyMap<string, string | null>): boolean {
    const visitedNodeIds = new Set<string>();
    let currentNodeId = parentIdOfNode.get(startNodeId) ?? null;
    while (currentNodeId !== null && !visitedNodeIds.has(currentNodeId)) {
        if (currentNodeId === startNodeId) {
            return true;
        }
        visitedNodeIds.add(currentNodeId);
        currentNodeId = parentIdOfNode.get(currentNodeId) ?? null;
    }
    return false;
}
