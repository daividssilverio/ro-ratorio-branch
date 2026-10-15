import { addEmptyTreeNode, descendantCountOf, type InexpressibleDifference } from "@ro-ratorio-branch/core/platform-neutral";
import { type ReactNode, useState } from "react";
import { BuildScreen, type EditedNode } from "./BuildScreen.tsx";
import { CompareSheet } from "./CompareSheet.tsx";
import { rootLabel } from "./labels.ts";
import { t } from "./text/ui-text.ts";
import { MiniTree } from "./MiniTree.tsx";
import { UndoButtons } from "./UndoButtons.tsx";
import { RightsFooter } from "./RightsFooter.tsx";
import { useNodeWorkspace } from "./use-node-workspace.ts";
import { LockerScreen } from "./LockerScreen.tsx";
import { RankingScreen } from "./RankingScreen.tsx";
import { shareCodeInFragment } from "./share-export-model.ts";
import { ShareScreen } from "./ShareScreen.tsx";
import { type OpenTab, TabBar } from "./TabBar.tsx";
import { TreeScreen } from "./TreeScreen.tsx";
import { useIsWide } from "./use-is-wide.ts";
import { type TreeWorkspace, useTreeWorkspace } from "./use-tree-workspace.ts";
import { WideCompareView } from "./wide/WideCompareView.tsx";
import { WideRankingView } from "./wide/WideRankingView.tsx";
import { WideShell } from "./wide/WideShell.tsx";
import { WideTreeView } from "./wide/WideTreeView.tsx";

/** The share code the page was opened with. Read once, then taken out of the address so a reload does not import again. */
function takeShareCodeFromAddress(): string {
    const shareCode = shareCodeInFragment(window.location.hash);
    if (shareCode !== null) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    return shareCode ?? "";
}

export function App() {
    const loadedWorkspace = useTreeWorkspace();
    const isWide = useIsWide();
    const [sharedCodeAtOpen] = useState(takeShareCodeFromAddress);
    const [openTab, setOpenTab] = useState<OpenTab>(sharedCodeAtOpen === "" ? "tree" : "share");
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    /** The node whose full comparison is open: a bottom sheet on a phone, its own view on a desktop. */
    const [comparedNodeId, setComparedNodeId] = useState<string | null>(null);

    function openTabAndCloseComparison(tab: OpenTab) {
        setOpenTab(tab);
        setComparedNodeId(null);
    }

    function selectAndCompare(nodeId: string) {
        setSelectedNodeId(nodeId);
        setComparedNodeId(nodeId);
    }

    if (loadedWorkspace === null) {
        return (
            <div className="app" role="status" style={{ placeContent: "center", textAlign: "center", color: "var(--fg-3)" }}>
                {t("読み込み中…")}
            </div>
        );
    }
    const workspace = loadedWorkspace;
    const selectedNode = workspace.tree.nodes.find((node) => node.id === selectedNodeId);

    /** Adds a node that changes nothing yet and opens the build editor on it: the variation is built there. */
    function addBranch(parentNodeId: string | null) {
        const added = addEmptyTreeNode(workspace.workspace, workspace.activeTreeId, parentNodeId, t("分岐 {0}", workspace.tree.nodes.length + 1));
        if (added !== undefined) {
            workspace.updateWorkspace(added.workspace);
            setSelectedNodeId(added.nodeId);
            openTabAndCloseComparison("build");
        }
    }

    // The build editor shows what is selected in the tree: the root, or a node.
    const buildScreen = (isWideScreen: boolean) => {
        const miniTree = <MiniTree workspace={workspace} selectedNodeId={selectedNode?.id ?? null} isWide={isWideScreen} onSelect={setSelectedNodeId} onAddBranch={addBranch} />;
        return <SelectedBuildScreen stored={workspace} nodeId={selectedNode?.id ?? null} isWide={isWideScreen} treeStrip={miniTree} onSelect={setSelectedNodeId} />;
    };

    const shareScreen = (
        <ShareScreen
            workspace={workspace}
            selectedNodeId={selectedNodeId}
            isWide={isWide}
            initialImportText={sharedCodeAtOpen}
            onShowTree={() => openTabAndCloseComparison("tree")}
        />
    );

    if (isWide) {
        return (
            <WideShell workspace={workspace} openTab={openTab} onOpen={openTabAndCloseComparison}>
                {openTab === "share" ? (
                    shareScreen
                ) : openTab === "build" ? (
                    buildScreen(true)
                ) : openTab === "locker" ? (
                    <LockerScreen workspace={workspace} isWide />
                ) : openTab === "ranking" ? (
                    <WideRankingView
                        workspace={workspace}
                        onShowInTree={(nodeId) => {
                            setSelectedNodeId(nodeId);
                            openTabAndCloseComparison("tree");
                        }}
                    />
                ) : comparedNodeId !== null ? (
                    <WideCompareView workspace={workspace} nodeId={comparedNodeId} onSelect={selectAndCompare} onBackToTree={() => setComparedNodeId(null)} />
                ) : (
                    <WideTreeView workspace={workspace} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} onOpenDetail={setComparedNodeId} onAddBranch={addBranch} />
                )}
            </WideShell>
        );
    }

    return (
        <div className="app">
            {openTab === "share" ? (
                shareScreen
            ) : openTab === "build" ? (
                buildScreen(false)
            ) : openTab === "locker" ? (
                <LockerScreen workspace={workspace} isWide={false} />
            ) : openTab === "tree" ? (
                <TreeScreen workspace={workspace} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} onCompare={setComparedNodeId} onAddBranch={addBranch} />
            ) : (
                <RankingScreen workspace={workspace} onCompare={selectAndCompare} />
            )}
            <UndoButtons workspace={workspace} />
            <TabBar openTab={openTab} onOpen={setOpenTab} />
            {comparedNodeId !== null && <CompareSheet workspace={workspace} nodeId={comparedNodeId} onClose={() => setComparedNodeId(null)} />}
        </div>
    );
}

