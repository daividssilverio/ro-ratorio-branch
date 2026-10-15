import type { RankingMetric, Tree } from "@ro-ratorio-branch/core/platform-neutral";
import { type FormEvent, useState } from "react";
import { formatInteger, formatSeconds, formatSignedInteger, formatSignedPercent, formatSignedSeconds, formatZeny } from "../format.ts";
import { SortDownIcon, StarIcon, WarningIcon } from "../Icons.tsx";
import { rootLabel } from "../labels.ts";
import { type RankingCard, rankingCardsOf, staleNodesOf } from "../tree-view-model.ts";
import type { TreeWorkspace } from "../use-tree-workspace.ts";
import { t } from "../text/ui-text.ts";

const zenyPerMillion = 1_000_000;

interface WideRankingViewProps {
    readonly workspace: TreeWorkspace;
    onShowInTree(nodeId: string): void;
}

export function WideRankingView({ workspace, onShowInTree }: WideRankingViewProps) {
    const { tree, comparison } = workspace;
    const [metric, setMetric] = useState<RankingMetric>("damagePerSecondGain");
    const rootSummary = comparison?.root.state === "ready" ? comparison.root.battleSummary : null;
    const cards = comparison === null ? [] : rankingCardsOf(tree, comparison, metric);
    const staleNodes = comparison === null ? [] : staleNodesOf(comparison);

    const sortableHeader = (headerMetric: RankingMetric, label: string) => (
        <th aria-sort={metric === headerMetric ? (headerMetric === "damagePerSecondGain" || headerMetric === "valueForMoney" ? "descending" : "ascending") : undefined}>
            <button type="button" onClick={() => setMetric(headerMetric)}>
                {label}
                {metric === headerMetric && <SortDownIcon size={13} />}
            </button>
        </th>
    );

    return (
        <main className="wide-main ranking-main">
            <div className="view-head" style={{ alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 22 }}>
                        {t("ランキング")} <small>{t("全リーフ vs ROOT")}</small>
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-2)" }} className="num">
                        {t("すべてのリーフを")} <b>{rootLabel}</b>
                        {rootSummary !== null &&
                            `（${formatInteger(rootSummary.averageDamagePerSecond)}/s${rootSummary.averageTimeToKill === null ? "" : ` · ${formatSeconds(rootSummary.averageTimeToKill.seconds)} s`}）`}
                        {t("と比べます。コストは経路に沿って合計します。")}
                    </p>
                </div>
            </div>
            <div className="card table-card">
                <table className="rank-table">
                    <thead>
                        <tr>
                            <th style={{ width: 44 }}>#</th>
                            <th>{t("リーフ · 経路")}</th>
                            {sortableHeader("damagePerSecondGain", t("DPS 上昇"))}
                            <th>DPS</th>
                            {sortableHeader("secondsToKill", t("討伐時間"))}
                            {sortableHeader("cumulativeZenyCost", t("累計コスト"))}
                            {sortableHeader("valueForMoney", "DPS / M z")}
                        </tr>
                    </thead>
                    <tbody>
                        {cards.map((card) => (
                            <RankingRow
                                key={card.comparison.id}
                                card={card}
                                tree={tree}
                                rootDamagePerSecond={rootSummary?.averageDamagePerSecond ?? 0}
                                rootSecondsToKill={rootSummary?.averageTimeToKill?.seconds ?? null}
                                onShowInTree={() => onShowInTree(card.comparison.id)}
                                onSetStepCost={workspace.setStepCost}
                            />
                        ))}
                    </tbody>
                </table>
                {comparison === null && <p className="empty-note" style={{ padding: 16 }}>{t("計算中…")}</p>}
                {comparison !== null && cards.length === 0 && <p className="empty-note" style={{ padding: 16 }}>{t("比較できるノードがありません。")}</p>}
            </div>
            {staleNodes.length > 0 && (
                <div className="stale-note">
                    <WarningIcon size={16} />
                    <span style={{ flex: 1 }}>
                        {staleNodes.length} {t("stale · ランキング対象外:")} <b>{staleNodes.map((staleNode) => staleNode.label).join(", ")}</b>
                    </span>
                </div>
            )}
        </main>
    );
}

interface RankingRowProps {
    readonly card: RankingCard;
    readonly tree: Tree;
    readonly rootDamagePerSecond: number;
    readonly rootSecondsToKill: number | null;
    onShowInTree(): void;
    onSetStepCost(nodeId: string, zenyCost: number | undefined): void;
}

