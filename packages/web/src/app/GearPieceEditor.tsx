import {
    type Build,
    buildWithSocketFilled,
    equipmentSlots,
    gearLimits,
    type LockerPiece,
    randomOptionsPerGearPiece,
    removeLockerPiece,
    replaceLockerPiece,
    slotTakesRefine,
    slotTakesTranscendence,
    socketCountOfSlot,
} from "@ro-ratorio-branch/core/platform-neutral";
import { useMemo, useState } from "react";
import { CommittedNumberField, CommittedTextArea } from "./CommittedFields.tsx";
import { formatZeny } from "./format.ts";
import { cardOrEnchantNameIn, itemNameIn, slotGlyphs, slotsLabel } from "./labels.ts";
import { withPieceField, withRandomOptionAt, withSocket, socketStateOf } from "./locker-view-model.ts";
import { CopyButton } from "./CopyButton.tsx";
import { OfficialDatabaseLink } from "./OfficialDatabaseLink.tsx";
import { pieceTextIn } from "./piece-text.ts";
import { EffectSourceList } from "./EffectsCard.tsx";
import { pieceEffectSourcesOf } from "./effects-view-model.ts";
import { GearListingDialog } from "./GearListingDialog.tsx";
import { Picker } from "./Picker.tsx";
import { Picture } from "../image-pack/Picture.tsx";
import type { PickerPreview } from "./use-damage-previews.ts";
import { EnglishName } from "./text/EnglishName.tsx";
import { useCatalogList, useRandomOptionChoices, useSocketChoices, type WorkspaceGearData } from "./use-engine-data.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

const zenyPerMillion = 1_000_000;

interface GearPieceEditorProps {
    readonly workspace: TreeWorkspace;
    readonly gearPieceId: string;
    readonly gearData: WorkspaceGearData;
    /** Called after the piece was taken out of the locker. */
    onRemoved?(): void;
}

