import {
    addBranchToTree,
    applyGearLoadout,
    applyStatLoadout,
    baseStatNames,
    gearLoadoutChanges,
    removeGearLoadout,
    removeStatLoadout,
    renameGearLoadout,
    renameStatLoadout,
    saveGearLoadout,
    saveStatLoadout,
    statLoadoutChanges,
    type WorkspaceChange,
} from "@ro-ratorio-branch/core/platform-neutral";
import { type FormEvent, type ReactNode, useState } from "react";
import { CommittedTextField } from "./CommittedFields.tsx";
import { CloseIcon } from "./Icons.tsx";
import type { TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

type LoadoutNotice = "branchAdded" | "nothingDiffers";

const noticeTexts: Readonly<Record<LoadoutNotice, string>> = {
    branchAdded: t("ツリーに分岐を追加しました"),
    nothingDiffers: t("現在のビルドと同じなので、分岐は追加していません"),
};

/** Saved gear sets and stat allocations of the workspace: keep the current one, put one on, or try one as a branch of the open tree. */
export function LoadoutsCard({ workspace, characterId }: { workspace: TreeWorkspace; characterId: string }) {
    const [notice, setNotice] = useState<LoadoutNotice | null>(null);
    const { gearLoadouts = {}, statLoadouts = {} } = workspace.workspace;

    function addAsBranch(label: string, changes: readonly WorkspaceChange[]) {
        if (changes.length === 0) {
            setNotice("nothingDiffers");
            return;
        }
        workspace.takeWorkspace(addBranchToTree(workspace.workspace, workspace.activeTreeId, label, changes).workspace, workspace.activeTreeId);
        setNotice("branchAdded");
    }

    return (
        <section className="card build-card" data-testid="loadouts">
            <h2>
                {t("ロードアウト")} <small>Loadouts</small>
            </h2>

            <span className="eyebrow">{t("装備")}</span>
            {Object.entries(gearLoadouts).map(([loadoutId, loadout]) => (
                <LoadoutRow
                    key={loadoutId}
                    name={loadout.name}
                    summary={t("{0} 部位", Object.keys(loadout.equipment).length)}
                    onApply={() => workspace.updateWorkspace(applyGearLoadout(workspace.workspace, characterId, loadoutId))}
                    onBranch={() => addAsBranch(loadout.name, gearLoadoutChanges(workspace.workspace, characterId, loadoutId))}
                    onRename={(name) => workspace.updateWorkspace(renameGearLoadout(workspace.workspace, loadoutId, name))}
                    onRemove={() => workspace.updateWorkspace(removeGearLoadout(workspace.workspace, loadoutId))}
                />
            ))}
            <SaveLoadoutForm
                placeholder={t("現在の装備に名前を付けて保存")}
                onSave={(name) => workspace.updateWorkspace(saveGearLoadout(workspace.workspace, characterId, name).workspace)}
            />

            <span className="eyebrow">{t("ステータス")}</span>
            {Object.entries(statLoadouts).map(([loadoutId, loadout]) => (
                <LoadoutRow
                    key={loadoutId}
                    name={loadout.name}
                    summary={baseStatNames.map((statName) => loadout.baseStats[statName]).join("·")}
                    onApply={() => workspace.updateWorkspace(applyStatLoadout(workspace.workspace, characterId, loadoutId))}
                    onBranch={() => addAsBranch(loadout.name, statLoadoutChanges(workspace.workspace, characterId, loadoutId))}
                    onRename={(name) => workspace.updateWorkspace(renameStatLoadout(workspace.workspace, loadoutId, name))}
                    onRemove={() => workspace.updateWorkspace(removeStatLoadout(workspace.workspace, loadoutId))}
                />
            ))}
            <SaveLoadoutForm
                placeholder={t("現在のステータスに名前を付けて保存")}
                onSave={(name) => workspace.updateWorkspace(saveStatLoadout(workspace.workspace, characterId, name).workspace)}
            />

            <div className="share-notice" role="status">
                {notice !== null && noticeTexts[notice]}
            </div>
        </section>
    );
}

interface LoadoutRowProps {
    readonly name: string;
    readonly summary: ReactNode;
    onApply(): void;
    onBranch(): void;
    onRename(name: string): void;
    onRemove(): void;
}

function LoadoutRow({ name, summary, onApply, onBranch, onRename, onRemove }: LoadoutRowProps) {
    return (
        <div className="loadout-row" data-testid="loadout-row">
            <span className="lrow-name">
                <span className="loadout-name">
                    <CommittedTextField value={name} ariaLabel={t("ロードアウト名")} onCommit={(nextName) => nextName.trim() !== "" && onRename(nextName.trim())} />
                </span>
                <span className="piece-status num">{summary}</span>
            </span>
            <button type="button" className="btn compact" onClick={onApply}>
                {t("適用")}
            </button>
            <button type="button" className="btn compact" onClick={onBranch}>
                {t("分岐に追加")}
            </button>
            <button type="button" className="ib small" aria-label={t("{0} を削除", name)} onClick={onRemove}>
                <CloseIcon size={15} />
            </button>
        </div>
    );
}

function SaveLoadoutForm({ placeholder, onSave }: { placeholder: string; onSave(name: string): void }) {
    const [name, setName] = useState("");

    function save(event: FormEvent) {
        event.preventDefault();
        if (name.trim() !== "") {
            onSave(name.trim());
            setName("");
        }
    }

    return (
        <form className="loadout-save" onSubmit={save}>
            <input className="text-field" aria-label={placeholder} placeholder={placeholder} value={name} onChange={(event) => setName(event.target.value)} />
            <button type="submit" className="btn compact" disabled={name.trim() === ""}>
                {t("保存")}
            </button>
        </form>
    );
}
