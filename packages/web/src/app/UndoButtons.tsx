import { useEffect } from "react";
import { RedoIcon, UndoIcon } from "./Icons.tsx";
import { t } from "./text/ui-text.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";

/** Whether the key press belongs to a text box, which has an undo of its own for what is typed into it. */
function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Undo and redo for the changes of this visit, as two buttons and as the
 * usual keys (Ctrl or ⌘ with Z; with Shift, or Ctrl with Y, to redo).
 */
export function UndoButtons({ workspace }: { workspace: TreeWorkspace }) {
    const { canUndo, canRedo, undo, redo } = workspace;

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || isTyping(event.target)) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === "z" && !event.shiftKey) {
                event.preventDefault();
                undo();
            } else if ((key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey)) {
                event.preventDefault();
                redo();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    return (
        <div className="undo-buttons" data-testid="undo-buttons">
            <button type="button" className="ib" aria-label={t("元に戻す")} title={t("元に戻す")} disabled={!canUndo} onClick={undo}>
                <UndoIcon />
            </button>
            <button type="button" className="ib" aria-label={t("やり直す")} title={t("やり直す")} disabled={!canRedo} onClick={redo}>
                <RedoIcon />
            </button>
        </div>
    );
}
