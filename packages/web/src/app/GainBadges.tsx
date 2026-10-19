import { useState } from "react";
import { loadGainDisplay, storeGainDisplay } from "../storage/workspace-store.ts";
import { formatSignedPercent, formatSignedSeconds } from "./format.ts";
import { type Gain, type GainDisplay, gainDisplays, type RowGains } from "./tree-view-model.ts";
import { t } from "./text/ui-text.ts";

const gainDisplayLabels: Readonly<Record<GainDisplay, string>> = { total: t("合計"), step: t("個別"), both: t("両方") };

/** The change the tree shows per node, remembered in this browser. Both, when nothing was chosen yet. */
export function useGainDisplay(): [GainDisplay, (gainDisplay: GainDisplay) => void] {
    const [gainDisplay, setGainDisplay] = useState<GainDisplay>(() => gainDisplays.find((candidate) => candidate === loadGainDisplay()) ?? "both");
    return [
        gainDisplay,
        (chosen) => {
            setGainDisplay(chosen);
            storeGainDisplay(chosen);
        },
    ];
}

export function GainDisplaySwitch({ value, onChange }: { value: GainDisplay; onChange(gainDisplay: GainDisplay): void }) {
    return (
        <div className="seg" role="group" aria-label={t("差分の表示")}>
            {gainDisplays.map((gainDisplay) => (
                <button key={gainDisplay} type="button" aria-pressed={value === gainDisplay} onClick={() => onChange(gainDisplay)}>
                    {gainDisplayLabels[gainDisplay]}
                </button>
            ))}
        </div>
    );
}

interface GainBadgesProps {
    readonly gains: RowGains;
    readonly display: GainDisplay;
    readonly metric: "damagePerSecond" | "secondsToKill";
    /** One above the other, for a narrow table column; side by side otherwise. */
    readonly isStacked?: boolean;
    readonly isWide?: boolean;
}

/** A node's change in one metric: against the root as a filled badge, against its parent as an outlined one. */
export function GainBadges({ gains, display, metric, isStacked = false, isWide = false }: GainBadgesProps) {
    const shown = (["total", "step"] as const).filter((kind) => display === "both" || display === kind);
    return (
        <span className={`gain-badges ${isStacked ? "stacked" : ""}`}>
            {shown.map((kind) => (
                <GainBadge key={kind} gain={gains[kind]} metric={metric} isStep={kind === "step"} isWide={isWide} />
            ))}
        </span>
    );
}

function GainBadge({ gain, metric, isStep, isWide }: { gain: Gain | null; metric: GainBadgesProps["metric"]; isStep: boolean; isWide: boolean }) {
    const shown = gain === null ? null : metric === "damagePerSecond" ? damagePerSecondText(gain) : secondsToKillText(gain);
    return (
        <span className={`badge num ${isWide ? "wide" : ""} ${isStep ? "parent-gain" : ""} ${shown?.direction ?? "flat"}`} title={isStep ? t("親ノードとの差") : t("ROOT との差")}>
            {shown?.text ?? "—"}
        </span>
    );
}

type ShownChange = { readonly text: string; readonly direction: "good" | "bad" | "flat" };

function damagePerSecondText({ damagePerSecondChange: change, damagePerSecondBase }: Gain): ShownChange {
    return {
        text: `${change > 0 ? "▲ " : change < 0 ? "▼ " : ""}${formatSignedPercent(change, damagePerSecondBase)}`,
        direction: change > 0 ? "good" : change < 0 ? "bad" : "flat",
    };
}

function secondsToKillText({ secondsToKillChange: change }: Gain): ShownChange | null {
    if (change === null) {
        return null;
    }
    return { text: `${change < 0 ? "▼ " : change > 0 ? "▲ " : ""}${formatSignedSeconds(change)}`, direction: change < 0 ? "good" : change > 0 ? "bad" : "flat" };
}
