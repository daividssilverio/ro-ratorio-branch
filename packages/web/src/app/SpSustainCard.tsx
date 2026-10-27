import {
    type ActiveSpEffects,
    type ChanceOrigin,
    type SpEffectChances,
    type SpEffectSource,
    type SpSustain,
    type SpSustainBasis,
    spSustainFrom,
    spSustainSettingsOf,
} from "@ro-ratorio-branch/core/platform-neutral";
import { CommittedNumberField } from "./CommittedFields.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { slotLabels } from "./labels.ts";
import { formatBarSeconds, formatShareOfTime, formatSpPerSecond, type SpGainRow, spSustainViewOf } from "./sp-sustain-view-model.ts";
import { t } from "./text/ui-text.ts";

interface SpSustainCardProps {
    /** What the shown build's SP sustain rests on; `undefined` while it is calculated or when it cannot be, `null` when its attack never kills. */
    readonly basis: SpSustainBasis | null | undefined;
    readonly chances: SpEffectChances | undefined;
    readonly active: ActiveSpEffects | undefined;
    /** Sets the chance for a source; `null` goes back to the one its wording gives or the one assumed. */
    onChanceCommit(source: SpEffectSource, percent: number | null): void;
    /** Counts the state a source sets off as on all the time, or again on average. */
    onActiveChange(source: SpEffectSource, isActive: boolean): void;
}

type ChangeHandlers = Pick<SpSustainCardProps, "onChanceCommit" | "onActiveChange">;

const originLabels: Readonly<Record<ChanceOrigin, string>> = { wording: t("記載どおり"), yours: t("あなたの設定"), assumed: t("仮定") };

/**
 * How the build's SP holds up using its attack again and again: what one
 * use costs, what comes back and from where, and how long a full bar lasts.
 * The chance of an effect that happens by chance is the user's to set, and
 * a state an attack sets off counts on average or, switched on, all the time.
 */
export function SpSustainCard({ basis, chances, active, ...handlers }: SpSustainCardProps) {
    return (
        <section className="card build-card effects-card sp-card" aria-label={t("SP 持続")}>
            <div className="effects-head">
                <span className="eyebrow">{t("SP 持続")}</span>
            </div>
            {basis === undefined ? (
                <p className="empty-note">{t("計算が終わると表示します。")}</p>
            ) : basis === null ? (
                <p className="empty-note">{t("この攻撃では倒せないため、使う速さが分かりません。")}</p>
            ) : (
                <SpSustainDetails sustain={spSustainFrom(basis, spSustainSettingsOf(chances, active))} handlers={handlers} />
            )}
        </section>
    );
}

function SpSustainDetails({ sustain, handlers }: { sustain: SpSustain; handlers: ChangeHandlers }) {
    const view = spSustainViewOf(sustain);
    return (
        <>
            <div className="sp-summary" data-testid="sp-summary">
                <b className="sp-bar num">{view.fullBar === null ? t("SP が減りません") : t("{0} 秒 · {1} 回", formatBarSeconds(view.fullBar.seconds), Math.floor(view.fullBar.uses))}</b>
                <small>{view.fullBar === null ? t("回復が消費に追いつきます") : t("満タンから使い切るまで")}</small>
                <span className="sp-rates num">{t("1 回 {0} SP · 毎秒 {1} 回", view.spCostPerUse, view.usesPerSecond.toFixed(2))}</span>
                <span className="sp-rates num">
                    {t("消費 {0} · 回復 {1} · 差引 {2} SP/秒", formatSpPerSecond(view.spentPerSecond), formatSpPerSecond(view.gainedPerSecond), formatSpPerSecond(view.netPerSecond))}
                </span>
            </div>
            <details className="effects-group" open>
                <summary>
                    {t("SP 回復")} <span className="num">{view.gainRows.length}</span>
                </summary>
                {view.gainRows.length === 0 ? (
                    <p className="empty-note">{t("SP が戻る効果はありません。")}</p>
                ) : (
                    view.gainRows.map((row) => <SpGainLine key={row.key} row={row} handlers={handlers} />)
                )}
            </details>
            {view.uncountedRows.length > 0 && (
                <details className="effects-group">
                    <summary>
                        {t("計算に入っていない効果")} <span className="num">{view.uncountedRows.length}</span>
                    </summary>
                    {view.uncountedRows.map((row) => (
                        <div key={row.key} className="effect-source">
                            <div className="effect-source-head">
                                <b>{row.name}</b>
                                <small>{slotLabels[row.slot]}</small>
                                <CopyButton text={[row.name, row.line].join("\n")} label={t("効果をコピー")} />
                            </div>
                            <div className="effect-source-line">{row.line}</div>
                        </div>
                    ))}
                </details>
            )}
        </>
    );
}

function SpGainLine({ row, handlers }: { row: SpGainRow; handlers: ChangeHandlers }) {
    const { chance, state } = row;
    const isOn = state !== null && state.onBecause !== null;
    return (
        <div className="effect-source sp-gain">
            <div className="effect-source-head">
                <b>{row.name ?? t("自然回復")}</b>
                {row.slot !== null && <small>{slotLabels[row.slot]}</small>}
                <span style={{ flex: 1 }} />
                <span className="num sp-gain-amount">{t("+{0} SP/秒", formatSpPerSecond(row.perSecond))}</span>
            </div>
            {row.line !== null && <div className="effect-source-line">{row.line}</div>}
            {state !== null && (
                <div className="sp-state num">
                    {isOn ? t("発動中として計算 · +{0} SP/秒", formatSpPerSecond(state.perSecondWhileOn)) : t("発動率 {0} · 発動中 +{1} SP/秒", formatShareOfTime(state.shareOfTimeOn), formatSpPerSecond(state.perSecondWhileOn))}
                </div>
            )}
            {state !== null && (
                <label className="sp-active">
                    <input
                        type="checkbox"
                        checked={isOn}
                        disabled={state.onBecause === "timedItem"}
                        onChange={(event) => handlers.onActiveChange(state.source, event.target.checked)}
                    />
                    {t("発動中")}
                    {state.onBecause === "timedItem" && <small className="sp-chance-origin">{t("時限効果で発動中")}</small>}
                </label>
            )}
            {chance !== null && !isOn && (
                <div className="sp-chance">
                    <span>{t("確率")}</span>
                    <CommittedNumberField
                        value={chance.percent}
                        lowest={0}
                        highest={100}
                        allowsEmpty
                        allowsDecimals
                        ariaLabel={t("{0} の確率", row.name ?? "")}
                        onCommit={(percent) => handlers.onChanceCommit(chance.source, percent)}
                    />
                    <span>%</span>
                    <small className={`sp-chance-origin ${chance.origin}`}>{originLabels[chance.origin]}</small>
                </div>
            )}
        </div>
    );
}
