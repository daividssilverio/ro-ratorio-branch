import type { Scenario } from "@ro-ratorio-branch/core/platform-neutral";
import { useState } from "react";
import type { JobSettings } from "../engine-host/host-protocol.ts";
import { Overlay } from "./Overlay.tsx";
import { SettingRows } from "./SettingRows.tsx";
import { rowsOfPlaces, shownRowsOf, targetSettingPlaces } from "./settings-editor-model.ts";
import { t } from "./text/ui-text.ts";

interface TargetSettingsEditorProps {
    readonly scenario: Scenario;
    /** `null` while the settings load. */
    readonly jobSettings: JobSettings | null;
    onChange(scenario: Scenario): void;
    onClose(): void;
}

/** The original's monster settings for the scenario's target: taken as a player, ailments on it, and its own buffs. */
export function TargetSettingsEditor({ scenario, jobSettings, onChange, onClose }: TargetSettingsEditorProps) {
    const [query, setQuery] = useState("");
    const [showsOnlySet, setShowsOnlySet] = useState(false);
    const rows = jobSettings === null ? [] : shownRowsOf(rowsOfPlaces(jobSettings, targetSettingPlaces), scenario, query, showsOnlySet);

    return (
        <Overlay title={t("モンスター設定")} onClose={onClose}>
            <div className="picker-top">
                <input className="text-field" type="search" aria-label={t("名前で検索")} placeholder={t("名前で検索（ひらがな可）")} value={query} onChange={(event) => setQuery(event.target.value)} />
                <label className="check-label compact">
                    <input type="checkbox" checked={showsOnlySet} onChange={(event) => setShowsOnlySet(event.target.checked)} />
                    {t("設定済みだけ表示")}
                </label>
            </div>
            <div className="settings-list" data-testid="target-settings-list">
                {jobSettings === null && <p className="empty-note">{t("読み込み中…")}</p>}
                {jobSettings !== null && rows.length === 0 && <p className="empty-note">{t("該当する項目がありません。")}</p>}
                <SettingRows rows={rows} holder={scenario} onChange={onChange} />
            </div>
        </Overlay>
    );
}
