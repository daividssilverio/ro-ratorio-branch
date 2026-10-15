import type { GearPiece } from "@ro-ratorio-branch/core/platform-neutral";
import type { Descriptions } from "../engine-host/host-protocol.ts";
import type { Baseline, Comparison } from "./compare-model.ts";
import { effectTextLines, type GearDiffRow } from "./compare-view-model.ts";
import { formatInteger, formatSeconds, formatSignedInteger, formatSignedPercent, formatSignedSeconds, formatZeny } from "./format.ts";
import { SwapIcon } from "./Icons.tsx";
import { cardOrEnchantNameIn, itemNameIn, randomOptionTextIn, sectionLabels, slotLabels } from "./labels.ts";
import { t } from "./text/ui-text.ts";

const badgeToneOf = (difference: number, lowerIsBetter = false) =>
    difference === 0 ? "flat" : difference > 0 !== lowerIsBetter ? "good" : "bad";

interface PairPickerProps {
    readonly comparison: Comparison;
    readonly baseline: Baseline;
    onChangeBaseline(baseline: Baseline): void;
    onSwap(): void;
}

/** The A and B boxes. A switches between the root and the parent; the middle button swaps the sides. */
export function PairPicker({ comparison, baseline, onChangeBaseline, onSwap }: PairPickerProps) {
    return (
        <div className="pair">
            <button
                type="button"
                className="pick"
                disabled={comparison.parentNode === undefined}
                aria-label={t("A: {0}。基準を切り替える", comparison.sideA.label)}
                onClick={() => onChangeBaseline(baseline === "root" ? "parent" : "root")}
            >
                <span className="eyebrow">A</span>
                <b>{comparison.sideA.label}</b>
            </button>
            <button type="button" className="ib" aria-label={t("A と B を入れ替え")} onClick={onSwap}>
                <SwapIcon />
            </button>
            <div className="pick is-b">
                <span className="eyebrow">B</span>
                <b>{comparison.sideB.label}</b>
            </div>
        </div>
    );
}

export function MetricCards({ comparison }: { comparison: Comparison }) {
    const damageA = comparison.sideA.evaluation.battleSummary.averageDamagePerSecond;
    const damageB = comparison.sideB.evaluation.battleSummary.averageDamagePerSecond;
    const secondsA = comparison.sideA.evaluation.battleSummary.averageTimeToKill?.seconds ?? null;
    const secondsB = comparison.sideB.evaluation.battleSummary.averageTimeToKill?.seconds ?? null;
    const damageGain = damageB - damageA;
    const secondsDifference = secondsA !== null && secondsB !== null ? secondsB - secondsA : null;

    return (
        <div className="metric-cards">
            <div className="metric-card">
                <span className="eyebrow">DPS</span>
                <span className="value num">{formatInteger(damageB)}</span>
                <span className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                    A {formatInteger(damageA)}
                </span>
                <span className={`badge num ${badgeToneOf(damageGain)}`} style={{ marginTop: 4 }}>
                    {damageGain > 0 ? "▲ " : damageGain < 0 ? "▼ " : ""}
                    {formatSignedInteger(damageGain)} · {formatSignedPercent(damageGain, damageA)}
                </span>
            </div>
            <div className="metric-card">
                <span className="eyebrow">{t("討伐時間")}</span>
                <span className="value num">
                    {secondsB === null ? "—" : formatSeconds(secondsB)}
                    <small> s</small>
                </span>
                <span className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                    A {secondsA === null ? "—" : `${formatSeconds(secondsA)} s`}
                </span>
                {secondsDifference !== null && secondsA !== null && (
                    <span className={`badge num ${badgeToneOf(secondsDifference, true)}`} style={{ marginTop: 4 }}>
                        {secondsDifference < 0 ? "▼ " : secondsDifference > 0 ? "▲ " : ""}
                        {formatSignedSeconds(secondsDifference)} · {formatSignedPercent(secondsDifference, secondsA)}
                    </span>
                )}
            </div>
        </div>
    );
}

