import type { TextKind } from "@ro-ratorio-branch/core/platform-neutral";
import { useState } from "react";
import { useTextOfKind } from "./text-index.ts";
import { menuLanguage } from "./ui-text.ts";

/** An English name as it is shown: with a question mark unless someone checked it. */
export function shownEnglishName(englishName: string, isConfirmed: boolean): string {
    return isConfirmed ? englishName : `${englishName}?`;
}

interface EnglishNameProps {
    readonly kind: TextKind;
    readonly id: number;
    /**
     * Where the name stands on its own, the Japanese menu gets an "EN" tag
     * that shows the English name when pointed at or tapped. Inside a
     * button there is no room for a second control, so nothing is shown.
     */
    readonly withTag?: boolean;
}

/**
 * The English name of something from the game, next to its Japanese name:
 * a line in the English menu, a tag to open in the Japanese one. The names
 * are fetched only when one is about to be shown.
 */
export function EnglishName({ kind, id, withTag = false }: EnglishNameProps) {
    const [isOpen, setIsOpen] = useState(false);
    const text = useTextOfKind(menuLanguage === "en" || isOpen ? kind : null);
    const english = text?.english[String(id)];
    const shown = english?.name === undefined ? null : shownEnglishName(english.name, english.isConfirmed === true);

    if (menuLanguage === "en") {
        return shown === null ? null : (
            <small className="english-name" lang="en">
                {shown}
            </small>
        );
    }
    if (!withTag) {
        return null;
    }
    return (
        <span className="english-tag-holder" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            <button type="button" className="english-tag" aria-expanded={isOpen} aria-label="English" onClick={() => setIsOpen((wasOpen) => !wasOpen)}>
                EN
            </button>
            {isOpen && (
                <small className="english-name" lang="en" role="status">
                    {text === null ? "…" : (shown ?? "—")}
                </small>
            )}
        </span>
    );
}
