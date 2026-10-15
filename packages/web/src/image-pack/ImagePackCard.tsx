import { type ChangeEvent, useRef, useState } from "react";
import { t } from "../app/text/ui-text.ts";
import { addPictures, type PicturesAdded, removeAllPictures, usePictureCount } from "./use-image-pack.ts";

/** Load pictures the user has on their device into the browser, to show beside names, and take them out again. */
export function ImagePackCard() {
    const pictureCount = usePictureCount();
    const folderPicker = useRef<HTMLInputElement>(null);
    const filePicker = useRef<HTMLInputElement>(null);
    const [lastAdded, setLastAdded] = useState<PicturesAdded | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    async function addPicked(event: ChangeEvent<HTMLInputElement>) {
        const files = [...(event.target.files ?? [])];
        event.target.value = "";
        if (files.length === 0) {
            return;
        }
        setIsAdding(true);
        try {
            setLastAdded(await addPictures(files));
        } finally {
            setIsAdding(false);
        }
    }

    return (
        <section className="card share-card" data-testid="image-pack">
            <h2>
                {t("画像パック")} <small>Images</small>
            </h2>
            <p>{t("お手元の画像を、このブラウザーの中だけに読み込んで名前の横に表示します。このアプリは画像を配布も取得もしません。")}</p>
            <p>{t("ファイル名を名前か ID にします。item · card · monster · skill · job のフォルダーに分けると種類も区別します（例: item/メロンメイス.png、monster/1002.png）。")}</p>
            <div className="button-pair">
                <button type="button" className="btn" disabled={isAdding} onClick={() => folderPicker.current?.click()}>
                    {t("フォルダーを選ぶ")}
                </button>
                <button type="button" className="btn" disabled={isAdding} onClick={() => filePicker.current?.click()}>
                    {t("画像 · ZIP を選ぶ")}
                </button>
            </div>
            <div className="editor-row" role="status">
                <span className="piece-status num">{isAdding ? t("読み込み中…") : pictureCount === null ? "" : t("{0} 枚の画像", pictureCount)}</span>
                {lastAdded !== null && !isAdding && <span className="piece-status num">{t("{0} 枚を追加 · {1} 件は対象外", lastAdded.addedCount, lastAdded.skippedCount)}</span>}
                {pictureCount !== null && pictureCount > 0 && (
                    <button
                        type="button"
                        className="btn danger"
                        onClick={() => {
                            setLastAdded(null);
                            void removeAllPictures();
                        }}
                    >
                        {t("画像をすべて削除")}
                    </button>
                )}
            </div>
            {/* The attribute that lets a folder be picked is not in the standard set React knows. */}
            <input ref={folderPicker} type="file" multiple hidden {...{ webkitdirectory: "" }} onChange={(event) => void addPicked(event)} />
            <input ref={filePicker} type="file" multiple hidden accept="image/*,.zip,application/zip" onChange={(event) => void addPicked(event)} />
        </section>
    );
}
