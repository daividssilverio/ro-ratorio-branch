import {
    addTreeToWorkspace,
    type BuildCalculator,
    commitNodeToLocker,
    createCalculatorPool,
    describeEvaluation,
    evaluateTree,
    foldNodeIntoParent,
    InvalidTreeError,
    type LockerCommit,
    makeNodeTheRoot,
    parseTree,
    rememberOutcomes,
    removeTreeNode,
    type Tree,
    type TreeComparison,
    type TreeEvaluation,
    type TreeIssue,
    treeOf,
    type Workspace,
    type WorkspaceTreeNode,
} from "@ro-ratorio-branch/core/platform-neutral";
import exampleTreeFileContent from "@ro-ratorio-branch/core/example-trees/novice-start.tree.json" with { type: "json" };
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type EngineHost, startFrameEngineHost } from "../engine-host/frame-engine-host.ts";
import { type Descriptions, noDescriptions } from "../engine-host/host-protocol.ts";
import { afterChange, redone, startHistory, undone, type UndoHistory, withCurrent } from "./undo-history.ts";
import { indexedDbWorkspaceStore, loadLastOpenTreeId, openWorkspace, storeLastOpenTreeId, type WorkspaceStore } from "../storage/workspace-store.ts";
import { idsShownIn } from "./tree-view-model.ts";

/** Where the version of the app before the workspace kept its one tree. */
const earlierVersionTreeStorageKey = "ro-ratorio-branch.tree.v1";

export type TreeImportFailure =
    | { readonly kind: "notJson" }
    | { readonly kind: "invalidTree"; readonly issues: readonly TreeIssue[] };

export interface TreeWorkspace {
    /** Everything the app stores. The other fields describe its open tree. */
    readonly workspace: Workspace;
    readonly activeTreeId: string;
    /** The open tree, with its locker pieces written out. */
    readonly tree: Tree;
    /** `null` until the first calculation of the open tree has finished. */
    readonly evaluation: TreeEvaluation | null;
    readonly comparison: TreeComparison | null;
    readonly descriptions: Descriptions;
    readonly isCalculating: boolean;
    readonly progress: { readonly finished: number; readonly requested: number };
    /** Set when the engine could not be started or a calculation was lost. */
    readonly engineFailure: string | null;
    /** Replaces the workspace and stores it. */
    updateWorkspace(workspace: Workspace): void;
    /** Whether a change of this visit can be taken back, and whether one that was taken back can be made again. */
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /** Takes the last change back: an edit, a node added, removed, folded or committed, an import. */
    undo(): void;
    redo(): void;
    /** Replaces the workspace, stores it and opens one of its trees. For changes that add or swap trees. */
    takeWorkspace(workspace: Workspace, activeTreeId: string): void;
    openTree(treeId: string): void;
    setStepCost(nodeId: string, zenyCost: number | undefined): void;
    toggleFavorite(nodeId: string): void;
    renameNode(nodeId: string, label: string): void;
    /** Removes the node and every node that builds on it. */
    removeNode(nodeId: string): void;
    /**
     * Moves the node's changes into what it builds on and removes it; the root takes them as its gear and stats.
     * Returns what took them (`null` for the root), or `undefined` when the node could not be folded.
     */
    foldNode(nodeId: string): string | null | undefined;
    /** Makes the node's build the root's and removes the node and what it built on. No locker piece is changed. Returns whether it was done. */
    makeNodeTheRoot(nodeId: string): boolean;
    /** Makes the node's gear state the baseline by writing it into the locker. Returns what was written and what was not. */
    applyNodeToLocker(nodeId: string): LockerCommit;
    /** Adds the content of a tree file as a new tree and opens it. Returns why it was refused, if it was. */
    importTreeFile(fileText: string, treeName: string): TreeImportFailure | null;
}

let startingEngineHost: Promise<EngineHost> | undefined;
let sharedCalculator: BuildCalculator | undefined;