export function GearSection({ comparison, descriptions }: { comparison: Comparison; descriptions: Descriptions }) {
    const { gearRows, diff } = comparison;
    return (
        <section>
            <div className="section-head">
                <h3>{t("装備の差分")}</h3>
                <span className="num">{diff.gear.length} slots</span>
            </div>
            {gearRows.length === 0 && diff.otherInputs.length === 0 && <p className="empty-note">{t("装備の違いはありません。")}</p>}
            {gearRows.map((row, index) => (
                <GearRowLine key={index} row={row} descriptions={descriptions} />
            ))}
            {diff.otherInputs.map((input) => (
                <div className="dr" key={`${input.section}-${input.name}`}>
                    <span className="slot">{sectionLabels[input.section]}</span>
                    <div className="ab">
                        <span className="a num">
                            {input.name} {input.before}
                        </span>
                        <span className="b num">
                            {input.name} {input.after}
                        </span>
                    </div>
                </div>
            ))}
        </section>
    );
}

export function StatsSection({ comparison }: { comparison: Comparison }) {
    const { derivedNumbers } = comparison;
    return (
        <section>
            <div className="section-head">
                <h3>{t("ステータス · ボーナス")}</h3>
                <span className="num">{derivedNumbers.length} changed</span>
            </div>
            {derivedNumbers.length === 0 ? (
                <p className="empty-note">{t("変化はありません。")}</p>
            ) : (
                <div className="stat-table">
                    {derivedNumbers.map(({ name, before, after }) => (
                        <StatRow key={name} name={name} before={before} after={after} />
                    ))}
                </div>
            )}
        </section>
    );
}

export function EffectsSection({ comparison, descriptions }: { comparison: Comparison; descriptions: Descriptions }) {
    const { itemIds, cardOrEnchantIds } = comparison.newlyEquipped;
    return (
        <section>
            <div className="section-head">
                <h3>{t("効果")}</h3>
                <span className="num">{itemIds.length + cardOrEnchantIds.length} new</span>
            </div>
            {itemIds.length + cardOrEnchantIds.length === 0 && <p className="empty-note">{t("B で新しく装備するものはありません。")}</p>}
            {itemIds.map((itemId) => (
                <EffectText key={`item-${itemId}`} name={itemNameIn(descriptions, itemId)} effectText={descriptions.items[itemId]?.effectText ?? ""} />
            ))}
            {cardOrEnchantIds.map((cardOrEnchantId) => (
                <EffectText
                    key={`card-${cardOrEnchantId}`}
                    name={cardOrEnchantNameIn(descriptions, cardOrEnchantId)}
                    effectText={descriptions.cardsOrEnchants[cardOrEnchantId]?.effectText ?? ""}
                />
            ))}
        </section>
    );
}

/** The steps to the looked-at node, each against the one before it. `isCompact` drops the before and after values. */
export function PathSection({ comparison, isCompact = false }: { comparison: Comparison; isCompact?: boolean }) {
    const { pathSteps, node, nodeComparison } = comparison;
    return (
        <section>
            <div className="section-head">
                <h3>{t("経路 · この順序での増分")}</h3>
                <span>{isCompact ? t("vs 親ノード") : node.label}</span>
            </div>
            <div className="path-steps">
                {pathSteps.map((step, index) => {
                    const gain = step.damagePerSecondAfter - step.damagePerSecondBefore;
                    return (
                        <div className="path-step" key={step.nodeId}>
                            <span className="path-step-label">
                                <span className="num" style={{ color: "var(--fg-3)" }}>
                                    {index + 1}.
                                </span>{" "}
                                {step.label}
                                {!isCompact && (
                                    <span className="num" style={{ color: "var(--fg-3)", fontSize: 11 }}>
                                        {" "}
                                        {formatInteger(step.damagePerSecondBefore)} → {formatInteger(step.damagePerSecondAfter)}
                                    </span>
                                )}
                            </span>
                            <span className="num">{formatSignedInteger(gain)}</span>
                            <span className="num" style={{ color: gain < 0 ? "var(--loss)" : "var(--gain)" }}>
                                {formatSignedPercent(gain, step.damagePerSecondBefore)}
                            </span>
                            <span className="num" style={{ color: "var(--fg-3)" }}>
                                {step.zenyCost === undefined ? "— z" : `${formatZeny(step.zenyCost)} z`}
                            </span>
                        </div>
                    );
                })}
            </div>
            <p className="empty-note">{t("各ステップは直前のノードとの差です。効果は掛け算になるため、順序を入れ替えると値も変わります。")}</p>
            {nodeComparison !== undefined && (
                <div className="path-total num">
                    <span>
                        {t("累計")}{" "}
                        <b>{nodeComparison.cumulativeZenyCost === null ? t("未設定") : `${formatZeny(nodeComparison.cumulativeZenyCost)} z`}</b>
                    </span>
                    <span>
                        <b>
                            {nodeComparison.valueForMoney.kind === "priced"
                                ? formatInteger(nodeComparison.valueForMoney.damagePerSecondGainPerMillionZeny)
                                : nodeComparison.valueForMoney.kind === "free"
                                  ? t("無料")
                                  : "—"}
                        </b>{" "}
                        DPS / M z
                    </span>
                </div>
            )}
        </section>
    );
}