function RankingRow({ card, tree, rootDamagePerSecond, rootSecondsToKill, onShowInTree, onSetStepCost }: RankingRowProps) {
    const { comparison, rank, pathLabels } = card;
    const node = tree.nodes.find((candidate) => candidate.id === comparison.id);
    const gain = comparison.damagePerSecondGain;
    const secondsToKill = comparison.battleSummary.averageTimeToKill?.seconds ?? null;
    const secondsDifference = secondsToKill !== null && rootSecondsToKill !== null ? secondsToKill - rootSecondsToKill : null;
    const firstUnpricedStep = comparison.cumulativeZenyCost === null ? firstUnpricedStepOnPathTo(tree, comparison.id) : undefined;

    return (
        <tr className={rank === 1 ? "first" : ""}>
            <td className="num rank-number">{rank}</td>
            <td style={{ maxWidth: 440 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {node?.favorite === true && <StarIcon size={15} className="favorite-mark" />}
                    <div style={{ minWidth: 0 }}>
                        <button type="button" className="link rk-label" style={{ textDecoration: "none", color: "var(--fg)", fontSize: 14 }} onClick={onShowInTree}>
                            {comparison.label}
                        </button>
                        <div className="trail">{pathLabels.length > 1 ? pathLabels.join(" › ") : t("単独ノード")}</div>
                    </div>
                </div>
            </td>
            <td>
                <span className={`badge num ${gain > 0 ? "good" : gain < 0 ? "bad" : "flat"}`}>
                    {gain > 0 ? "▲ " : gain < 0 ? "▼ " : ""}
                    {formatSignedInteger(gain)} · {formatSignedPercent(gain, rootDamagePerSecond)}
                </span>
                <span className="inline-bar">
                    <span style={{ width: `${card.gainShareOfBest * 100}%` }} />
                </span>
            </td>
            <td className="num" style={{ fontWeight: 600 }}>
                {formatInteger(comparison.battleSummary.averageDamagePerSecond)}
            </td>
            <td className="num">
                <b>{secondsToKill === null ? "—" : `${formatSeconds(secondsToKill)} s`}</b>{" "}
                {secondsDifference !== null && (
                    <span style={{ color: secondsDifference > 0 ? "var(--loss)" : "var(--gain)", fontWeight: 600 }}>{formatSignedSeconds(secondsDifference)}</span>
                )}
            </td>
            <td className="num">{comparison.cumulativeZenyCost === null ? <span style={{ color: "var(--fg-3)" }}>{t("未設定")}</span> : formatZeny(comparison.cumulativeZenyCost)}</td>
            <td className="num" style={{ fontWeight: 600 }}>
                {comparison.valueForMoney.kind === "priced" && formatInteger(comparison.valueForMoney.damagePerSecondGainPerMillionZeny)}
                {comparison.valueForMoney.kind === "free" && <span style={{ color: "var(--accent)" }}>{t("無料")}</span>}
                {comparison.valueForMoney.kind === "unpriced" && firstUnpricedStep !== undefined && (
                    <InlineCostEntry stepLabel={firstUnpricedStep.label} onSubmit={(zenyCost) => onSetStepCost(firstUnpricedStep.id, zenyCost)} />
                )}
            </td>
        </tr>
    );
}

function firstUnpricedStepOnPathTo(tree: Tree, nodeId: string) {
    const nodeOfId = new Map(tree.nodes.map((node) => [node.id, node]));
    let firstUnpricedStep: Tree["nodes"][number] | undefined;
    for (let node = nodeOfId.get(nodeId); node !== undefined; node = nodeOfId.get(node.parentId ?? "")) {
        if (node.zenyCost === undefined) {
            firstUnpricedStep = node;
        }
    }
    return firstUnpricedStep;
}

function InlineCostEntry({ stepLabel, onSubmit }: { stepLabel: string; onSubmit(zenyCost: number): void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [millionsText, setMillionsText] = useState("");

    if (!isOpen) {
        return (
            <>
                <span style={{ color: "var(--fg-3)" }}>— </span>
                <button type="button" className="btn dashed" onClick={() => setIsOpen(true)}>
                    {t("コストを入力")}
                </button>
            </>
        );
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        const millions = Number(millionsText);
        if (millionsText.trim() !== "" && Number.isFinite(millions) && millions >= 0) {
            onSubmit(Math.round(millions * zenyPerMillion));
            setIsOpen(false);
        }
    }

    return (
        <form className="cost-entry" style={{ justifyContent: "flex-end", marginTop: 0 }} onSubmit={submit}>
            <label>
                <span className="visually-hidden">{stepLabel} {t("のコスト（M z）")}</span>
                <input type="number" inputMode="decimal" min="0" step="any" autoFocus value={millionsText} onChange={(event) => setMillionsText(event.target.value)} />
            </label>
            <span>M z</span>
            <button type="submit" className="btn">
                {t("保存")}
            </button>
        </form>
    );
}
