import { useEffect, useRef, useState } from "react";
import { copyText } from "./copy-text.ts";
import { CopyIcon } from "./Icons.tsx";
import { t } from "./text/ui-text.ts";

const shownAsCopiedForMilliseconds = 1500;

/**
 * Puts a text on the clipboard. Names in the app sit on buttons, where a
 * browser does not let text be selected, so this is how they are copied.
 */
export function CopyButton({ text, label, caption }: { text: string; label: string; caption?: string }) {
    const [outcome, setOutcome] = useState<"copied" | "refused" | null>(null);
    const resetting = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(resetting.current), []);

    function copy() {
        void copyText(text).then((isCopied) => {
            setOutcome(isCopied ? "copied" : "refused");
            clearTimeout(resetting.current);
            resetting.current = setTimeout(() => setOutcome(null), shownAsCopiedForMilliseconds);
        });
    }

    return (
        <button type="button" className={`copy-button${outcome === null ? "" : ` ${outcome}`}`} aria-label={label} title={label} onClick={copy}>
            {outcome === "copied" ? <span aria-hidden="true">✓</span> : <CopyIcon size={13} />}
            {outcome === "refused" ? <span>{t("コピーできませんでした")}</span> : caption !== undefined && <span aria-hidden="true">{caption}</span>}
            <span className="visually-hidden" role="status">
                {outcome === "copied" ? t("コピーしました") : ""}
            </span>
        </button>
    );
}
