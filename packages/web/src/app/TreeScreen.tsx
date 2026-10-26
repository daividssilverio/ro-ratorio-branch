import { spSustainSettingsOf } from "@ro-ratorio-branch/core/platform-neutral";
import type { NodeComparison, RankingMetric } from "@ro-ratorio-branch/core/platform-neutral";
import { useRef, useState } from "react";
import { CharacterManager } from "./CharacterManager.tsx";
import { type SpRowTexts, spRowTextsOf } from "./sp-sustain-view-model.ts";
import { formatInteger, formatSeconds, formatSignedInteger, formatZeny } from "./format.ts";
import { BranchIcon, ChevronDownIcon, ChevronRightIcon, CompareIcon, ImportIcon, SpinnerIcon, StarIcon, WarningIcon } from "./Icons.tsx";
import { rootLabel } from "./labels.ts";
import { NodeActions } from "./NodeActions.tsx";
import { RightsFooter } from "./RightsFooter.tsx";
import { GainBadges, GainDisplaySwitch, useGainDisplay } from "./GainBadges.tsx";
import { type GainDisplay, gainsOf, type RowGains, type TreeRow, treeRowsOf, withoutCollapsedBranches } from "./tree-view-model.ts";
import type { TreeImportFailure, TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

const noGains: RowGains = { total: null, step: null };

const siblingOrders: readonly { metric: RankingMetric; label: string }[] = [
    { metric: "damagePerSecondGain", label: "DPS" },
    { metric: "secondsToKill", label: t("討伐時間") },
    { metric: "valueForMoney", label: "DPS / M z" },
];

interface TreeScreenProps {
    readonly workspace: TreeWorkspace;
    readonly selectedNodeId: string | null;
    onSelect(nodeId: string | null): void;
    onCompare(nodeId: string): void;
    onAddBranch(parentNodeId: string | null): void;
}

export function TreeScreen({ workspace, selectedNodeId, onSelect, onCompare, onAddBranch }: TreeScreenProps) {
    const { tree, comparison, descriptions } = workspace;
    const [siblingOrder, setSiblingOrder] = useState<RankingMetric>("damagePerSecondGain");
    const [gainDisplay, setGainDisplay] = useGainDisplay();
    const [collapsedNodeIds, setCollapsedNodeIds] = useState<ReadonlySet<string>>(new Set());
    const [importFailure, setImportFailure] = useState<TreeImportFailure | null>(null);
    const [isManagingCharacters, setIsManagingCharacters] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const rootSummary = comparison?.root.state === "ready" ? comparison.root.battleSummary : null;
    const spSettings = spSustainSettingsOf(workspace.workspace.spEffectChances, workspace.workspace.activeSpEffects);
    const rootSp = spRowTextsOf(workspace.evaluation?.root, spSettings);
    const visibleRows = comparison === null ? [] : withoutCollapsedBranches(treeRowsOf(tree, comparison, siblingOrder), collapsedNodeIds);
    const selectedComparison = comparison?.nodes.find((nodeComparison) => nodeComparison.id === selectedNodeId);

    async function importChosenFile(file: File | undefined) {
        if (file !== undefined) {
            setImportFailure(workspace.importTreeFile(await file.text(), file.name.replace(/\.[^.]*$/, "")));
        }
    }

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
        <div className="screen">
            <header className="app-header">
                <div className="app-mark">
                    <BranchIcon size={16} />
                </div>
                <div className="app-title">
                    <strong>
                        {descriptions.jobNames[tree.root.jobId] ?? "ROラトリオ Branch"}{" "}
                        <span className="num" style={{ fontSize: 15, fontWeight: 500 }}>
                            Lv{tree.root.baseLevel}
                        </span>
                    </strong>
                    <span className="num">{tree.nodes.length} nodes</span>
                </div>
                <button type="button" className="btn" data-testid="open-character-manager" onClick={() => setIsManagingCharacters(true)}>
                    {t("管理")}
                </button>
                <button type="button" className="ib" aria-label={t("ツリーファイルを読み込む")} onClick={() => fileInput.current?.click()}>
                    <ImportIcon />
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    accept="application/json,.json"
                    className="visually-hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(event) => {
                        void importChosenFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
            </header>

            {importFailure !== null && <ImportFailureBanner failure={importFailure} />}
            {workspace.engineFailure !== null && (
                <div className="banner" role="alert">
                    {t("計算エンジンを開始できませんでした。")}
                    <div className="mono">{workspace.engineFailure}</div>
                </div>
            )}

            <section className="scenario" aria-label={t("シナリオ")}>
                <div className="scenario-line">
                    <span className="eyebrow">{t("シナリオ")}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{t("全ノードに適用")}</span>
                </div>
                <div className="scenario-line" style={{ fontSize: 13, fontWeight: 600 }}>
                    {descriptions.skillNames[tree.scenario.skillId] ?? `skill #${tree.scenario.skillId}`}{" "}
                    <span className="num">Lv{tree.scenario.skillLevel}</span>
                </div>
                <div className="scenario-line" style={{ fontSize: 12 }}>
                    <span style={{ color: "var(--fg-3)" }}>vs</span>
                    <span style={{ fontWeight: 600 }}>
                        {descriptions.monsterNames[tree.scenario.targetMonsterId] ?? `monster #${tree.scenario.targetMonsterId}`}
                    </span>
                </div>
            </section>

            <div style={{ padding: "10px 12px 6px", display: "flex", flexDirection: "column", gap: 8, flex: "none" }}>
                <div className="seg" role="group" aria-label={t("並び替え指標")}>
                    {siblingOrders.map(({ metric, label }) => (
                        <button key={metric} type="button" aria-pressed={siblingOrder === metric} onClick={() => setSiblingOrder(metric)}>
                            {label}
                        </button>
                    ))}
                </div>
                <GainDisplaySwitch value={gainDisplay} onChange={setGainDisplay} />
                <div className="progress" role="status">
                    {workspace.isCalculating && (
                        <>
                            <SpinnerIcon size={14} className="spinning" />
                            <span className="num">
                                {t("再計算中")} {workspace.progress.finished}/{workspace.progress.requested}
                            </span>
                            <div className="progress-track">
                                <div
                                    style={{
                                        width: `${workspace.progress.requested === 0 ? 0 : (100 * workspace.progress.finished) / workspace.progress.requested}%`,
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="scroll">
                <div className="tree-list">
                    <div className="tr" style={{ paddingLeft: 6 }}>
                        <button type="button" className="tr-main" onClick={() => onSelect(null)}>
                            <span className="tr-text">
                                <span className="nm" style={{ fontWeight: 700 }}>
                                    {rootLabel}
                                </span>
                                <span className="meta">{t("ROOT · 基準")}</span>
                                <SpMetaLine sp={rootSp} />
                            </span>
                            <span className="rc">
                                {rootSummary === null ? (
                                    <RowSkeleton />
                                ) : (
                                    <>
                                        <span className="num" style={{ fontWeight: 700, fontSize: 14, lineHeight: "20px" }}>
                                            {formatInteger(rootSummary.averageDamagePerSecond)}
                                            <span style={{ fontSize: 10, color: "var(--fg-3)", fontWeight: 500 }}>/s</span>
                                        </span>
                                        <span className="num" style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: "16px" }}>
                                            {rootSummary.averageTimeToKill === null ? "—" : `${formatSeconds(rootSummary.averageTimeToKill.seconds)} s`}
                                        </span>
                                    </>
                                )}
                            </span>
                        </button>
                    </div>

                    {comparison === null
                        ? tree.nodes.map((node) => (
                              <div key={node.id} className="tr" style={{ paddingLeft: 20 }}>
                                  <span className="tr-text">
                                      <span className="nm">{node.label}</span>
                                      <span className="meta">{t("計算中…")}</span>
                                  </span>
                                  <span className="rc">
                                      <RowSkeleton />
                                  </span>
                              </div>
                          ))
                        : visibleRows.map((row) => (
                              <TreeRowLine
                                  key={row.node.id}
                                  row={row}
                                  gains={comparison === null ? noGains : gainsOf(row.node, comparison)}
                                  gainDisplay={gainDisplay}
                                  sp={spRowTextsOf(workspace.evaluation?.nodes.get(row.node.id), spSettings)}
                                  isSelected={row.node.id === selectedNodeId}
                                  isCollapsed={collapsedNodeIds.has(row.node.id)}
                                  onSelect={() => onSelect(row.node.id)}
                                  onToggleCollapsed={() => toggleCollapsed(row.node.id)}
                                  onToggleFavorite={() => workspace.toggleFavorite(row.node.id)}
                              />
                          ))}
                </div>
                <NodeActions workspace={workspace} selectedNodeId={selectedNodeId} rootLabel={rootLabel} onAddBranch={onAddBranch} onSelect={onSelect} />
                <RightsFooter />
            </div>

            {selectedComparison?.state === "ready" && rootSummary !== null && (
                <div className="compare-bar">
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span className="meta">
                            {rootLabel} ⇄ {selectedComparison.label}
                        </span>
                        <span
                            className="num"
                            style={{
                                fontSize: 15,
                                fontWeight: 700,
                                lineHeight: "20px",
                                color: selectedComparison.damagePerSecondGain < 0 ? "var(--loss)" : "var(--gain)",
                            }}
                        >
                            {formatSignedInteger(selectedComparison.damagePerSecondGain)}/s
                        </span>
                    </div>
                    <button type="button" className="btn btn-p" onClick={() => onCompare(selectedComparison.id)}>
                        <CompareIcon />
                        {t("比較")}
                    </button>
                </div>
            )}
            {isManagingCharacters && <CharacterManager workspace={workspace} onClose={() => setIsManagingCharacters(false)} />}
        </div>
    );
}

function RowSkeleton() {
    return (
        <>
            <span className="skel" style={{ width: 64, height: 20 }} />
            <span className="skel" style={{ width: 64, height: 20 }} />
        </>
    );
}

function ImportFailureBanner({ failure }: { failure: TreeImportFailure }) {
    return (
        <div className="banner" role="alert">
            {failure.kind === "notJson" ? (
                t("JSON ファイルではありません。")
            ) : (
                <>
                    {t("ツリーファイルとして読み込めませんでした。")}
                    <ul className="mono">
                        {failure.issues.slice(0, 5).map((issue, index) => (
                            <li key={index}>
                                {issue.kind}
                                {"path" in issue ? ` ${issue.path}` : ""}
                                {"nodeId" in issue ? ` ${issue.nodeId}` : ""}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

interface TreeRowLineProps {
    readonly row: TreeRow;
    readonly gains: RowGains;
    readonly gainDisplay: GainDisplay;
    /** How long a full SP bar lasts, and SP spent and gained a second; `null` until calculated. */
    readonly sp: SpRowTexts | null;
    readonly isSelected: boolean;
    readonly isCollapsed: boolean;
    onSelect(): void;
    onToggleCollapsed(): void;
    onToggleFavorite(): void;
}

function TreeRowLine(props: TreeRowLineProps) {
    const { row, isSelected, isCollapsed } = props;
    const { node, comparison, depth, hasChildren } = row;
    const isStale = comparison.state === "stale";

    return (
        <div className={`tr ${isSelected ? "selected" : ""} ${isStale ? "stale hatch" : ""}`} aria-current={isSelected ? "true" : undefined}>
            {Array.from({ length: depth }, (_unused, level) => (
                <span key={level} className="g" />
            ))}
            {hasChildren ? (
                <button type="button" className="tw" aria-label={isCollapsed ? t("展開") : t("折りたたむ")} aria-expanded={!isCollapsed} onClick={props.onToggleCollapsed}>
                    {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDownIcon size={14} />}
                </button>
            ) : (
                <button
                    type="button"
                    className={`tw ${node.favorite === true ? "favorite" : ""}`}
                    aria-label={t("お気に入り")}
                    aria-pressed={node.favorite === true}
                    onClick={props.onToggleFavorite}
                >
                    {isStale ? <WarningIcon size={15} /> : <StarIcon size={15} />}
                </button>
            )}
            <button type="button" className="tr-main" onClick={props.onSelect}>
                <span className="tr-text">
                    <span className="nm" style={isStale ? { color: "var(--fg-2)" } : undefined}>
                        {node.label}
                    </span>
                    <span className="meta num" style={isStale ? { color: "var(--stale)" } : undefined}>
                        {metaTextOf(row)}
                    </span>
                    <SpMetaLine sp={props.sp} />
                </span>
                <span className="rc">
                    <RowBadges comparison={comparison} gains={props.gains} gainDisplay={props.gainDisplay} />
                </span>
            </button>
        </div>
    );
}

/** A row's line about SP, spent with a minus and gained with a plus: `SP 16.7 s · −172 +6 /秒`; nothing until calculated. */
function SpMetaLine({ sp }: { sp: SpRowTexts | null }) {
    if (sp === null) {
        return null;
    }
    return <span className="meta num">{sp.spent === "—" ? `SP ${sp.bar}` : t("SP {0} · −{1} +{2} /秒", sp.bar, sp.spent, sp.gained)}</span>;
}

function metaTextOf({ node, comparison, depth }: TreeRow): string {
    if (comparison.state === "stale") {
        return t("要確認 · 適用できない変更があります");
    }
    if (comparison.state === "notCalculable") {
        return t("計算できません");
    }
    if (node.zenyCost === undefined) {
        return t("コスト未入力");
    }
    const stepCost = `${depth > 1 ? "+" : ""}${formatZeny(node.zenyCost)} z`;
    return depth > 1 && comparison.cumulativeZenyCost !== null ? t("{0} · 累計 {1}", stepCost, formatZeny(comparison.cumulativeZenyCost)) : stepCost;
}

function RowBadges({ comparison, gains, gainDisplay }: { comparison: NodeComparison; gains: RowGains; gainDisplay: GainDisplay }) {
    if (comparison.state === "stale") {
        return <span className="badge stl">stale</span>;
    }
    if (comparison.state === "notCalculable") {
        return <span className="badge bad">!</span>;
    }
    return (
        <>
            <GainBadges gains={gains} display={gainDisplay} metric="damagePerSecond" isWide />
            <GainBadges gains={gains} display={gainDisplay} metric="secondsToKill" isWide />
        </>
    );
}
