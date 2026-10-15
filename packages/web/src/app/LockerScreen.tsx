import { addLockerPiece, type EquipmentSlot, equipmentSlots, type GearPiece } from "@ro-ratorio-branch/core/platform-neutral";
import { useState } from "react";
import { formatZeny } from "./format.ts";
import { GearPieceEditor } from "./GearPieceEditor.tsx";
import { PlusIcon, WarningIcon } from "./Icons.tsx";
import { cardOrEnchantNameIn, itemNameIn, slotGlyphs, slotLabels, slotsLabel } from "./labels.ts";
import { type LockerFilter, type LockerRow, lockerRowsOf, type SlotGroup, slotGroupNames } from "./locker-view-model.ts";
import { Overlay } from "./Overlay.tsx";
import { Picker } from "./Picker.tsx";
import { rowsMatching } from "./picker-model.ts";
import { GearListingDialog } from "./GearListingDialog.tsx";
import { RightsFooter } from "./RightsFooter.tsx";
import { useWorkspaceGearData, type WorkspaceGearData } from "./use-engine-data.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

const slotGroupLabels: Readonly<Record<SlotGroup, string>> = {
    weapon: t("武器"),
    head: t("頭"),
    armor: t("鎧"),
    shield: t("盾"),
    garment: t("肩"),
    shoes: t("靴"),
    accessory: t("アクセ"),
    shadow: t("シャドウ"),
};

const everything: LockerFilter = { characterId: null, slotGroup: null };

