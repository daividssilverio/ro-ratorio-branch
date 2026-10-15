import {
    addCharacterToWorkspace,
    addEmptyTreeToWorkspace,
    addTreeToWorkspace,
    type Character,
    changesBetween,
    characterOf,
    decodeShareCode,
    firstUnusedId,
    type InexpressibleDifference,
    InvalidBuildError,
    InvalidShareCodeError,
    InvalidTreeError,
    InvalidWorkspaceError,
    type NotImportedPart,
    parseBuild,
    parseTree,
    parseWorkspace,
    type Scenario,
    type ShareCodeFlaw,
    type Tree,
    type UnreadableSaveFlaw,
    type Workspace,
} from "@ro-ratorio-branch/core/platform-neutral";
import type { SaveReadOutcome } from "../engine-host/host-protocol.ts";

export type ImportSource = "shareCode" | "json" | "ratorioSave";

/** Something pasted or dropped that the app can take in. */
export type RecognizedImport =
    | { readonly kind: "tree"; readonly source: ImportSource; readonly tree: Tree }
    | {
          readonly kind: "character";
          readonly source: ImportSource;
          readonly character: Character;
          /** `null` when the source names no attack or target. */
          readonly scenario: Scenario | null;
          /** What a ratorio save held that could not be carried over. Empty for the other sources. */
          readonly notImported: readonly NotImportedPart[];
      }
    | { readonly kind: "workspace"; readonly source: "json"; readonly workspace: Workspace };

export type ImportRefusal =
    | { readonly kind: "empty" }
    | { readonly kind: "notRecognized" }
    | { readonly kind: "invalidShareCode"; readonly flaw: ShareCodeFlaw }
    | { readonly kind: "unreadableSave"; readonly flaw: UnreadableSaveFlaw }
    | { readonly kind: "invalidContent"; readonly what: "build" | "tree" | "workspace"; readonly issueCount: number };

export type ImportRecognition = { readonly recognized: RecognizedImport } | { readonly refused: ImportRefusal };

const shareCodeStart = /^B\d+\./;

/** Works out what a pasted or dropped text is: a share code, a JSON file of ours, or a ratorio save. */
export async function recognizeImport(text: string, readSave: (saveUrlOrData: string) => Promise<SaveReadOutcome>): Promise<ImportRecognition> {
    const trimmedText = text.trim();
    if (trimmedText === "") {
        return { refused: { kind: "empty" } };
    }
    try {
        if (shareCodeStart.test(trimmedText)) {
            const shared = await decodeShareCode(trimmedText);
            return {
                recognized:
                    shared.kind === "tree"
                        ? { kind: "tree", source: "shareCode", tree: shared.tree }
                        : { kind: "character", source: "shareCode", character: shared.build.character, scenario: shared.build.scenario, notImported: [] },
            };
        }
        if (trimmedText.startsWith("{")) {
            return recognizeJson(trimmedText);
        }
    } catch (error) {
        return { refused: refusalOf(error) };
    }

    const saveRead = await readSave(trimmedText);
    if (saveRead.state === "unreadable") {
        return { refused: saveRead.flaw === "notSaveData" ? { kind: "notRecognized" } : { kind: "unreadableSave", flaw: saveRead.flaw } };
    }
    const { character, scenario, notImported } = saveRead.saveImport;
    return { recognized: { kind: "character", source: "ratorioSave", character, scenario, notImported } };
}

function recognizeJson(jsonText: string): ImportRecognition {
    let content: unknown;
    try {
        content = JSON.parse(jsonText);
    } catch {
        return { refused: { kind: "notRecognized" } };
    }
    const has = (fieldName: string) => typeof content === "object" && content !== null && fieldName in content;
    if (has("gearPieces")) {
        return { recognized: { kind: "workspace", source: "json", workspace: parseWorkspace(content) } };
    }
    if (has("root")) {
        return { recognized: { kind: "tree", source: "json", tree: parseTree(content) } };
    }
    if (has("character")) {
        const build = parseBuild(content);
        return { recognized: { kind: "character", source: "json", character: build.character, scenario: build.scenario, notImported: [] } };
    }
    return { refused: { kind: "notRecognized" } };
}

function refusalOf(error: unknown): ImportRefusal {
    if (error instanceof InvalidShareCodeError) {
        return { kind: "invalidShareCode", flaw: error.flaw };
    }
    if (error instanceof InvalidBuildError) {
        return { kind: "invalidContent", what: "build", issueCount: error.issues.length };
    }
    if (error instanceof InvalidTreeError) {
        return { kind: "invalidContent", what: "tree", issueCount: error.issues.length };
    }
    if (error instanceof InvalidWorkspaceError) {
        return { kind: "invalidContent", what: "workspace", issueCount: error.issues.length };
    }
    throw error;
}

/** How to take a recognized import into the workspace. */
export type ImportMode = "addAsNew" | "addAsBranch" | "replaceEverything";

/** The modes that make sense for what was recognized. A whole workspace can only replace; nothing else can. */
export function importModesFor(recognized: RecognizedImport): ImportMode[] {
    return recognized.kind === "workspace" ? ["replaceEverything"] : ["addAsNew", "addAsBranch"];
}

export interface AppliedImport {
    readonly workspace: Workspace;
    /** The tree to show afterwards. */
    readonly activeTreeId: string;
    /** Differences a branch could not express. Empty for the other modes. */
    readonly inexpressible: readonly InexpressibleDifference[];
}

/** Takes a recognized import into the workspace in the chosen mode, and says which tree to show. */
export function applyImport(workspace: Workspace, activeTreeId: string, recognized: RecognizedImport, mode: ImportMode, name: string): AppliedImport {
    if (recognized.kind === "workspace") {
        return { workspace: recognized.workspace, activeTreeId: Object.keys(recognized.workspace.trees)[0] ?? activeTreeId, inexpressible: [] };
    }
    const importedCharacter = recognized.kind === "tree" ? recognized.tree.root : recognized.character;

    if (mode === "addAsBranch") {
        const activeTree = workspace.trees[activeTreeId];
        if (activeTree !== undefined) {
            const { changes, inexpressible } = changesBetween(characterOf(workspace, activeTree.characterId), importedCharacter);
            const nodeId = firstUnusedId(Object.fromEntries(activeTree.nodes.map((node) => [node.id, node])), "imported");
            const nodes = [...activeTree.nodes, { id: nodeId, parentId: null, label: name, changes: [...changes] }];
            return {
                workspace: { ...workspace, trees: { ...workspace.trees, [activeTreeId]: { ...activeTree, nodes } } },
                activeTreeId,
                inexpressible,
            };
        }
    }

    if (recognized.kind === "tree") {
        const added = addTreeToWorkspace(workspace, recognized.tree, name);
        return { workspace: added.workspace, activeTreeId: added.treeId, inexpressible: [] };
    }
    const addedCharacter = addCharacterToWorkspace(workspace, recognized.character, name);
    if (recognized.scenario === null) {
        return { workspace: addedCharacter.workspace, activeTreeId, inexpressible: [] };
    }
    const addedTree = addEmptyTreeToWorkspace(addedCharacter.workspace, addedCharacter.characterId, recognized.scenario, name);
    return { workspace: addedTree.workspace, activeTreeId: addedTree.treeId, inexpressible: [] };
}
