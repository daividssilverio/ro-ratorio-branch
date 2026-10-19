import type { Character, Scenario } from "../build/build-format.ts";
import { InvalidBuildError, parseBuild } from "../build/parse-build.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { UnreadableRatorioSaveError, type UnreadableSaveFlaw } from "../engine-adapter/ratorio-save.ts";
import { InvalidTreeError, parseTree } from "../tree/parse-tree.ts";
import type { Tree } from "../tree/tree-format.ts";
import { InvalidWorkspaceError, parseWorkspace } from "../workspace/parse-workspace.ts";
import type { Workspace } from "../workspace/workspace-format.ts";
import { importRatorioSave, type NotImportedPart, type RatorioSaveImport } from "./import-ratorio-save.ts";
import { decodeShareCode, InvalidShareCodeError, type ShareCodeFlaw } from "./share-code.ts";
import { shareCodeInFragment } from "./share-link.ts";

/** What reading a ratorio save gave: its content as a character and scenario, or why it could not be read. */
export type SaveReadOutcome =
    | { readonly state: "read"; readonly saveImport: RatorioSaveImport }
    | { readonly state: "unreadable"; readonly flaw: UnreadableSaveFlaw };

/** Reads a ratorio save URL, or the data after its question mark, with an engine: what `recognizeImport` hands a text to. */
export async function saveReadingOn(engine: RatorioEngine): Promise<(saveUrlOrData: string) => Promise<SaveReadOutcome>> {
    const readRatorioSave = await engine.loadSaveReader();
    return async (saveUrlOrData) => {
        try {
            return { state: "read", saveImport: importRatorioSave(readRatorioSave(saveUrlOrData), engine) };
        } catch (error) {
            if (error instanceof UnreadableRatorioSaveError) {
                return { state: "unreadable", flaw: error.flaw };
            }
            throw error;
        }
    };
}

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

/** Works out what a pasted or dropped text is: a share code or a link to the app with one, a JSON file of ours, or a ratorio save. */
export async function recognizeImport(text: string, readSave: (saveUrlOrData: string) => Promise<SaveReadOutcome>): Promise<ImportRecognition> {
    const trimmedText = shareCodeOfAppLink(text.trim()) ?? text.trim();
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

function shareCodeOfAppLink(text: string): string | null {
    if (!URL.canParse(text)) {
        return null;
    }
    return shareCodeInFragment(new URL(text).hash);
}