interface SelectedBuildScreenProps {
    readonly stored: TreeWorkspace;
    /** `null` for the root. */
    readonly nodeId: string | null;
    readonly isWide: boolean;
    readonly treeStrip: ReactNode;
    onSelect(nodeId: string | null): void;
}

/**
 * The build editor on what is selected in the tree. On the root it works
 * on the stored workspace; on a node it shows the node's build and writes
 * changes into the node. One component for both, so that what the editor
 * and the mini tree hold (an open slot, a tap that may become a double
 * tap) survives a change of selection.
 */
function SelectedBuildScreen({ stored, nodeId, isWide, treeStrip, onSelect }: SelectedBuildScreenProps) {
    const [refusal, setRefusal] = useState<{ readonly nodeId: string | null; readonly differences: readonly InexpressibleDifference[] }>({ nodeId, differences: [] });
    const nodeWorkspace = useNodeWorkspace(stored, nodeId, (differences) => setRefusal({ nodeId, differences }));
    const refused = refusal.nodeId === nodeId ? refusal.differences : [];
    const node = stored.tree.nodes.find((candidate) => candidate.id === nodeId);
    if (nodeId === null || node === undefined) {
        return <BuildScreen workspace={stored} isWide={isWide} treeStrip={treeStrip} />;
    }
    const parentNode = stored.tree.nodes.find((candidate) => candidate.id === node.parentId);
    const parentResult = parentNode === undefined ? stored.comparison?.root : stored.comparison?.nodes.find((candidate) => candidate.id === parentNode.id);
    if (nodeWorkspace === null) {
        return <UneditableNodeScreen label={node.label} isWide={isWide} treeStrip={treeStrip} onRemove={() => stored.removeNode(nodeId)} />;
    }
    const editedNode: EditedNode = {
        label: node.label,
        parentLabel: parentNode?.label ?? rootLabel,
        parentDamagePerSecond: parentResult?.state === "ready" ? parentResult.battleSummary.averageDamagePerSecond : null,
        refused,
        descendantCount: descendantCountOf(stored.workspace, stored.activeTreeId, nodeId),
        onRename: (label) => stored.renameNode(nodeId, label),
        onRemove: () => stored.removeNode(nodeId),
        buildsOnRoot: parentNode === undefined,
        onFold() {
            const parentNodeId = stored.foldNode(nodeId);
            if (parentNodeId !== undefined) {
                onSelect(parentNodeId);
            }
        },
        onMakeRoot() {
            if (stored.makeNodeTheRoot(nodeId)) {
                onSelect(null);
            }
        },
    };
    return <BuildScreen workspace={nodeWorkspace} isWide={isWide} treeStrip={treeStrip} editedNode={editedNode} />;
}

interface UneditableNodeScreenProps {
    readonly label: string;
    readonly isWide: boolean;
    readonly treeStrip: ReactNode;
    onRemove(): void;
}

/** A node whose changes no longer fit its parent has no build to show; it can be left or removed. */
function UneditableNodeScreen({ label, isWide, treeStrip, onRemove }: UneditableNodeScreenProps) {
    const body = (
        <>
            {treeStrip}
            <section className="card build-card">
                <h2>{label}</h2>
                <p className="empty-note" style={{ padding: 0 }}>
                    {t("このノードの変更は、もとの装備に合わなくなったため表示できません。ツリーで確認するか、削除してください。")}
                </p>
                <button type="button" className="btn danger" onClick={onRemove}>
                    {t("ノードを削除")}
                </button>
            </section>
        </>
    );
    if (isWide) {
        return (
            <main className="wide-main build-main">
                <div className="build-column narrow">{body}</div>
            </main>
        );
    }
    return (
        <div className="screen">
            <header className="app-header">
                <h1 className="screen-title">{t("ビルド")}</h1>
            </header>
            <div className="scroll">
                <div className="build-stack">{body}</div>
                <RightsFooter />
            </div>
        </div>
    );
}
