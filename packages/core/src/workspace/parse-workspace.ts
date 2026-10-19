import { Value } from "typebox/value";
import { withEarlierUpstreamContentUpdated } from "../build/earlier-upstream-content.ts";
import { collectSchemaIssues } from "../schema-issues.ts";
import { type ChangeIssue, collectChangeIssues, collectNodeStructureIssues, type NodeStructureIssue } from "../tree/parse-tree.ts";
import { type Workspace, workspaceChangeSchemaOfKind, WorkspaceSchema, WorkspaceSchemaWithUncheckedChanges } from "./workspace-format.ts";

/** One reason a candidate is not a workspace. */
export type WorkspaceIssue =
    | ChangeIssue
    | (NodeStructureIssue & { readonly treeId: string })
    | { readonly kind: "unknownGearPiece"; readonly gearPieceId: string; readonly path: string }
    | { readonly kind: "unknownCharacter"; readonly characterId: string; readonly treeId: string };

export class InvalidWorkspaceError extends Error {
    readonly issues: readonly WorkspaceIssue[];

    constructor(issues: readonly WorkspaceIssue[]) {
        super(`Not a valid workspace: ${issues.map((issue) => issue.kind).join(", ")}`);
        this.name = "InvalidWorkspaceError";
        this.issues = issues;
    }
}

/**
 * @throws {InvalidWorkspaceError} listing every place the candidate breaks the
 * workspace schema, every reference to a piece or character that is not there,
 * and every tree whose nodes do not hang together.
 */
export function parseWorkspace(content: unknown): Workspace {
    const candidate = withEarlierUpstreamContentUpdated(content);
    if (!Value.Check(WorkspaceSchema, candidate)) {
        throw new InvalidWorkspaceError(collectWorkspaceSchemaIssues(candidate));
    }
    const workspace: Workspace = candidate;
    const referenceIssues = collectReferenceIssues(workspace);
    if (referenceIssues.length > 0) {
        throw new InvalidWorkspaceError(referenceIssues);
    }
    return workspace;
}

function collectWorkspaceSchemaIssues(candidate: unknown): WorkspaceIssue[] {
    const issues: WorkspaceIssue[] = collectSchemaIssues(WorkspaceSchemaWithUncheckedChanges, candidate);
    const trees: unknown = typeof candidate === "object" && candidate !== null ? Reflect.get(candidate, "trees") : undefined;
    if (typeof trees === "object" && trees !== null) {
        for (const [treeId, tree] of Object.entries(trees)) {
            const nodes: unknown = typeof tree === "object" && tree !== null ? Reflect.get(tree, "nodes") : undefined;
            issues.push(...collectChangeIssues(nodes, `/trees/${treeId}/nodes`, workspaceChangeSchemaOfKind));
        }
    }
    return issues;
}

function collectReferenceIssues(workspace: Workspace): WorkspaceIssue[] {
    const issues: WorkspaceIssue[] = [];
    const isKnownPiece = (gearPieceId: string) => Object.hasOwn(workspace.gearPieces, gearPieceId);

    for (const [characterId, character] of Object.entries(workspace.characters)) {
        for (const [slot, gearPieceId] of Object.entries(character.equipment)) {
            if (!isKnownPiece(gearPieceId)) {
                issues.push({ kind: "unknownGearPiece", gearPieceId, path: `/characters/${characterId}/equipment/${slot}` });
            }
        }
    }
    for (const [loadoutId, loadout] of Object.entries(workspace.gearLoadouts ?? {})) {
        for (const [slot, gearPieceId] of Object.entries(loadout.equipment)) {
            if (!isKnownPiece(gearPieceId)) {
                issues.push({ kind: "unknownGearPiece", gearPieceId, path: `/gearLoadouts/${loadoutId}/equipment/${slot}` });
            }
        }
    }
    for (const [treeId, tree] of Object.entries(workspace.trees)) {
        if (!Object.hasOwn(workspace.characters, tree.characterId)) {
            issues.push({ kind: "unknownCharacter", characterId: tree.characterId, treeId });
        }
        issues.push(...collectNodeStructureIssues(tree.nodes).map((issue) => ({ ...issue, treeId })));
        tree.nodes.forEach((node, nodeIndex) => {
            node.changes.forEach((change, changeIndex) => {
                if (change.kind === "equipLockerPiece" && !isKnownPiece(change.gearPieceId)) {
                    issues.push({
                        kind: "unknownGearPiece",
                        gearPieceId: change.gearPieceId,
                        path: `/trees/${treeId}/nodes/${nodeIndex}/changes/${changeIndex}`,
                    });
                }
            });
        });
    }
    return issues;
}
