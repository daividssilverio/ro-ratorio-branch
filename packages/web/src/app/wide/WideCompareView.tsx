import { useState } from "react";
import { ApplyToLockerButton } from "../ApplyToLockerButton.tsx";
import { type Baseline, comparisonOf } from "../compare-model.ts";
import { EffectsSection, GearSection, MetricCards, PairPicker, PathSection, StatsSection } from "../CompareParts.tsx";
import { formatInteger, formatSignedPercent } from "../format.ts";
import { ChevronRightIcon } from "../Icons.tsx";
import { rootLabel } from "../labels.ts";
import { treeRowsOf } from "../tree-view-model.ts";
import type { TreeWorkspace } from "../use-tree-workspace.ts";
import { t } from "../text/ui-text.ts";
import { ColumnResizer, useColumnWidth } from "../ColumnResizer.tsx";

interface WideCompareViewProps {
    readonly workspace: TreeWorkspace;
    /** The node being looked at. */
    readonly nodeId: string;
    onSelect(nodeId: string): void;
    onBackToTree(): void;
}

/** Compare on a desktop: the tree to pick from on the left, the four sections as cards beside it. */
export function WideCompareView({ workspace, nodeId, onSelect, onBackToTree }: WideCompareViewProps) {
    const { tree, comparison: treeComparison, descriptions } = workspace;
    const [baseline, setBaseline] = useState<Baseline>("root");
    const [isSwapped, setIsSwapped] = useState(false);
    const treePanel = useColumnWidth("compare-tree", 340, { narrowest: 260, widest: 640 }, "left");
    const comparison = comparisonOf(workspace, nodeId, baseline, isSwapped);
    const rootDamagePerSecond = treeComparison?.root.state === "ready" ? treeComparison.root.battleSummary.averageDamagePerSecond : null;
    const rows = treeComparison === null ? [] : treeRowsOf(tree, treeComparison, "damagePerSecondGain");

    return (
        <main className="wide-main resizable" style={{ alignItems: "flex-start" }}>
            <aside className="card mini-tree" style={treePanel.style}>
                <div className="mini-tree-head">
                    <span className="eyebrow">{t("ツリー · クリックで B を指定")}</span>
                </div>
                <div className="mt">
                    <span className="mk mk-a" aria-label="A">
                        A
                    </span>
                    <span className="nm" style={{ fontWeight: 700, flex: 1 }}>
                        {rootLabel}
                    </span>
                    <span className="num" style={{ fontSize: 12, color: "var(--fg-3)" }}>
                        {rootDamagePerSecond === null ? "…" : formatInteger(rootDamagePerSecond)}
                    </span>
                </div>
                {rows.map(({ node, comparison: nodeComparison, depth }) => (
                    <button
                        key={node.id}
                        type="button"
                        className={`mt ${node.id === nodeId ? "selected" : ""}`}
                        disabled={nodeComparison.state !== "ready"}
                        aria-current={node.id === nodeId ? "true" : undefined}
                        onClick={() => onSelect(node.id)}
                    >
                        {Array.from({ length: depth }, (_unused, level) => (
                            <span key={level} className="g" />
                        ))}
                        {node.id === nodeId ? (
                            <span className="mk mk-b" aria-label="B">
                                B
                            </span>
                        ) : (
                            <span style={{ width: 20 }} />
                        )}
                        <span className="nm" style={{ flex: 1, fontWeight: node.id === nodeId ? 700 : 500 }}>
                            {node.label}
                        </span>
                        {nodeComparison.state === "ready" ? (
                            <span className={`badge num ${nodeComparison.damagePerSecondGain < 0 ? "bad" : "good"}`}>
                                {rootDamagePerSecond === null ? "" : formatSignedPercent(nodeComparison.damagePerSecondGain, rootDamagePerSecond)}
                            </span>
                        ) : (
                            <span className="badge stl">{nodeComparison.state === "stale" ? "stale" : "!"}</span>
                        )}
                    </button>
                ))}
            </aside>
            <ColumnResizer column={treePanel} label={t("列の幅")} />

            <section className="wide-primary">
                <div className="view-head">
                    <button type="button" className="btn" onClick={onBackToTree}>
                        <ChevronRightIcon size={14} className="flipped" />
                        {t("ツリー")}
                    </button>
                    <h1>{t("比較")}</h1>
                </div>
                {comparison === null ? (
                    <div className="card" style={{ padding: 20 }}>
                        <p className="empty-note" style={{ padding: 0 }}>
                            {t("このノードは比較できません。")}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="card compare-summary">
                            <PairPicker comparison={comparison} baseline={baseline} onChangeBaseline={setBaseline} onSwap={() => setIsSwapped(!isSwapped)} />
                            <MetricCards comparison={comparison} />
                        </div>
                        <div className="card-grid">
                            <div className="card compare-card">
                                <GearSection comparison={comparison} descriptions={descriptions} />
                            </div>
                            <div className="card compare-card">
                                <StatsSection comparison={comparison} />
                            </div>
                            <div className="card compare-card">
                                <EffectsSection comparison={comparison} descriptions={descriptions} />
                            </div>
                            <div className="card compare-card">
                                <PathSection comparison={comparison} />
                                <ApplyToLockerButton workspace={workspace} nodeId={nodeId} />
                            </div>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}
