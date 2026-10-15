import type { NodeComparison, RankingMetric } from "@ro-ratorio-branch/core/platform-neutral";
import { useRef, useState } from "react";
import { ApplyToLockerButton } from "../ApplyToLockerButton.tsx";
import { type Baseline, comparisonOf } from "../compare-model.ts";
import { MetricCards, PairPicker, PathSection } from "../CompareParts.tsx";
import { formatInteger, formatSeconds, formatSignedPercent, formatSignedSeconds, formatZeny } from "../format.ts";
import { ChevronDownIcon, ChevronRightIcon, ImportIcon, SpinnerIcon, StarIcon, WarningIcon } from "../Icons.tsx";
import { rootLabel } from "../labels.ts";
import { NodeActions } from "../NodeActions.tsx";
import { type TreeRow, treeRowsOf, withoutCollapsedBranches } from "../tree-view-model.ts";
import type { TreeImportFailure, TreeWorkspace } from "../use-tree-workspace.ts";
import { t } from "../text/ui-text.ts";

const siblingOrders: readonly { metric: RankingMetric; label: string }[] = [
    { metric: "damagePerSecondGain", label: "DPS" },
    { metric: "secondsToKill", label: t("討伐時間") },
    { metric: "valueForMoney", label: "DPS / M z" },
];

interface WideTreeViewProps {
    readonly workspace: TreeWorkspace;
    readonly selectedNodeId: string | null;
    onSelect(nodeId: string | null): void;
    onOpenDetail(nodeId: string): void;
    onAddBranch(parentNodeId: string | null): void;
}