function pieceText(descriptions: Descriptions, gearPiece: GearPiece | undefined): string {
    if (gearPiece === undefined) {
        return t("— 空き");
    }
    const refine = (gearPiece.refine ?? 0) > 0 ? ` +${gearPiece.refine}` : "";
    return `${itemNameIn(descriptions, gearPiece.itemId)}${refine}`;
}

function GearRowLine({ row, descriptions }: { row: GearDiffRow; descriptions: Descriptions }) {
    const slotLabel = slotLabels[row.slot];
    if ("optionsAfter" in row) {
        const optionsText = (randomOptions: typeof row.optionsAfter) =>
            randomOptions.map((randomOption) => randomOptionTextIn(descriptions, randomOption)).join("、") || t("— なし");
        return (
            <div className="dr">
                <span className="slot">{slotLabel}</span>
                <div className="ab">
                    <span className="a num">{optionsText(row.optionsBefore)}</span>
                    <span className="b num">
                        <span className="tag">{t("オプション")}</span>
                        {optionsText(row.optionsAfter)}
                    </span>
                </div>
            </div>
        );
    }
    if (!("socket" in row) && !("itemId" in row)) {
        const tag = { equipped: t("追加"), unequipped: t("解除"), swapped: t("交換") }[row.kind];
        return (
            <div className="dr">
                <span className="slot">{slotLabel}</span>
                <div className="ab">
                    <span className="a">{pieceText(descriptions, row.before)}</span>
                    <span className="b">
                        <span className={`tag ${row.kind === "equipped" ? "" : "neutral"}`}>{tag}</span>
                        {pieceText(descriptions, row.after)}
                    </span>
                </div>
            </div>
        );
    }
    if ("itemId" in row) {
        const mark = row.kind === "refined" ? "+" : "★";
        return (
            <div className="dr">
                <span className="slot">{slotLabel}</span>
                <div className="ab">
                    <span className="a num">
                        {itemNameIn(descriptions, row.itemId)} {mark}
                        {row.before}
                    </span>
                    <span className="b">
                        <span className="tag">{row.kind === "refined" ? t("精錬") : t("超越")}</span>
                        {itemNameIn(descriptions, row.itemId)}{" "}
                        <span className="num">
                            {mark}
                            {row.after}
                        </span>
                    </span>
                </div>
            </div>
        );
    }
    const tag = { socketFilled: t("追加"), socketSwapped: t("交換"), socketEmptied: t("解除") }[row.kind];
    return (
        <div className="dr">
            <span className="slot">
                {slotLabel} S{row.socket}
            </span>
            <div className="ab">
                <span className="a">{row.before === null ? t("— 空き") : cardOrEnchantNameIn(descriptions, row.before)}</span>
                <span className="b">
                    <span className={`tag ${row.kind === "socketFilled" ? "" : "neutral"}`}>{tag}</span>
                    {row.after === null ? t("— 空き") : cardOrEnchantNameIn(descriptions, row.after)}
                </span>
            </div>
        </div>
    );
}

function StatRow({ name, before, after }: { name: string; before: number; after: number }) {
    const difference = after - before;
    return (
        <>
            <span className="name mono">{name}</span>
            <span className="before num">{formatInteger(before)}</span>
            <span className="after num">{formatInteger(after)}</span>
            <span style={{ textAlign: "right" }}>
                <span className={`badge num ${badgeToneOf(difference)}`}>{formatSignedInteger(difference)}</span>
            </span>
        </>
    );
}

function EffectText({ name, effectText }: { name: string; effectText: string }) {
    const lines = effectTextLines(effectText);
    return (
        <div className="effect">
            <b>{name}</b>
            {lines.length === 0 ? t("（説明なし）") : lines.map((line, index) => <div key={index}>{line}</div>)}
        </div>
    );
}