/** Everything that can be changed on one locker piece. A change applies to everyone who uses the piece. */
export function GearPieceEditor({ workspace, gearPieceId, gearData, onRemoved }: GearPieceEditorProps) {
    const [socketBeingPicked, setSocketBeingPicked] = useState<number | null>(null);
    const [isRemovalRefused, setIsRemovalRefused] = useState(false);
    const [isPastingListing, setIsPastingListing] = useState(false);
    const [randomOptionPositionBeingPicked, setRandomOptionPositionBeingPicked] = useState<number | null>(null);
    const lockerPiece = workspace.workspace.gearPieces[gearPieceId];
    const { descriptions, gearFacts } = gearData;
    const slots = (lockerPiece === undefined ? undefined : gearFacts.slotsOfItem[lockerPiece.itemId]) ?? [];
    const firstSlot = slots[0];
    const socketCount = firstSlot === undefined ? 0 : socketCountOfSlot(firstSlot);
    const randomOptionChoices = useRandomOptionChoices(lockerPiece?.itemId ?? 0, randomOptionsPerGearPiece);
    const socketChoices = useSocketChoices(firstSlot, lockerPiece?.itemId ?? 0, socketCount);
    const weaponElements = useCatalogList({ what: "weaponElements" });
    // A preview needs the piece on the open character: only then is there a build the card would change.
    const { root, scenario } = workspace.tree;
    const openCharacter = workspace.workspace.characters[workspace.workspace.trees[workspace.activeTreeId]?.characterId ?? ""];
    // The sets the shown build completes belong to this piece only where that build wears it.
    const isWornByTheShownBuild = Object.values(openCharacter?.equipment ?? {}).includes(gearPieceId);
    const itemSetsOfThePiece = isWornByTheShownBuild && workspace.evaluation?.root.state === "ready" ? workspace.evaluation.root.itemSets : [];
    const wornInSlot = equipmentSlots.find((slot) => openCharacter?.equipment[slot] === gearPieceId);
    const socketPreview = useMemo((): PickerPreview | undefined => {
        if (wornInSlot === undefined || socketBeingPicked === null) {
            return undefined;
        }
        const baseline: Build = { formatVersion: 1, character: root, scenario };
        return { baseline, withEntry: (cardOrEnchantId) => buildWithSocketFilled(baseline, wornInSlot, socketBeingPicked, cardOrEnchantId) };
    }, [root, scenario, wornInSlot, socketBeingPicked]);
    if (lockerPiece === undefined) {
        return null;
    }
    const takesRefine = slots.some(slotTakesRefine);
    const takesTranscendence = slots.some(slotTakesTranscendence);
    const isWeapon = slots.includes("rightHand") || slots.includes("leftHand");
    const wearingJobIds = gearFacts.wearingJobIdsOfItem[lockerPiece.itemId];
    const randomOptions = lockerPiece.randomOptions ?? [];

    const replaceWith = (nextPiece: LockerPiece) => workspace.updateWorkspace(replaceLockerPiece(workspace.workspace, gearPieceId, nextPiece));

    function remove() {
        const removal = removeLockerPiece(workspace.workspace, gearPieceId);
        if (!removal.removed) {
            setIsRemovalRefused(true);
            return;
        }
        workspace.updateWorkspace(removal.workspace);
        onRemoved?.();
    }

    return (
        <div className="piece-editor" data-testid="piece-editor">
            <div className="piece-head">
                <div className="ico large" aria-hidden="true">
                    <Picture kind="item" id={lockerPiece.itemId} name={itemNameIn(descriptions, lockerPiece.itemId)} fallback={firstSlot === undefined ? "?" : slotGlyphs[firstSlot]} />
                </div>
                <div className="piece-title">
                    <b>{itemNameIn(descriptions, lockerPiece.itemId)}</b>
                    <EnglishName kind="item" id={lockerPiece.itemId} withTag />
                    <span className="piece-copy">
                        <CopyButton text={itemNameIn(descriptions, lockerPiece.itemId)} label={t("名前をコピー")} />
                        <CopyButton text={pieceTextIn(descriptions, lockerPiece)} label={t("ギアをテキストでコピー")} caption={t("テキスト")} />
                        <OfficialDatabaseLink kind="item" name={itemNameIn(descriptions, lockerPiece.itemId)} />
                    </span>
                    <span>{slotsLabel(slots) ?? `item #${lockerPiece.itemId}`}</span>
                </div>
            </div>

            <details className="effects-group piece-effects">
                <summary>{t("このギアの効果")}</summary>
                <EffectSourceList sources={pieceEffectSourcesOf(lockerPiece, firstSlot ?? "rightHand", descriptions, itemSetsOfThePiece)} showsSlots={false} />
            </details>

            {takesRefine && (
                <div className="stepper-pair">
                    <Stepper label={t("精錬")} prefix="+" value={lockerPiece.refine ?? 0} highest={gearLimits.highestRefine} onChange={(refine) => replaceWith(withPieceField(lockerPiece, "refine", refine))} />
                    {takesTranscendence && (
                        <Stepper
                            label={t("超越")}
                            prefix=""
                            value={lockerPiece.transcendence ?? 0}
                            highest={gearLimits.highestTranscendence}
                            onChange={(transcendence) => replaceWith(withPieceField(lockerPiece, "transcendence", transcendence))}
                        />
                    )}
                </div>
            )}

            <div className="editor-group">
                <span className="eyebrow">{t("カード · エンチャント")}</span>
                <div className="socket-grid">
                    {Array.from({ length: socketCount }, (_, socketIndex) => {
                        const cardOrEnchantId = lockerPiece.sockets?.[socketIndex] ?? null;
                        const socketState = socketStateOf(socketChoices?.[socketIndex], cardOrEnchantId);
                        return (
                            <button
                                key={socketIndex}
                                type="button"
                                className={`sock${cardOrEnchantId === null ? " empty" : ""}${socketState === "misfilled" ? " barred" : ""}`}
                                data-socket-state={socketState}
                                disabled={firstSlot === undefined || socketState === "closed" || socketState === "unknown"}
                                onClick={() => setSocketBeingPicked(socketIndex)}
                            >
                                <span className="num">S{socketIndex + 1}</span>
                                <span className="sock-name">
                                    {cardOrEnchantId !== null ? cardOrEnchantNameIn(descriptions, cardOrEnchantId) : socketState === "closed" ? "—" : t("空き")}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {(lockerPiece.sockets ?? []).some((cardOrEnchantId, socketIndex) => socketStateOf(socketChoices?.[socketIndex], cardOrEnchantId) === "misfilled") && (
                    <div className="editor-hint barred">{t("このアイテムには付けられないカード / エンチャントがあります。")}</div>
                )}
            </div>

            <div className="editor-group" data-testid="random-options">
                <span className="eyebrow">{t("ランダムオプション")}</span>
                <button type="button" className="btn paste-listing" data-testid="paste-piece-listing" onClick={() => setIsPastingListing(true)}>
                    {t("出品テキストを貼り付けて入力")}
                </button>
                {randomOptionChoices !== null && randomOptionChoices.every((choices) => choices.length === 0) && !randomOptions.some((randomOption) => randomOption !== null) && (
                    <span className="piece-status">{t("このアイテムにランダムオプションは付きません")}</span>
                )}
                {(randomOptionChoices ?? []).map((choices, positionIndex) => {
                    const randomOption = randomOptions[positionIndex] ?? null;
                    if (choices.length === 0 && randomOption === null) {
                        return null;
                    }
                    const range = choices.find((choice) => choice.id === randomOption?.optionId)?.range;
                    return (
                        <div key={positionIndex} className="option-row" data-testid="random-option">
                            <button type="button" className={`sock${randomOption === null ? " empty" : ""}`} onClick={() => setRandomOptionPositionBeingPicked(positionIndex)}>
                                <span className="num">OP{positionIndex + 1}</span>
                                <span className="sock-name">
                                    {randomOption === null ? t("空き") : (descriptions.randomOptionNames[randomOption.optionId] ?? `option #${randomOption.optionId}`)}
                                </span>
                            </button>
                            {randomOption !== null && (
                                <CommittedNumberField
                                    value={randomOption.value}
                                    lowest={range?.lowest ?? 0}
                                    highest={range?.highest ?? 9999}
                                    ariaLabel={t("OP{0} の値", positionIndex + 1)}
                                    onCommit={(value) => value !== null && replaceWith(withRandomOptionAt(lockerPiece, positionIndex, { optionId: randomOption.optionId, value }))}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {isWeapon && (
                <label className="field-label">
                    {t("武器の属性（ランダムオプション）")}
                    <select
                        className="text-field"
                        data-testid="piece-element"
                        value={lockerPiece.element ?? 0}
                        onChange={(event) => replaceWith(withPieceField(lockerPiece, "element", Number(event.target.value) === 0 ? undefined : Number(event.target.value)))}
                    >
                        <option value={0}>{t("なし")}</option>
                        {(weaponElements ?? []).filter((element) => element.id !== 0).map((element) => (
                            <option key={element.id} value={element.id}>
                                {element.name}
                            </option>
                        ))}
                    </select>
                    <span className="editor-hint">{t("右手の武器のとき、キャラに属性付与がなければこの属性で攻撃します。")}</span>
                </label>
            )}

            <div className="editor-row">
                <label className="check-label">
                    <input type="checkbox" checked={lockerPiece.owned} onChange={(event) => replaceWith({ ...lockerPiece, owned: event.target.checked })} />
                    {t("所持している")}
                </label>
                <label className="field-label price-field">
                    {t("価格 (M z)")}
                    <CommittedNumberField
                        value={lockerPiece.zenyCost === undefined ? null : lockerPiece.zenyCost / zenyPerMillion}
                        lowest={0}
                        allowsEmpty
                        allowsDecimals
                        ariaLabel={t("価格 (M z)")}
                        onCommit={(millions) => replaceWith(withPieceField(lockerPiece, "zenyCost", millions === null ? undefined : Math.round(millions * zenyPerMillion)))}
                    />
                </label>
            </div>
            {lockerPiece.zenyCost !== undefined && <div className="editor-hint num">{formatZeny(lockerPiece.zenyCost)}</div>}

            <label className="field-label">
                {t("メモ")}
                <CommittedTextArea value={lockerPiece.note ?? ""} onCommit={(note) => replaceWith(withPieceField(lockerPiece, "note", note))} />
            </label>

            {wearingJobIds !== undefined && Object.keys(workspace.workspace.characters).length > 0 && (
                <div className="editor-group">
                    <span className="eyebrow">{t("装備可否 · キャラ別")}</span>
                    <div className="equip-checks">
                        {Object.entries(workspace.workspace.characters).map(([characterId, character]) => (
                            <div key={characterId} data-can-wear={wearingJobIds.includes(character.jobId)}>
                                <span>
                                    {character.name} · {descriptions.jobNames[character.jobId] ?? `job #${character.jobId}`}
                                </span>
                                {wearingJobIds.includes(character.jobId) ? <span className="ok">{t("✓ 装備可")}</span> : <span className="ng">{t("✕ 職業制限")}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="editor-row">
                <button type="button" className="btn danger" onClick={remove}>
                    {t("ロッカーから削除")}
                </button>
            </div>
            {isRemovalRefused && (
                <div className="import-refusal" role="alert">
                    {t("使用中のため削除できません。先にキャラの装備やツリーのノードから外してください。")}
                </div>
            )}

            {isPastingListing && (
                <GearListingDialog
                    title={t("出品テキストから入力")}
                    forItemId={lockerPiece.itemId}
                    onClose={() => setIsPastingListing(false)}
                    onApply={(listedPiece) => {
                        // What the text says replaces what the piece had of the same kind; what it leaves out stays.
                        const { itemId: _sameItem, ...listed } = listedPiece;
                        replaceWith({ ...lockerPiece, ...listed });
                        setIsPastingListing(false);
                    }}
                />
            )}
            {randomOptionPositionBeingPicked !== null && (
                <Picker
                    title={t("OP{0} · ランダムオプション", randomOptionPositionBeingPicked + 1)}
                    list={{ what: "randomOptionsOfItem", itemId: lockerPiece.itemId, positionIndex: randomOptionPositionBeingPicked }}
                    noneLabel={t("空きにする")}
                    onClose={() => setRandomOptionPositionBeingPicked(null)}
                    onPick={(entry) => {
                        replaceWith(withRandomOptionAt(lockerPiece, randomOptionPositionBeingPicked, entry === null ? null : { optionId: entry.id, value: entry.range?.highest ?? 1 }));
                        setRandomOptionPositionBeingPicked(null);
                    }}
                />
            )}
            {socketBeingPicked !== null && firstSlot !== undefined && (
                <Picker
                    title={t("S{0} · カード / エンチャント", socketBeingPicked + 1)}
                    list={{ what: "socketChoicesOfItem", slot: firstSlot, itemId: lockerPiece.itemId, socketIndex: socketBeingPicked }}
                    preview={socketPreview}
                    noneLabel={t("空きにする")}
                    onClose={() => setSocketBeingPicked(null)}
                    onPick={(entry) => {
                        replaceWith(withSocket(lockerPiece, socketBeingPicked, entry?.id ?? null, socketCount));
                        setSocketBeingPicked(null);
                    }}
                />
            )}
        </div>
    );
}

interface StepperProps {
    readonly label: string;
    readonly prefix: string;
    readonly value: number;
    readonly highest: number;
    onChange(value: number): void;
}

function Stepper({ label, prefix, value, highest, onChange }: StepperProps) {
    return (
        <div className="stepper">
            <span>{label}</span>
            <div className="step">
                <button type="button" aria-label={t("{0}を下げる", label)} disabled={value <= 0} onClick={() => onChange(value - 1)}>
                    −
                </button>
                <b className="num" data-testid={`stepper-${label}`}>
                    {prefix}
                    {value}
                </b>
                <button type="button" aria-label={t("{0}を上げる", label)} disabled={value >= highest} onClick={() => onChange(value + 1)}>
                    +
                </button>
            </div>
        </div>
    );
}
