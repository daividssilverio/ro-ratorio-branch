import type { ReadyNodeEvaluation } from "@ro-ratorio-branch/core/platform-neutral";
import { useEffect, useState } from "react";
import type { BonusAtValue, Descriptions } from "../engine-host/host-protocol.ts";
import { CopyButton } from "./CopyButton.tsx";
import { type BonusRow, bonusRowsOf, type EffectChange, type EffectSource, effectSourcesOf } from "./effects-view-model.ts";
import { formatInteger } from "./format.ts";
import { slotLabels } from "./labels.ts";
import { t } from "./text/ui-text.ts";
import { engineHost } from "./use-tree-workspace.ts";

interface EffectsCardProps {
    /** The build shown; `null` while it is calculated or when it cannot be. */
    readonly evaluation: ReadyNodeEvaluation | null;
    /** The build a node builds on, to compare with; `null` for the root. */
    readonly parent: { readonly label: string; readonly evaluation: ReadyNodeEvaluation } | null;
    readonly descriptions: Descriptions;
}

const changeLabels: Readonly<Record<Exclude<EffectChange, "same">, string>> = { added: t("追加"), changed: t("変化"), lost: t("消失") };

/**
 * What the build's gear adds up to, as the engine counts it, and what each
 * piece, card, enchant and option does. On a node, both are set against the
 * build it builds on: what came, what changed and what went.
 */
export function EffectsCard({ evaluation, parent, descriptions }: EffectsCardProps) {
    const [showsOnlyChanges, setShowsOnlyChanges] = useState(false);
    const bonusRows = evaluation === null ? [] : bonusRowsOf(evaluation.statSnapshot.bonuses, parent?.evaluation.statSnapshot.bonuses ?? null);
    const wordings = useBonusWordings(bonusRows);
    const sources = evaluation === null ? [] : effectSourcesOf(evaluation, parent?.evaluation ?? null, descriptions);
    // A bonus upstream cannot put into words is a sum of IDs, not an amount; it is left out once the frame says so.
    const shownRows = bonusRows.filter((row) => (!showsOnlyChanges || row.change !== "same") && wordings.get(wordingKeyOf(row)) !== "");
    const shownSources = showsOnlyChanges ? sources.filter((source) => source.change !== "same") : sources;

    return (
        <section className="card build-card effects-card" aria-label={t("効果 · ボーナス")}>
            <div className="effects-head">
                <span className="eyebrow">{t("効果 · ボーナス")}</span>
                {parent !== null && <span className="effects-against">{t("{0} と比べて", parent.label)}</span>}
                <span style={{ flex: 1 }} />
                {parent !== null && (
                    <label className="effects-only-changes">
                        <input type="checkbox" checked={showsOnlyChanges} onChange={(event) => setShowsOnlyChanges(event.target.checked)} />
                        {t("変化のみ")}
                    </label>
                )}
            </div>
            {evaluation === null ? (
                <p className="empty-note">{t("計算が終わると表示します。")}</p>
            ) : (
                <>
                    <details className="effects-group" open>
                        <summary>
                            {t("ボーナス合計")} <span className="num">{shownRows.length}</span>
                        </summary>
                        {shownRows.length === 0 ? (
                            <p className="empty-note">{t("変化はありません。")}</p>
                        ) : (
                            <ul className="effects-list">
                                {shownRows.map((row) => (
                                    <BonusLine key={row.name} row={row} wording={wordings.get(wordingKeyOf(row)) ?? ""} />
                                ))}
                            </ul>
                        )}
                    </details>
                    <details className="effects-group">
                        <summary>
                            {t("装備ごとの効果")} <span className="num">{shownSources.length}</span>
                        </summary>
                        {shownSources.length === 0 ? (
                            <p className="empty-note">{t("変化はありません。")}</p>
                        ) : (
                            <EffectSourceList sources={shownSources} showsSlots />
                        )}
                    </details>
                </>
            )}
        </section>
    );
}

/** What each source does, one after the other, with what came and what went marked. */
export function EffectSourceList({ sources, showsSlots }: { sources: readonly EffectSource[]; showsSlots: boolean }) {
    return (
        <>
            {sources.map((source) => (
                <div key={source.key} className={`effect-source ${source.change} ${source.kind}`}>
                    <div className="effect-source-head">
                        <ChangeMark change={source.change} />
                        <b>{source.name}</b>
                        {showsSlots && <small>{slotLabels[source.slot]}</small>}
                        {source.kind === "itemSet" && <span className="effect-tag">{t("セット")}</span>}
                        <CopyButton text={[source.name, ...source.lines].join("\n")} label={t("効果をコピー")} />
                    </div>
                    {source.lines.map((line, index) => (
                        <div key={index} className="effect-source-line">
                            {line}
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

function BonusLine({ row, wording }: { row: BonusRow; wording: string }) {
    return (
        <li className={`effect-row ${row.change}`}>
            <ChangeMark change={row.change} />
            {wording === "" ? <span className="mono effect-text">{`${row.name} ${formatInteger(row.value)}`}</span> : <span className="effect-text">{wording}</span>}
            {row.name.endsWith("_FOR_SET") && <span className="effect-tag">{t("セット")}</span>}
            {row.change === "changed" && row.before !== null && (
                <span className="num effect-before">
                    {formatInteger(row.before)} → {formatInteger(row.value)}
                </span>
            )}
        </li>
    );
}

function ChangeMark({ change }: { change: EffectChange }) {
    return change === "same" ? null : <span className={`effect-mark ${change}`}>{changeLabels[change]}</span>;
}

const wordingKeyOf = ({ name, value }: BonusAtValue) => `${name}=${value}`;

/** Wordings already asked for, kept for the page's life: a bonus at a value always reads the same. */
const knownWordings = new Map<string, string>();

/** The rows' bonuses in upstream's words, asked of the engine frame once each; missing until it answers. */
function useBonusWordings(rows: readonly BonusRow[]): ReadonlyMap<string, string> {
    const [, setAnswered] = useState(0);
    const asked = rows.map(({ name, value }) => ({ name, value })).filter((bonus) => !knownWordings.has(wordingKeyOf(bonus)));
    const askedKey = JSON.stringify(asked);

    useEffect(() => {
        const bonuses = JSON.parse(askedKey) as BonusAtValue[];
        if (bonuses.length === 0) {
            return;
        }
        let isLatest = true;
        void engineHost()
            .then((host) => host.wordBonuses(bonuses))
            .then((wordings) => {
                bonuses.forEach((bonus, index) => knownWordings.set(wordingKeyOf(bonus), wordings[index] ?? ""));
                if (isLatest) {
                    setAnswered((answers) => answers + 1);
                }
            })
            .catch(() => undefined);
        return () => {
            isLatest = false;
        };
    }, [askedKey]);

    return knownWordings;
}
