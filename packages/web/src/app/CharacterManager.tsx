import { removeCharacters, removeTree } from "@ro-ratorio-branch/core/platform-neutral";
import { useEffect, useState } from "react";
import { type ManagedCharacter, managedCharactersOf, treeToOpenAfterRemoval } from "./character-manager-model.ts";
import { formatInteger } from "./format.ts";
import { ConfirmedAction } from "./NodeActions.tsx";
import { Overlay } from "./Overlay.tsx";
import { t } from "./text/ui-text.ts";
import { engineHost, type TreeWorkspace } from "./use-tree-workspace.ts";

interface CharacterManagerProps {
    readonly workspace: TreeWorkspace;
    onClose(): void;
}

/**
 * Every character and its trees, to open one or clear several out at once:
 * imported builds each bring a character, and they pile up. Removing goes
 * through the workspace's history, so it can be undone.
 */
export function CharacterManager({ workspace, onClose }: CharacterManagerProps) {
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
    const characters = managedCharactersOf(workspace.workspace, workspace.activeTreeId);
    const jobNames = useJobNames(characters.map((character) => character.jobId));
    const selected = characters.filter((character) => selectedIds.has(character.id));
    const removalOfSelected = selected.length === 0 ? undefined : removeCharacters(workspace.workspace, selected.map((character) => character.id));
    const removedTreeCount = removalOfSelected?.removedTreeIds.length ?? 0;

    function take(removedFrom: TreeWorkspace["workspace"]) {
        const treeToOpen = treeToOpenAfterRemoval(removedFrom, workspace.activeTreeId);
        if (treeToOpen !== undefined) {
            workspace.takeWorkspace(removedFrom, treeToOpen);
        }
    }

    function toggle(characterId: string) {
        const next = new Set(selectedIds);
        if (!next.delete(characterId)) {
            next.add(characterId);
        }
        setSelectedIds(next);
    }

    return (
        <Overlay title={t("キャラとツリー")} onClose={onClose}>
            <div className="overlay-body character-manager" data-testid="character-manager">
                {characters.map((character) => (
                    <CharacterEntry
                        key={character.id}
                        character={character}
                        jobName={jobNames[character.jobId] ?? `job #${character.jobId}`}
                        isSelected={selectedIds.has(character.id)}
                        onToggle={() => toggle(character.id)}
                        onOpenTree={(treeId) => {
                            workspace.openTree(treeId);
                            onClose();
                        }}
                        onRemoveTree={(treeId) => {
                            const removal = removeTree(workspace.workspace, treeId);
                            if (removal !== undefined) {
                                take(removal.workspace);
                            }
                        }}
                        canRemoveTree={(treeId) => removeTree(workspace.workspace, treeId) !== undefined}
                    />
                ))}
                <div className="character-manager-foot">
                    <ConfirmedAction
                        key={[...selectedIds].join(",")}
                        label={t("選択したキャラを削除 ({0})", selected.length)}
                        explanation={t("{0} 人のキャラと、そのツリー {1} 件を削除します。ロッカーの装備はそのまま残ります。「元に戻す」で戻せます。", selected.length, removedTreeCount)}
                        confirmLabel={t("削除する")}
                        testId="remove-selected-characters"
                        isDisabled={removalOfSelected === undefined}
                        onConfirm={() => {
                            if (removalOfSelected !== undefined) {
                                setSelectedIds(new Set());
                                take(removalOfSelected.workspace);
                            }
                        }}
                    />
                    {selected.length > 0 && removalOfSelected === undefined && <p className="empty-note">{t("ツリーが 1 つは残るようにしてください。")}</p>}
                </div>
            </div>
        </Overlay>
    );
}

interface CharacterEntryProps {
    readonly character: ManagedCharacter;
    readonly jobName: string;
    readonly isSelected: boolean;
    onToggle(): void;
    onOpenTree(treeId: string): void;
    onRemoveTree(treeId: string): void;
    canRemoveTree(treeId: string): boolean;
}

function CharacterEntry({ character, jobName, isSelected, onToggle, onOpenTree, onRemoveTree, canRemoveTree }: CharacterEntryProps) {
    return (
        <section className={`character-entry${isSelected ? " selected" : ""}`} aria-label={character.name}>
            <label className="character-entry-head">
                <input type="checkbox" checked={isSelected} onChange={onToggle} aria-label={t("{0} を選択", character.name)} />
                <b>{character.name}</b>
                <small className="num">
                    {jobName} · Lv {character.baseLevel}
                </small>
            </label>
            {character.trees.length === 0 ? (
                <p className="empty-note">{t("ツリーはありません。")}</p>
            ) : (
                character.trees.map((tree) => (
                    <div key={tree.id} className="character-entry-tree">
                        <span className="character-entry-tree-name">
                            {tree.name} <small className="num">{t("{0} ノード", formatInteger(tree.nodeCount))}</small>
                        </span>
                        {tree.isOpen ? (
                            <small className="character-entry-open">{t("表示中")}</small>
                        ) : (
                            <button type="button" className="btn" onClick={() => onOpenTree(tree.id)}>
                                {t("開く")}
                            </button>
                        )}
                        <ConfirmedAction
                            label={t("ツリーを削除")}
                            explanation={
                                character.trees.length === 1
                                    ? t("{0} は {1} の最後のツリーなので、キャラも一緒に削除します。「元に戻す」で戻せます。", tree.name, character.name)
                                    : t("{0} を削除します。「元に戻す」で戻せます。", tree.name)
                            }
                            confirmLabel={t("削除する")}
                            testId={`remove-tree-${tree.id}`}
                            isDisabled={!canRemoveTree(tree.id)}
                            onConfirm={() => onRemoveTree(tree.id)}
                        />
                    </div>
                ))
            )}
        </section>
    );
}

/** The names of the jobs, asked of the engine frame; an ID is missing until it answers. */
function useJobNames(jobIds: readonly number[]): Readonly<Record<number, string>> {
    const [jobNames, setJobNames] = useState<Readonly<Record<number, string>>>({});
    const askedKey = [...new Set(jobIds)].sort((one, other) => one - other).join(",");

    useEffect(() => {
        let isLatest = true;
        const asked = askedKey === "" ? [] : askedKey.split(",").map(Number);
        void engineHost()
            .then((host) => host.describe({ jobIds: asked, skillIds: [], monsterIds: [], itemIds: [], cardOrEnchantIds: [] }))
            .then((descriptions) => isLatest && setJobNames(descriptions.jobNames))
            .catch(() => undefined);
        return () => {
            isLatest = false;
        };
    }, [askedKey]);

    return jobNames;
}
