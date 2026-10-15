import type { EquipmentSlot, GearPiece, ListingLineProblem, ListingLineReading } from "@ro-ratorio-branch/core/platform-neutral";
import { useEffect, useId, useState } from "react";
import type { GearListingRead } from "../engine-host/host-protocol.ts";
import { slotLabels } from "./labels.ts";
import { Overlay } from "./Overlay.tsx";
import { t } from "./text/ui-text.ts";
import { engineHost } from "./use-tree-workspace.ts";

interface GearListingDialogProps {
    readonly title: string;
    /** The item of the piece the text is pasted for, when the piece exists already. */
    readonly forItemId?: number;
    /** The slot the piece is to go into, when there is one: an item that does not fit it is not taken. */
    readonly forSlot?: EquipmentSlot;
    /** Called with the piece as it was read, and the slot its item fits first. */
    onApply(gearPiece: GearPiece, slotOfItem: EquipmentSlot | undefined): void;
    onClose(): void;
}

const readingDelayInMilliseconds = 250;

const problemTexts: Readonly<Record<ListingLineProblem, string>> = {
    unknownItem: t("アイテムが見つかりません"),
    anotherItem: t("別のアイテムの行です"),
    unknownEffect: t("カードやオプションとして読み取れません"),
    valueNotOffered: t("このアイテムでは選べない値です"),
    noRoomLeft: t("入れる場所がもうありません"),
    elementOnNonWeapon: t("属性が付くのは武器だけです"),
};

/**
 * Paste the text of a market listing (the item with its refine, then its
 * cards and options, one per line) and get the piece it describes. Every
 * line is shown with what it was read as before anything is taken.
 */
export function GearListingDialog({ title, forItemId, forSlot, onApply, onClose }: GearListingDialogProps) {
    const [text, setText] = useState("");
    const [read, setRead] = useState<{ readonly text: string; readonly listingRead: GearListingRead } | null>(null);
    const textFieldId = useId();

    useEffect(() => {
        if (text.trim() === "") {
            setRead(null);
            return;
        }
        let isLatest = true;
        const timer = window.setTimeout(() => {
            void engineHost()
                .then((host) => host.readGearListing(text, forItemId))
                .then((listingRead) => {
                    if (isLatest) {
                        setRead({ text, listingRead });
                    }
                })
                .catch(() => undefined);
        }, readingDelayInMilliseconds);
        return () => {
            isLatest = false;
            window.clearTimeout(timer);
        };
    }, [text, forItemId]);

    const current = read !== null && read.text === text ? read.listingRead : null;
    const gearPiece = current?.listing.gearPiece ?? null;
    const fitsSlot = forSlot === undefined || current === null || current.slotsOfItem.includes(forSlot);
    const understoodCount = current?.listing.lines.filter((line) => line.reading.kind !== "notUnderstood").length ?? 0;

    return (
        <Overlay title={title} onClose={onClose}>
            <div className="listing-dialog">
                <label htmlFor={textFieldId} className="field-label">
                    {forItemId === undefined ? t("出品の表示をそのまま貼り付けます。1 行目がアイテム、続けてカードとオプションを 1 行ずつ。") : t("カードとオプションを 1 行ずつ貼り付けます。")}
                </label>
                <textarea
                    id={textFieldId}
                    className="import-text listing-text"
                    value={text}
                    autoFocus
                    spellCheck={false}
                    placeholder={forItemId === undefined ? "+7 錆びたアーム[3]\nローラカード\n物理攻撃時、小型モンスターに与えるダメージ+90%\nMaxHP+11%" : "ローラカード\nMaxHP+11%"}
                    onChange={(event) => setText(event.target.value)}
                />
                {text.trim() !== "" && current === null && <p role="status">{t("確認中…")}</p>}
                {current !== null && (
                    <ul className="listing-lines" data-testid="listing-lines">
                        {current.listing.lines.map((line, lineIndex) => (
                            <li key={lineIndex} className={line.reading.kind === "notUnderstood" ? "not-read" : "read"} data-reading={line.reading.kind}>
                                <span className="listing-source">{line.text}</span>
                                <span className="listing-reading">{readingText(line.reading)}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {current !== null && !fitsSlot && forSlot !== undefined && (
                    <div className="import-refusal" role="alert">
                        {t("このアイテムは {0} に装備できません。", slotLabels[forSlot])}
                    </div>
                )}
                <div className="import-actions">
                    <button type="button" className="btn" onClick={onClose}>
                        {t("キャンセル")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-p"
                        data-testid="apply-listing"
                        disabled={gearPiece === null || !fitsSlot || understoodCount === 0}
                        onClick={() => gearPiece !== null && onApply(gearPiece, current?.slotsOfItem[0])}
                    >
                        {t("この内容で入力")}
                    </button>
                </div>
            </div>
        </Overlay>
    );
}

/** What a line was read as, in a few words; the names are the calculator's own. */
function readingText(reading: ListingLineReading): string {
    switch (reading.kind) {
        case "item":
            return `✓ ${reading.refine === null ? "" : `+${reading.refine} `}${reading.name}`;
        case "cardOrEnchant":
            return `✓ S${reading.socketIndex + 1} · ${reading.name}`;
        case "randomOption":
            return `✓ OP${reading.positionIndex + 1} · ${reading.name} ${reading.value}`;
        case "transcendence":
            return `✓ ${t("超越")} ★${reading.transcendence}`;
        case "weaponElement":
            return `✓ ${t("武器の属性")} · ${reading.name}`;
        case "notUnderstood":
            return `✕ ${problemTexts[reading.reason]}`;
    }
}
