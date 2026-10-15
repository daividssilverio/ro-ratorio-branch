import type { TextKind } from "@ro-ratorio-branch/core/platform-neutral";
import { useState } from "react";
import { nameToSearchOfficially, officialSearchPageOf } from "./official-database.ts";
import { t } from "./text/ui-text.ts";

/**
 * Opens the official tool's search for this kind of thing in a new tab and
 * puts the name on the clipboard, ready to paste into its search box.
 * Shows nothing for a kind the official tool has no page for.
 */
export function OfficialDatabaseLink({ kind, name }: { kind: TextKind; name: string }) {
    const [isCopied, setIsCopied] = useState(false);
    const page = officialSearchPageOf(kind);
    if (page === null) {
        return null;
    }

    function copyName() {
        // The link opens either way; the copy is a convenience that a browser may refuse.
        void navigator.clipboard
            ?.writeText(nameToSearchOfficially(name))
            .then(() => setIsCopied(true))
            .catch(() => undefined);
    }

    return (
        <a className="official-link" href={page} target="_blank" rel="noopener noreferrer" title={t("名前をコピーして公式ツールの検索を開きます")} onClick={copyName}>
            {isCopied ? t("コピー済 ↗") : t("公式DB ↗")}
        </a>
    );
}
