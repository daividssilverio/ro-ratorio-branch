import { descendantCountOf } from "@ro-ratorio-branch/core/platform-neutral";
import { useState } from "react";
import { CommittedTextField } from "./CommittedFields.tsx";
import { PlusIcon } from "./Icons.tsx";
import { t } from "./text/ui-text.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";

interface NodeActionsProps {
    readonly workspace: TreeWorkspace;
    /** `null` for the root. */
    readonly selectedNodeId: string | null;
    readonly rootLabel: string;
    /** Starts trying a branch on the selected node, or on the root. */
    onAddBranch(parentNodeId: string | null): void;
    /** Called with what to select instead, after the selected node was removed or folded into its parent. */
    onSelect(nodeId: string | null): void;
}

/**
 * What can be done with the selected node of the tree, or with its root:
 * branch off it, and for a node, rename it, remove it, fold it into the
 * node it builds on, or make it the root.
 */
export function NodeActions({ workspace, selectedNodeId, rootLabel, onAddBranch, onSelect }: NodeActionsProps) {
    const node = workspace.tree.nodes.find((candidate) => candidate.id === selectedNodeId);
    const isStale = workspace.comparison?.nodes.find((comparison) => comparison.id === selectedNodeId)?.state === "stale";

    if (node === undefined) {
        return (
            <div className="node-actions" data-testid="node-actions">
                <button type="button" className="btn btn-p" onClick={() => onAddBranch(null)}>
                    <PlusIcon />
                    {t("{0} から分岐を作る", rootLabel)}
                </button>
                <span className="node-actions-hint">{t("ノードを選ぶと、そこから先の分岐も作れます。")}</span>
            </div>
        );
    }
    const descendantCount = descendantCountOf(workspace.workspace, workspace.activeTreeId, node.id);
    const parentNode = workspace.tree.nodes.find((candidate) => candidate.id === node.parentId);
    return (
        <div className="node-actions" data-testid="node-actions">
            <label className="field-label node-name">
                {t("ノード名")}
                <CommittedTextField value={node.label} ariaLabel={t("ノード名")} onCommit={(label) => label.trim() !== "" && workspace.renameNode(node.id, label.trim())} />
            </label>
            <NodeIdLine nodeId={node.id} />
            <div className="button-pair">
                <button type="button" className="btn btn-p" disabled={isStale} onClick={() => onAddBranch(node.id)}>
                    <PlusIcon />
                    {t("ここから分岐を作る")}
                </button>
                <RemoveNodeButton
                    key={node.id}
                    descendantCount={descendantCount}
                    onRemove={() => {
                        workspace.removeNode(node.id);
                        onSelect(null);
                    }}
                />
            </div>
            <NodeMergeButtons
                key={`merge-${node.id}`}
                parentNodeLabel={parentNode?.label ?? null}
                rootLabel={rootLabel}
                isStale={isStale}
                onFold={() => {
                    const parentNodeId = workspace.foldNode(node.id);
                    if (parentNodeId !== undefined) {
                        onSelect(parentNodeId);
                    }
                }}
                onMakeRoot={() => {
                    if (workspace.makeNodeTheRoot(node.id)) {
                        onSelect(null);
                    }
                }}
            />
            <button type="button" className="btn" onClick={() => onAddBranch(null)}>
                <PlusIcon />
                {t("{0} から分岐を作る", rootLabel)}
            </button>
        </div>
    );
}

/** The node's ID, which an agent working on the tree, or a share link, names it by. */
export function NodeIdLine({ nodeId }: { nodeId: string }) {
    return (
        <span className="node-id-line">
            {t("ノード ID")} <code>{nodeId}</code>
        </span>
    );
}

/** Removes a node on the second press: the first one says what would go with it. */
export function RemoveNodeButton({ descendantCount, onRemove }: { descendantCount: number; onRemove(): void }) {
    const [isAsked, setIsAsked] = useState(false);
    return isAsked ? (
        <button type="button" className="btn danger" onClick={onRemove}>
            {descendantCount === 0 ? t("削除する") : t("子ノード {0} 件ごと削除する", descendantCount)}
        </button>
    ) : (
        <button type="button" className="btn" onClick={() => setIsAsked(true)}>
            {t("ノードを削除")}
        </button>
    );
}

/** A button that acts on the second press: the first one says what it will do, since that cannot be taken back. */
export function ConfirmedAction({ label, explanation, confirmLabel, testId, isDisabled = false, onConfirm }: { label: string; explanation: string; confirmLabel: string; testId: string; isDisabled?: boolean; onConfirm(): void }) {
    const [isAsked, setIsAsked] = useState(false);
    if (!isAsked) {
        return (
            <button type="button" className="btn" data-testid={testId} disabled={isDisabled} onClick={() => setIsAsked(true)}>
                {label}
            </button>
        );
    }
    return (
        <div className="fold-confirm">
            <span className="node-actions-hint">{explanation}</span>
            <div className="button-pair">
                <button type="button" className="btn" onClick={() => setIsAsked(false)}>
                    {t("キャンセル")}
                </button>
                <button type="button" className="btn btn-p" data-testid={`${testId}-confirm`} onClick={onConfirm}>
                    {confirmLabel}
                </button>
            </div>
        </div>
    );
}

interface NodeMergeButtonsProps {
    /** The node the selected one builds on, as the tree names it; `null` when it builds on the root. */
    readonly parentNodeLabel: string | null;
    readonly rootLabel: string;
    /** A node whose changes no longer fit has no build the root could take. */
    readonly isStale: boolean;
    onFold(): void;
    onMakeRoot(): void;
}

/**
 * The two ways a node stops being a step of its own: folded into the
 * node it builds on, or made the root, with everything it built on.
 */
export function NodeMergeButtons({ parentNodeLabel, rootLabel, isStale, onFold, onMakeRoot }: NodeMergeButtonsProps) {
    return (
        <>
            {parentNodeLabel !== null && (
                <ConfirmedAction
                    label={t("{0} に統合", parentNodeLabel)}
                    explanation={t("このノードの変更が {0} に移り、1 つのノードになります。{0} のほかの子ノードも、この変更の上に乗ります。元に戻せません。", parentNodeLabel)}
                    confirmLabel={t("統合する")}
                    testId="fold-node"
                    onConfirm={onFold}
                />
            )}
            <ConfirmedAction
                label={t("コミット · {0} にする", rootLabel)}
                explanation={t("このノードの装備とステータスが {0} になります。ここまでのノードは消え、ほかのノードは新しい {0} からの差分になります。ロッカーの装備は書き換えません（ロッカーにない装備は「未所持」として加わります）。元に戻せません。", rootLabel)}
                confirmLabel={t("コミットする")}
                testId="commit-node"
                isDisabled={isStale}
                onConfirm={onMakeRoot}
            />
        </>
    );
}
