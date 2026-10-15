import { useRef, useState } from "react";
import { ApplyToLockerButton } from "./ApplyToLockerButton.tsx";
import { type Baseline, comparisonOf } from "./compare-model.ts";
import { EffectsSection, GearSection, MetricCards, PairPicker, PathSection, StatsSection } from "./CompareParts.tsx";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "./Icons.tsx";
import type { TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

interface CompareSheetProps {
    readonly workspace: TreeWorkspace;
    /** The node being looked at. */
    readonly nodeId: string;
    onClose(): void;
}

const jumpTargets = [
    ["compare-gear", t("装備")],
    ["compare-stats", t("ステータス")],
    ["compare-effects", t("効果")],
    ["compare-path", t("経路")],
] as const;

/** Compare on a phone: a bottom sheet over whichever screen is open. */
export function CompareSheet({ workspace, nodeId, onClose }: CompareSheetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [baseline, setBaseline] = useState<Baseline>("root");
    const [isSwapped, setIsSwapped] = useState(false);
    const body = useRef<HTMLDivElement>(null);
    const comparison = comparisonOf(workspace, nodeId, baseline, isSwapped);

    if (comparison === null) {
        return null;
    }

    return (
        <>
            <button type="button" className="scrim" aria-label={t("閉じる")} onClick={onClose} />
            <section role="dialog" aria-label={t("比較")} className={`sheet ${isExpanded ? "expanded" : ""}`}>
                <div className="sheet-grip">
                    <span />
                </div>
                <div style={{ display: "flex", alignItems: "center", padding: "2px 4px 0 16px" }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>{t("比較")}</h2>
                    <button type="button" className="ib" aria-label={isExpanded ? t("縮小") : t("展開")} onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />}
                    </button>
                    <button type="button" className="ib" aria-label={t("閉じる")} onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>
                <div style={{ padding: "4px 16px 12px" }}>
                    <PairPicker comparison={comparison} baseline={baseline} onChangeBaseline={setBaseline} onSwap={() => setIsSwapped(!isSwapped)} />
                </div>

                <div className="scroll" ref={body}>
                    <div style={{ padding: "0 16px 14px" }}>
                        <MetricCards comparison={comparison} />
                    </div>
                    <nav className="jumps" aria-label={t("セクション")}>
                        {jumpTargets.map(([sectionId, label]) => (
                            <button
                                key={sectionId}
                                type="button"
                                className="jump"
                                onClick={() => body.current?.querySelector(`#${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                    <div className="sheet-body">
                        <div id="compare-gear">
                            <GearSection comparison={comparison} descriptions={workspace.descriptions} />
                        </div>
                        <div id="compare-stats" className="sheet-section">
                            <StatsSection comparison={comparison} />
                        </div>
                        <div id="compare-effects" className="sheet-section">
                            <EffectsSection comparison={comparison} descriptions={workspace.descriptions} />
                        </div>
                        <div id="compare-path" className="sheet-section">
                            <PathSection comparison={comparison} />
                            <ApplyToLockerButton workspace={workspace} nodeId={nodeId} />
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
