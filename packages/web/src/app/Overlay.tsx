import { type ReactNode, useEffect } from "react";
import { CloseIcon } from "./Icons.tsx";
import { t } from "./text/ui-text.ts";

interface OverlayProps {
    readonly title: string;
    onClose(): void;
    readonly children: ReactNode;
}

/** A panel over the screen: a bottom sheet on a phone, a centered dialog on a desktop. */
export function Overlay({ title, onClose, children }: OverlayProps) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);

    return (
        <div className="overlay">
            <button type="button" className="overlay-scrim" aria-label={t("閉じる")} onClick={onClose} />
            <section role="dialog" aria-modal="true" aria-label={title} className="overlay-panel">
                <header className="overlay-head">
                    <h2>{title}</h2>
                    <button type="button" className="ib" aria-label={t("閉じる")} onClick={onClose}>
                        <CloseIcon />
                    </button>
                </header>
                {children}
            </section>
        </div>
    );
}