/** The gear locker: every piece the user owns or is considering, who uses it, and an editor for the selected one. */
export function LockerScreen({ workspace, isWide }: { workspace: TreeWorkspace; isWide: boolean }) {
    const gearData = useWorkspaceGearData(workspace.workspace);
    const [filter, setFilter] = useState<LockerFilter>(everything);
    const [nameQuery, setNameQuery] = useState("");
    const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    const { characters, gearPieces } = workspace.workspace;
    const rowsFor = (rowFilter: LockerFilter) => lockerRowsOf(workspace.workspace, gearData.gearFacts, rowFilter);
    const rows = rowsMatching(rowsFor(filter), (row) => `${itemNameIn(gearData.descriptions, row.lockerPiece.itemId)} ${row.lockerPiece.note ?? ""}`, nameQuery);
    const selectedPiece = selectedPieceId !== null && Object.hasOwn(gearPieces, selectedPieceId) ? selectedPieceId : null;
    const openCharacter = characters[workspace.workspace.trees[workspace.activeTreeId]?.characterId ?? ""];

    const characterFilters = [
        { characterId: null, label: t("全キャラ") },
        ...Object.entries(characters).map(([characterId, character]) => ({ characterId, label: character.name })),
    ];
    const loadoutFilters = Object.entries(workspace.workspace.gearLoadouts ?? {}).map(([gearLoadoutId, loadout]) => ({ gearLoadoutId, label: loadout.name }));
    const toggledLoadout = (gearLoadoutId: string): LockerFilter => ({ ...filter, gearLoadoutId: filter.gearLoadoutId === gearLoadoutId ? null : gearLoadoutId });
    const slotFilters: { slotGroup: SlotGroup | null; label: string }[] = [
        { slotGroup: null, label: t("すべて") },
        ...slotGroupNames.map((slotGroup) => ({ slotGroup, label: slotGroupLabels[slotGroup] })),
    ];

    const addGearPicker = isAdding && openCharacter !== undefined && (
        <AddGearPicker
            jobId={openCharacter.jobId}
            wearerName={openCharacter.name}
            onClose={() => setIsAdding(false)}
            onPick={(slot, itemId) => {
                const added = addLockerPiece(workspace.workspace, { itemId, owned: false }, slot);
                workspace.updateWorkspace(added.workspace);
                setSelectedPieceId(added.gearPieceId);
                setIsAdding(false);
            }}
            onPickListedPiece={(gearPiece, slotOfItem) => {
                const added = addLockerPiece(workspace.workspace, { ...gearPiece, owned: false }, slotOfItem ?? "piece");
                workspace.updateWorkspace(added.workspace);
                setSelectedPieceId(added.gearPieceId);
                setIsAdding(false);
            }}
        />
    );
    const editor = selectedPiece !== null && (
        <GearPieceEditor workspace={workspace} gearPieceId={selectedPiece} gearData={gearData} onRemoved={() => setSelectedPieceId(null)} />
    );

    if (isWide) {
        return (
            <main className="wide-main locker-main">
                <aside className="locker-aside">
                    <button type="button" className="btn btn-p" onClick={() => setIsAdding(true)}>
                        <PlusIcon />
                        {t("ギアを追加")}
                    </button>
                    <span className="eyebrow">{t("キャラクター")}</span>
                    {characterFilters.map(({ characterId, label }) => (
                        <button key={characterId ?? ""} type="button" className="fl" aria-pressed={filter.characterId === characterId} onClick={() => setFilter({ ...filter, characterId })}>
                            <span>{label}</span>
                            <span className="num">{rowsFor({ characterId, slotGroup: null }).length}</span>
                        </button>
                    ))}
                    <span className="eyebrow">{t("部位")}</span>
                    {slotFilters.map(({ slotGroup, label }) => (
                        <button key={slotGroup ?? ""} type="button" className="fl" aria-pressed={filter.slotGroup === slotGroup} onClick={() => setFilter({ ...filter, slotGroup })}>
                            <span>{label}</span>
                            <span className="num">{rowsFor({ characterId: filter.characterId, slotGroup }).length}</span>
                        </button>
                    ))}
                    {loadoutFilters.length > 0 && <span className="eyebrow">{t("ロードアウト")}</span>}
                    {loadoutFilters.map(({ gearLoadoutId, label }) => (
                        <button key={gearLoadoutId} type="button" className="fl" aria-pressed={filter.gearLoadoutId === gearLoadoutId} onClick={() => setFilter(toggledLoadout(gearLoadoutId))}>
                            <span>{label}</span>
                            <span className="num">{rowsFor({ characterId: null, slotGroup: null, gearLoadoutId }).length}</span>
                        </button>
                    ))}
                </aside>

                <section className="card locker-table">
                    <div className="locker-search">
                        <input className="text-field" type="search" aria-label={t("ギア検索")} placeholder={t("名前 · メモで検索")} value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
                    </div>
                    <div className="locker-rows">
                        <div className="lrow eyebrow">
                            <span />
                            <span>{t("ギア")}</span>
                            <span>{t("ソケット")}</span>
                            <span className="right">{t("価格")}</span>
                            <span className="right">{t("使用")}</span>
                        </div>
                        {rows.length === 0 && <p className="empty-note locker-empty">{t("該当するギアがありません。")}</p>}
                        {rows.map((row) => (
                            <button key={row.gearPieceId} type="button" className="lrow" aria-pressed={row.gearPieceId === selectedPiece} onClick={() => setSelectedPieceId(row.gearPieceId)}>
                                <SlotGlyph row={row} />
                                <span className="lrow-name">
                                    <PieceName row={row} gearData={gearData} />
                                    <PieceStatus row={row} workspace={workspace} gearData={gearData} />
                                </span>
                                <SocketMarks row={row} gearData={gearData} isShort />
                                <span className="num right">{row.lockerPiece.zenyCost === undefined ? "—" : formatZeny(row.lockerPiece.zenyCost)}</span>
                                <span className="num right">{usageText(row)}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <aside className="card locker-detail">{editor || <p className="empty-note">{t("ギアを選ぶと、ここで精錬・カード・価格・メモを編集できます。")}</p>}</aside>
                {addGearPicker}
            </main>
        );
    }

    return (
        <div className="screen">
            <header className="app-header">
                <h1 className="screen-title">
                    {t("ロッカー")} <small className="num">{Object.keys(gearPieces).length} {t("ギア")}</small>
                </h1>
                <button type="button" className="ib" aria-label={t("ギアを追加")} onClick={() => setIsAdding(true)}>
                    <PlusIcon />
                </button>
            </header>
            <div className="locker-filters">
                <div className="chips" role="group" aria-label={t("キャラクター")}>
                    {characterFilters.map(({ characterId, label }) => (
                        <button key={characterId ?? ""} type="button" className="chip" aria-pressed={filter.characterId === characterId} onClick={() => setFilter({ ...filter, characterId })}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="chips" role="group" aria-label={t("部位")}>
                    {slotFilters.map(({ slotGroup, label }) => (
                        <button key={slotGroup ?? ""} type="button" className="chip" aria-pressed={filter.slotGroup === slotGroup} onClick={() => setFilter({ ...filter, slotGroup })}>
                            {label}
                        </button>
                    ))}
                </div>
                {loadoutFilters.length > 0 && (
                    <div className="chips" role="group" aria-label={t("ロードアウト")}>
                        {loadoutFilters.map(({ gearLoadoutId, label }) => (
                            <button key={gearLoadoutId} type="button" className="chip" aria-pressed={filter.gearLoadoutId === gearLoadoutId} onClick={() => setFilter(toggledLoadout(gearLoadoutId))}>
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="scroll">
                <div className="locker-list">
                    {rows.length === 0 && <p className="empty-note">{t("該当するギアがありません。")}</p>}
                    {rows.map((row) => (
                        <button key={row.gearPieceId} type="button" className={`gp${row.wearersBarredByJob.length > 0 ? " barred" : ""}`} onClick={() => setSelectedPieceId(row.gearPieceId)}>
                            <span className="gp-top">
                                <SlotGlyph row={row} />
                                <span className="lrow-name">
                                    <PieceName row={row} gearData={gearData} />
                                    <PieceStatus row={row} workspace={workspace} gearData={gearData} />
                                </span>
                                {row.lockerPiece.zenyCost !== undefined && <span className="num gp-price">{formatZeny(row.lockerPiece.zenyCost)}</span>}
                            </span>
                            <SocketMarks row={row} gearData={gearData} isShort={false} />
                            {row.lockerPiece.note !== undefined && <span className="gp-note">{row.lockerPiece.note}</span>}
                        </button>
                    ))}
                </div>
                <RightsFooter />
            </div>
            {editor && (
                <Overlay title={t("ギア")} onClose={() => setSelectedPieceId(null)}>
                    <div className="overlay-body">{editor}</div>
                </Overlay>
            )}
            {addGearPicker}
        </div>
    );
}

function usageText(row: LockerRow): string {
    const parts = [
        ...(row.usage.characterIds.length > 0 ? [t("{0} キャラ", row.usage.characterIds.length)] : []),
        ...(row.usage.nodes.length > 0 ? [t("{0} ノード", row.usage.nodes.length)] : []),
    ];
    return parts.join(" · ") || "—";
}

function SlotGlyph({ row }: { row: LockerRow }) {
    const firstSlot = row.slots[0];
    return (
        <span className={`ico${row.wearersBarredByJob.length > 0 ? " barred" : ""}`} aria-hidden="true">
            {firstSlot === undefined ? "?" : slotGlyphs[firstSlot]}
        </span>
    );
}

function PieceName({ row, gearData }: { row: LockerRow; gearData: WorkspaceGearData }) {
    return (
        <b className="piece-name">
            {itemNameIn(gearData.descriptions, row.lockerPiece.itemId)}
            {(row.lockerPiece.refine ?? 0) > 0 && <span className="num"> +{row.lockerPiece.refine}</span>}
        </b>
    );
}

function PieceStatus({ row, workspace, gearData }: { row: LockerRow; workspace: TreeWorkspace; gearData: WorkspaceGearData }) {
    const { characters } = workspace.workspace;
    if (row.wearersBarredByJob.length > 0) {
        const barredJobNames = row.wearersBarredByJob.map((characterId) => {
            const jobId = characters[characterId]?.jobId ?? -1;
            return gearData.descriptions.jobNames[jobId] ?? characters[characterId]?.name ?? characterId;
        });
        return (
            <span className="piece-status barred">
                <WarningIcon size={13} />
                {barredJobNames.join("、")}{t("は装備できません（職業制限）")}
            </span>
        );
    }
    const wearerNames = row.usage.characterIds.map((characterId) => characters[characterId]?.name ?? characterId);
    const parts = [
        slotsLabel(row.slots) ?? `item #${row.lockerPiece.itemId}`,
        ...(row.lockerPiece.owned ? [] : [t("未所持 · 候補")]),
        ...((row.lockerPiece.randomOptions ?? []).some((randomOption) => randomOption !== null)
            ? [t("オプション {0}", (row.lockerPiece.randomOptions ?? []).filter((randomOption) => randomOption !== null).length)]
            : []),
        ...(wearerNames.length > 0 ? [t("{0} が装備中", wearerNames.join("、"))] : []),
        ...(row.usage.nodes.length > 0 ? [t("{0} ノードで使用", row.usage.nodes.length)] : []),
    ];
    return <span className="piece-status">{parts.join(" · ")}</span>;
}

function SocketMarks({ row, gearData, isShort }: { row: LockerRow; gearData: WorkspaceGearData; isShort: boolean }) {
    const sockets = row.lockerPiece.sockets ?? [];
    if (sockets.length === 0) {
        return isShort ? <span className="piece-status">—</span> : null;
    }
    return (
        <span className="minis">
            {sockets.map((cardOrEnchantId, socketIndex) => (
                <span key={socketIndex} className={`mini${cardOrEnchantId === null ? " e" : ""}`} title={cardOrEnchantId === null ? undefined : cardOrEnchantNameIn(gearData.descriptions, cardOrEnchantId)}>
                    {isShort || cardOrEnchantId === null ? `S${socketIndex + 1}${cardOrEnchantId === null && !isShort ? t(" 空き") : ""}` : cardOrEnchantNameIn(gearData.descriptions, cardOrEnchantId)}
                </span>
            ))}
        </span>
    );
}

interface AddGearPickerProps {
    readonly jobId: number;
    readonly wearerName: string;
    onPick(slot: EquipmentSlot, itemId: number): void;
    onPickListedPiece(gearPiece: GearPiece, slotOfItem: EquipmentSlot | undefined): void;
    onClose(): void;
}

function AddGearPicker({ jobId, wearerName, onPick, onPickListedPiece, onClose }: AddGearPickerProps) {
    const [slot, setSlot] = useState<EquipmentSlot>("rightHand");
    const [isPastingListing, setIsPastingListing] = useState(false);
    if (isPastingListing) {
        return <GearListingDialog title={t("出品テキストから追加")} onClose={() => setIsPastingListing(false)} onApply={onPickListedPiece} />;
    }
    return (
        <Picker
            title={t("ギアを追加")}
            list={{ what: "itemsForSlot", slot, jobId }}
            aboveSearch={
                <>
                <button type="button" className="btn paste-listing" data-testid="paste-listing" onClick={() => setIsPastingListing(true)}>
                    {t("出品テキストを貼り付けて入力")}
                </button>
                <label className="field-label">
                    {t("部位 ·")} {wearerName} {t("が装備できるもの")}
                    <select className="text-field" value={slot} onChange={(event) => setSlot(event.target.value as EquipmentSlot)}>
                        {equipmentSlots.map((candidate) => (
                            <option key={candidate} value={candidate}>
                                {slotLabels[candidate]}
                            </option>
                        ))}
                    </select>
                </label>
                </>
            }
            onClose={onClose}
            onPick={(entry) => entry !== null && onPick(slot, entry.id)}
        />
    );
}