export function engineHost(): Promise<EngineHost> {
    startingEngineHost ??= startFrameEngineHost(`${import.meta.env.BASE_URL}engine-host.html`);
    return startingEngineHost;
}

/** The calculator every screen shares: one calculation at a time, and an answer it gave before is not worked out again. */
export async function sharedBuildCalculator(): Promise<BuildCalculator> {
    const host = await engineHost();
    sharedCalculator ??= rememberOutcomes(createCalculatorPool([host.calculate]));
    return sharedCalculator;
}

function earlierVersionTreeText(): string | null {
    try {
        return window.localStorage.getItem(earlierVersionTreeStorageKey);
    } catch {
        return null;
    }
}

interface OpenState {
    readonly workspace: Workspace;
    readonly activeTreeId: string;
}

/** `null` while the stored workspace is being read. */
export function useTreeWorkspace(store: WorkspaceStore = sharedStore()): TreeWorkspace | null {
    const [history, setHistory] = useState<UndoHistory<OpenState> | null>(null);
    const openState = history?.current ?? null;
    const [evaluation, setEvaluation] = useState<TreeEvaluation | null>(null);
    const [descriptions, setDescriptions] = useState<Descriptions>(noDescriptions);
    const [progress, setProgress] = useState({ finished: 0, requested: 0 });
    const [isCalculating, setIsCalculating] = useState(true);
    const [engineFailure, setEngineFailure] = useState<string | null>(null);
    const latestRun = useRef(0);

    useEffect(() => {
        void openWorkspace(store, earlierVersionTreeText(), parseTree(exampleTreeFileContent), loadLastOpenTreeId()).then((opened) => {
            setHistory(startHistory({ workspace: opened.workspace, activeTreeId: opened.activeTreeId }));
            if (opened.origin !== "stored") {
                void store.save(opened.workspace);
            }
        });
    }, [store]);

    const tree = useMemo(() => (openState === null ? null : treeOf(openState.workspace, openState.activeTreeId)), [openState]);
    const openTreeId = openState?.activeTreeId ?? null;

    useEffect(() => {
        if (openTreeId !== null) {
            storeLastOpenTreeId(openTreeId);
        }
    }, [openTreeId]);

    useEffect(() => {
        if (tree === null) {
            return;
        }
        const run = ++latestRun.current;
        const isLatestRun = () => run === latestRun.current;
        setIsCalculating(true);
        setProgress({ finished: 0, requested: 0 });

        void (async () => {
            try {
                const calculate = await sharedBuildCalculator();
                const countingCalculator: BuildCalculator = async (build) => {
                    if (isLatestRun()) {
                        setProgress((current) => ({ ...current, requested: current.requested + 1 }));
                    }
                    try {
                        return await calculate(build);
                    } finally {
                        if (isLatestRun()) {
                            setProgress((current) => ({ ...current, finished: current.finished + 1 }));
                        }
                    }
                };
                const [treeEvaluation, treeDescriptions] = await Promise.all([
                    evaluateTree(tree, countingCalculator),
                    (await engineHost()).describe(idsShownIn(tree)),
                ]);
                if (isLatestRun()) {
                    setEvaluation(treeEvaluation);
                    setDescriptions(treeDescriptions);
                    setEngineFailure(null);
                }
            } catch (error) {
                if (isLatestRun()) {
                    setEngineFailure(error instanceof Error ? error.message : String(error));
                }
            } finally {
                if (isLatestRun()) {
                    setIsCalculating(false);
                }
            }
        })();
    }, [tree]);

    const updateWorkspace = useCallback(
        (workspace: Workspace, activeTreeId?: string) => {
            setHistory((known) => (known === null ? known : afterChange(known, { workspace, activeTreeId: activeTreeId ?? known.current.activeTreeId })));
            void store.save(workspace);
        },
        [store],
    );

    if (history === null || openState === null || tree === null) {
        return null;
    }
    const { workspace, activeTreeId } = openState;

    /** Goes to a state the history already holds, and stores it: undoing has to survive a reload like any change. */
    function goTo(steppedHistory: UndoHistory<OpenState>) {
        if (steppedHistory === history) {
            return;
        }
        if (steppedHistory.current.activeTreeId !== activeTreeId) {
            setEvaluation(null);
        }
        setHistory(steppedHistory);
        void store.save(steppedHistory.current.workspace);
    }

    function changeNode(nodeId: string, change: (node: WorkspaceTreeNode) => WorkspaceTreeNode) {
        const activeTree = workspace.trees[activeTreeId];
        if (activeTree === undefined) {
            return;
        }
        const nodes = activeTree.nodes.map((node) => (node.id === nodeId ? change(node) : node));
        updateWorkspace({ ...workspace, trees: { ...workspace.trees, [activeTreeId]: { ...activeTree, nodes } } });
    }

    return {
        workspace,
        activeTreeId,
        tree,
        evaluation,
        comparison: evaluation === null ? null : describeEvaluation(tree, evaluation),
        descriptions,
        isCalculating,
        progress,
        engineFailure,
        updateWorkspace,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        undo: () => goTo(undone(history)),
        redo: () => goTo(redone(history)),
        takeWorkspace(nextWorkspace, nextActiveTreeId) {
            setEvaluation(null);
            updateWorkspace(nextWorkspace, nextActiveTreeId);
        },
        openTree(treeId) {
            if (Object.hasOwn(workspace.trees, treeId) && treeId !== activeTreeId) {
                setEvaluation(null);
                // Looking at another tree is not a change to take back.
                setHistory((known) => (known === null ? known : withCurrent(known, { workspace, activeTreeId: treeId })));
            }
        },
        setStepCost: (nodeId, zenyCost) =>
            changeNode(nodeId, (node) => {
                const { zenyCost: _previousCost, ...nodeWithoutCost } = node;
                return zenyCost === undefined ? nodeWithoutCost : { ...nodeWithoutCost, zenyCost };
            }),
        toggleFavorite: (nodeId) =>
            changeNode(nodeId, (node) => {
                const { favorite: wasFavorite, ...nodeWithoutFavorite } = node;
                return wasFavorite === true ? nodeWithoutFavorite : { ...nodeWithoutFavorite, favorite: true };
            }),
        renameNode: (nodeId, label) => changeNode(nodeId, (node) => ({ ...node, label })),
        removeNode: (nodeId) => updateWorkspace(removeTreeNode(workspace, activeTreeId, nodeId)),
        foldNode(nodeId) {
            const folded = foldNodeIntoParent(workspace, activeTreeId, nodeId);
            if (folded.state !== "folded") {
                return undefined;
            }
            updateWorkspace(folded.workspace);
            return folded.parentNodeId;
        },
        makeNodeTheRoot(nodeId) {
            const rooted = makeNodeTheRoot(workspace, activeTreeId, nodeId);
            if (rooted.state === "folded") {
                updateWorkspace(rooted.workspace);
            }
            return rooted.state === "folded";
        },
        applyNodeToLocker(nodeId) {
            const commit = commitNodeToLocker(workspace, activeTreeId, nodeId);
            if (commit.committedChanges.length > 0) {
                updateWorkspace(commit.workspace);
            }
            return commit;
        },
        importTreeFile(fileText, treeName) {
            let fileContent: unknown;
            try {
                fileContent = JSON.parse(fileText);
            } catch {
                return { kind: "notJson" };
            }
            try {
                const added = addTreeToWorkspace(workspace, parseTree(fileContent), treeName);
                setEvaluation(null);
                updateWorkspace(added.workspace, added.treeId);
                return null;
            } catch (error) {
                if (error instanceof InvalidTreeError) {
                    return { kind: "invalidTree", issues: error.issues };
                }
                throw error;
            }
        },
    };
}

let storeForThisPage: WorkspaceStore | undefined;

function sharedStore(): WorkspaceStore {
    storeForThisPage ??= indexedDbWorkspaceStore();
    return storeForThisPage;
}
