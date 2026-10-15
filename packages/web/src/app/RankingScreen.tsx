import type { RankingMetric, Tree } from "@ro-ratorio-branch/core/platform-neutral";
import { type FormEvent, useState } from "react";
import { formatInteger, formatSignedPercent, formatSignedSeconds, formatZeny } from "./format.ts";
import { SortDownIcon, WarningIcon } from "./Icons.tsx";
import { metricLabels } from "./labels.ts";
import { RightsFooter } from "./RightsFooter.tsx";
import { type RankingCard, rankingCardsOf, staleNodesOf } from "./tree-view-model.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

const metricOrder: readonly RankingMetric[] = ["damagePerSecondGain", "secondsToKill", "valueForMoney", "cumulativeZenyCost"];
const zenyPerMillion = 1_000_000;

interface RankingScreenProps {
    readonly workspace: TreeWorkspace;
    onCompare(nodeId: string): void;
}

export function RankingScreen({ workspace, onCompare }: RankingScreenProps) {
    const { tree, comparison } = workspace;
    const [metric, setMetric] = useState<RankingMetric>("damagePerSecondGain");

    const rootSummary = comparison?.root.state === "ready" ? comparison.root.battleSummary : null;
    const cards = comparison === null ? [] : rankingCardsOf(tree, comparison, metric);
    const staleNodes = comparison === null ? [] : staleNodesOf(comparison);

    return (
        <div className="screen">
            <header className="app-header">
                <h1 className="screen-title">
                    {t("ランキング")} <small className="num">{cards.length} leaves vs ROOT</small>
                </h1>
            </header>
            <div className="chips" role="group" aria-label={t("並び替え")}>
                {metricOrder.map((candidate) => (
                    <button key={candidate} type="button" className="chip" aria-pressed={metric === candidate} onClick={() => setMetric(candidate)}>
                        {metric === candidate && <SortDownIcon size={14} />}
                        {metricLabels[candidate]}
                    </button>
                ))}
            </div>
            <div className="scroll">
                <div className="rank-list">
                    {comparison === null && <p className="empty-note">{t("計算中…")}</p>}
                    {comparison !== null && cards.length === 0 && <p className="empty-note">{t("比較できるノードがありません。")}</p>}
                    {cards.map((card) => (
                        <RankingCardView
                            key={card.comparison.id}
                            card={card}
                            tree={tree}
                            rootDamagePerSecond={rootSummary?.averageDamagePerSecond ?? 0}
                            rootSecondsToKill={rootSummary?.averageTimeToKill?.seconds ?? null}
                            onCompare={() => onCompare(card.comparison.id)}
                            onSetStepCost={workspace.setStepCost}
                        />
                    ))}
                    {staleNodes.length > 0 && (
                        <div className="stale-note">
                            <WarningIcon size={15} />
                            <span style={{ flex: 1 }}>
                                {staleNodes.length} stale excluded · {staleNodes.map((staleNode) => staleNode.label).join(", ")}
                            </span>
                        </div>
                    )}
                </div>
                <RightsFooter />
            </div>
        </div>
    );
}

interface RankingCardViewProps {
    readonly card: RankingCard;
    readonly tree: Tree;
    readonly rootDamagePerSecond: number;
    readonly rootSecondsToKill: number | null;
    onCompare(): void;
    onSetStepCost(nodeId: string, zenyCost: number | undefined): void;
}

function RankingCardView({ card, tree, rootDamagePerSecond, rootSecondsToKill, onCompare, onSetStepCost }: RankingCardViewProps) {
    const { comparison, rank, pathLabels } = card;
    const secondsToKill = comparison.battleSummary.averageTimeToKill?.seconds ?? null;
    const secondsDifference = secondsToKill !== null && rootSecondsToKill !== null ? secondsToKill - rootSecondsToKill : null;
    const gainColor = comparison.damagePerSecondGain < 0 ? "var(--loss)" : "var(--gain)";
    const firstUnpricedStep = comparison.cumulativeZenyCost === null ? firstUnpricedStepOnPathTo(tree, comparison.id) : undefined;

    return (
        <div className={`rk ${rank === 1 ? "first" : ""}`}>
            <span className="rn num">{rank}</span>
            <div style={{ minWidth: 0 }}>
                <button type="button" className="link rk-label" style={{ textDecoration: "none", color: "var(--fg)", fontSize: 14 }} onClick={onCompare}>
                    {comparison.label}
                </button>
                <div className="trail">{pathLabels.join(" › ")}</div>
                <div className="m4 num">
                    <div>
                        <span>DPS</span>
                        <span style={{ color: gainColor }}>{formatSignedPercent(comparison.damagePerSecondGain, rootDamagePerSecond)}</span>
                    </div>
                    <div>
                        <span>{t("時間")}</span>
                        <span style={{ color: secondsDifference !== null && secondsDifference > 0 ? "var(--loss)" : "var(--gain)" }}>
                            {secondsDifference === null ? "—" : formatSignedSeconds(secondsDifference)}
                        </span>
                    </div>
                    <div>
                        <span>{t("コスト")}</span>
                        <span>{comparison.cumulativeZenyCost === null ? "?" : formatZeny(comparison.cumulativeZenyCost)}</span>
                    </div>
                    <div>
                        <span>/M z</span>
                        <ValueForMoneyText valueForMoney={comparison.valueForMoney} />
                    </div>
                </div>
                <div className="bar">
                    <div style={{ width: `${card.gainShareOfBest * 100}%` }} />
                </div>
                {firstUnpricedStep !== undefined && <StepCostEntry stepLabel={firstUnpricedStep.label} onSubmit={(zenyCost) => onSetStepCost(firstUnpricedStep.id, zenyCost)} />}
            </div>
        </div>
    );
}

function ValueForMoneyText({ valueForMoney }: { valueForMoney: RankingCard["comparison"]["valueForMoney"] }) {
    if (valueForMoney.kind === "unpriced") {
        return <span style={{ color: "var(--fg-3)", fontWeight: 500 }}>—</span>;
    }
    if (valueForMoney.kind === "free") {
        return <span style={{ color: "var(--accent)" }}>{t("無料")}</span>;
    }
    return <span>{formatInteger(valueForMoney.damagePerSecondGainPerMillionZeny)}</span>;
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

function StepCostEntry({ stepLabel, onSubmit }: { stepLabel: string; onSubmit(zenyCost: number): void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [millionsText, setMillionsText] = useState("");

    if (!isOpen) {
        return (
            <div className="cost-entry">
                <button type="button" className="link" onClick={() => setIsOpen(true)}>
                    {t("コストを入力")}
                </button>
                <span style={{ color: "var(--fg-3)" }}>{stepLabel}</span>
            </div>
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
        <form className="cost-entry" onSubmit={submit}>
            <label>
                <span className="visually-hidden">{stepLabel} {t("のコスト（M z）")}</span>
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    autoFocus
                    value={millionsText}
                    onChange={(event) => setMillionsText(event.target.value)}
                />
            </label>
            <span>M z</span>
            <button type="submit" className="btn" style={{ minHeight: 36 }}>
                {t("保存")}
            </button>
        </form>
    );
}