export function WideTreeView({ workspace, selectedNodeId, onSelect, onOpenDetail, onAddBranch }: WideTreeViewProps) {
    const { tree, comparison, descriptions } = workspace;
    const [siblingOrder, setSiblingOrder] = useState<RankingMetric>("damagePerSecondGain");
    const [collapsedNodeIds, setCollapsedNodeIds] = useState<ReadonlySet<string>>(new Set());
    const [importFailure, setImportFailure] = useState<TreeImportFailure | null>(null);
    const [baseline, setBaseline] = useState<Baseline>("root");
    const [isSwapped, setIsSwapped] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const rootSummary = comparison?.root.state === "ready" ? comparison.root.battleSummary : null;
    const rows = comparison === null ? [] : withoutCollapsedBranches(treeRowsOf(tree, comparison, siblingOrder), collapsedNodeIds);
    const selectedComparison = selectedNodeId === null ? null : comparisonOf(workspace, selectedNodeId, baseline, isSwapped);

    function toggleCollapsed(nodeId: string) {
        setCollapsedNodeIds((current) => {
            const next = new Set(current);
            if (!next.delete(nodeId)) {
                next.add(nodeId);
            }
            return next;
        });
    }

    return (
        <>
            <div className="scenario-strip">
                <span className="eyebrow">{t("シナリオ")}</span>
                <b>
                    {descriptions.skillNames[tree.scenario.skillId] ?? `skill #${tree.scenario.skillId}`} <span className="num">Lv{tree.scenario.skillLevel}</span>
                </b>
                <span style={{ color: "var(--fg-3)" }}>vs</span>
                <b>{descriptions.monsterNames[tree.scenario.targetMonsterId] ?? `monster #${tree.scenario.targetMonsterId}`}</b>
                <span style={{ flex: 1 }} />
                {workspace.isCalculating && (
                    <span className="progress" role="status">
                        <SpinnerIcon size={14} className="spinning" />
                        <span className="num">
                            {t("再計算中")} {workspace.progress.finished}/{workspace.progress.requested}
                        </span>
                    </span>
                )}
            </div>

            <main className="wide-main">
                <section className="wide-primary">
                    <div className="view-head">
                        <h1>{t("ツリー")}</h1>
                        <span className="num" style={{ color: "var(--fg-3)", fontSize: 12 }}>
                            {tree.nodes.length} nodes
                        </span>
                        <span style={{ flex: 1 }} />
                        <div className="seg" role="group" aria-label={t("並び替え指標")}>
                            {siblingOrders.map(({ metric, label }) => (
                                <button key={metric} type="button" aria-pressed={siblingOrder === metric} onClick={() => setSiblingOrder(metric)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                            <ImportIcon />
                            {t("読み込む")}
                        </button>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="application/json,.json"
                            className="visually-hidden"
                            tabIndex={-1}
                            aria-hidden="true"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file !== undefined) {
                                    void file.text().then((fileText) => setImportFailure(workspace.importTreeFile(fileText, file.name.replace(/\.[^.]*$/, ""))));
                                }
                                event.target.value = "";
                            }}
                        />
                    </div>

                    {importFailure !== null && (
                        <div className="banner" role="alert" style={{ margin: 0 }}>
                            {importFailure.kind === "notJson" ? t("JSON ファイルではありません。") : t("ツリーファイルとして読み込めませんでした。")}
                            {importFailure.kind === "invalidTree" && (
                                <ul className="mono">
                                    {importFailure.issues.slice(0, 5).map((issue, index) => (
                                        <li key={index}>
                                            {issue.kind}
                                            {"path" in issue ? ` ${issue.path}` : ""}
                                            {"nodeId" in issue ? ` ${issue.nodeId}` : ""}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    {workspace.engineFailure !== null && (
                        <div className="banner" role="alert" style={{ margin: 0 }}>
                            {t("計算エンジンを開始できませんでした。")}<span className="mono"> {workspace.engineFailure}</span>
                        </div>
                    )}

                    <div className="card outline">
                        <div className="cols eyebrow outline-head">
                            <span style={{ paddingLeft: 12 }}>{t("ノード")}</span>
                            <span className="r">{t("コスト")}</span>
                            <span className="r">DPS</span>
                            <span className="r">Δ DPS</span>
                            <span className="r">{t("討伐時間")}</span>
                            <span className="r">{t("Δ 時間")}</span>
                            <span />
                        </div>
                        <div className="cols tr">
                            <button type="button" className="outline-name" onClick={() => onSelect(null)}>
                                <span className="tw" />
                                <span className="nm" style={{ fontWeight: 700 }}>
                                    {rootLabel}
                                </span>
                                <span className="eyebrow">ROOT</span>
                            </button>
                            <span className="c num">—</span>
                            <span className="r num" style={{ fontWeight: 700 }}>
                                {rootSummary === null ? "…" : formatInteger(rootSummary.averageDamagePerSecond)}
                            </span>
                            <span className="c">{t("基準")}</span>
                            <span className="r num" style={{ fontWeight: 600 }}>
                                {rootSummary?.averageTimeToKill == null ? "—" : `${formatSeconds(rootSummary.averageTimeToKill.seconds)} s`}
                            </span>
                            <span className="c">—</span>
                            <span />
                        </div>
                        {comparison === null
                            ? tree.nodes.map((node) => (
                                  <div key={node.id} className="cols tr">
                                      <span className="outline-name">
                                          <span className="g" />
                                          <span className="nm">{node.label}</span>
                                      </span>
                                      <span className="skel" style={{ height: 18, gridColumn: "2 / 7" }} />
                                      <span />
                                  </div>
                              ))
                            : rows.map((row) => (
                                  <OutlineRow
                                      key={row.node.id}
                                      row={row}
                                      rootDamagePerSecond={rootSummary?.averageDamagePerSecond ?? 0}
                                      rootSecondsToKill={rootSummary?.averageTimeToKill?.seconds ?? null}
                                      isSelected={row.node.id === selectedNodeId}
                                      isCollapsed={collapsedNodeIds.has(row.node.id)}
                                      onSelect={() => onSelect(row.node.id)}
                                      onToggleCollapsed={() => toggleCollapsed(row.node.id)}
                                      onToggleFavorite={() => workspace.toggleFavorite(row.node.id)}
                                  />
                              ))}
                    </div>
                    <NodeActions workspace={workspace} selectedNodeId={selectedNodeId} rootLabel={rootLabel} onAddBranch={onAddBranch} onSelect={onSelect} />
                </section>

                <aside className="wide-aside">
                    <div className="view-head">
                        <h2>{t("比較")}</h2>
                        <span style={{ flex: 1 }} />
                        {selectedComparison !== null && (
                            <button type="button" className="btn" onClick={() => onOpenDetail(selectedComparison.node.id)}>
                                {t("詳細")}
                                <ChevronRightIcon size={14} />
                            </button>
                        )}
                    </div>
                    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                        {selectedComparison === null ? (
                            <p className="empty-note" style={{ padding: 0 }}>
                                {t("ノードを選ぶと、")}{rootLabel}{t("との差を表示します。")}
                            </p>
                        ) : (
                            <>
                                <PairPicker
                                    comparison={selectedComparison}
                                    baseline={baseline}
                                    onChangeBaseline={setBaseline}
                                    onSwap={() => setIsSwapped(!isSwapped)}
                                />
                                <MetricCards comparison={selectedComparison} />
                                <PathSection comparison={selectedComparison} isCompact />
                                <ApplyToLockerButton workspace={workspace} nodeId={selectedComparison.node.id} />
                            </>
                        )}
                    </div>
                </aside>
            </main>
        </>
    );
}

interface OutlineRowProps {
    readonly row: TreeRow;
    readonly rootDamagePerSecond: number;
    readonly rootSecondsToKill: number | null;
    readonly isSelected: boolean;
    readonly isCollapsed: boolean;
    onSelect(): void;
    onToggleCollapsed(): void;
    onToggleFavorite(): void;
}

function OutlineRow(props: OutlineRowProps) {
    const { row, isSelected, isCollapsed } = props;
    const { node, comparison, depth, hasChildren } = row;
    const isStale = comparison.state === "stale";

    return (
        <div className={`cols tr ${isSelected ? "selected" : ""} ${isStale ? "stale hatch" : ""}`} aria-current={isSelected ? "true" : undefined}>
            <span className="outline-name">
                {Array.from({ length: depth }, (_unused, level) => (
                    <span key={level} className="g" />
                ))}
                {hasChildren ? (
                    <button type="button" className="tw" aria-label={isCollapsed ? t("展開") : t("折りたたむ")} aria-expanded={!isCollapsed} onClick={props.onToggleCollapsed}>
                        {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDownIcon size={14} />}
                    </button>
                ) : (
                    <span className="tw">{isStale && <WarningIcon size={15} />}</span>
                )}
                <button type="button" className="outline-label" onClick={props.onSelect}>
                    <span className="nm" style={isStale ? { color: "var(--fg-2)" } : undefined}>
                        {node.label}
                    </span>
                </button>
            </span>
            <OutlineCells comparison={comparison} row={row} rootDamagePerSecond={props.rootDamagePerSecond} rootSecondsToKill={props.rootSecondsToKill} />
            <button
                type="button"
                className={`tw ${node.favorite === true ? "favorite" : ""}`}
                aria-label={t("お気に入り")}
                aria-pressed={node.favorite === true}
                onClick={props.onToggleFavorite}
            >
                <StarIcon size={15} />
            </button>
        </div>
    );
}

function OutlineCells({
    comparison,
    row,
    rootDamagePerSecond,
    rootSecondsToKill,
}: {
    comparison: NodeComparison;
    row: TreeRow;
    rootDamagePerSecond: number;
    rootSecondsToKill: number | null;
}) {
    const costText = row.node.zenyCost === undefined ? t("未設定") : `${row.depth > 1 ? "+" : ""}${formatZeny(row.node.zenyCost)}`;
    if (comparison.state !== "ready") {
        return (
            <>
                <span className="c num">{costText}</span>
                <span className="c" style={{ gridColumn: "3 / 7", color: comparison.state === "stale" ? "var(--stale)" : "var(--loss)" }}>
                    {comparison.state === "stale" ? t("要確認 · 適用できない変更があります") : t("計算できません")}
                </span>
            </>
        );
    }
    const gain = comparison.damagePerSecondGain;
    const secondsToKill = comparison.battleSummary.averageTimeToKill?.seconds ?? null;
    const secondsDifference = secondsToKill !== null && rootSecondsToKill !== null ? secondsToKill - rootSecondsToKill : null;
    return (
        <>
            <span className="c num">{costText}</span>
            <span className="r num">{formatInteger(comparison.battleSummary.averageDamagePerSecond)}</span>
            <span className="r">
                <span className={`badge num ${gain > 0 ? "good" : gain < 0 ? "bad" : "flat"}`}>
                    {gain > 0 ? "▲ " : gain < 0 ? "▼ " : ""}
                    {formatSignedPercent(gain, rootDamagePerSecond)}
                </span>
            </span>
            <span className="r num">{secondsToKill === null ? "—" : `${formatSeconds(secondsToKill)} s`}</span>
            <span className="r">
                {secondsDifference === null ? (
                    <span className="c">—</span>
                ) : (
                    <span className={`badge num ${secondsDifference < 0 ? "good" : secondsDifference > 0 ? "bad" : "flat"}`}>
                        {secondsDifference < 0 ? "▼ " : secondsDifference > 0 ? "▲ " : ""}
                        {formatSignedSeconds(secondsDifference)}
                    </span>
                )}
            </span>
        </>
    );
}
