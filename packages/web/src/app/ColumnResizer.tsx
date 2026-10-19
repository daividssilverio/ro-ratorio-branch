import { type CSSProperties, type PointerEvent, useRef, useState } from "react";
import { loadColumnWidth, storeColumnWidth } from "../storage/workspace-store.ts";
import { type ColumnLimits, type ColumnSide, widthAfterDrag, widthAfterKey, widthWithin } from "./column-width.ts";
import { t } from "./text/ui-text.ts";

/** Room the column beside a resizable one always keeps, so that dragging never squeezes it away. */
const roomKeptForTheOtherColumn = 420;

export interface ColumnWidth {
    readonly width: number;
    readonly limits: ColumnLimits;
    readonly side: ColumnSide;
    /** The style that gives the resizable column its width. */
    readonly style: CSSProperties;
    change(width: number): void;
    /** Keeps the width for next time. */
    keep(): void;
    reset(): void;
}

/**
 * A desktop column whose width is dragged: by a name for it, its usual
 * width, its limits, and on which side of its handle it sits.
 */
export function useColumnWidth(columnName: string, usualWidth: number, limits: ColumnLimits, side: ColumnSide): ColumnWidth {
    const [width, setWidth] = useState(() => widthWithin(loadColumnWidth(columnName) ?? usualWidth, limits));
    const latest = useRef(width);
    latest.current = width;
    return {
        width,
        limits,
        side,
        style: { flex: `0 0 ${width}px`, width, maxWidth: `calc(100% - ${roomKeptForTheOtherColumn}px)` },
        change: setWidth,
        keep: () => storeColumnWidth(columnName, latest.current),
        reset: () => {
            setWidth(usualWidth);
            storeColumnWidth(columnName, usualWidth);
        },
    };
}

/** The handle between two desktop columns: drag it, or use the arrow keys; a double click puts the column back to its usual width. */
export function ColumnResizer({ column, label }: { column: ColumnWidth; label: string }) {
    const drag = useRef<{ startX: number; startWidth: number } | null>(null);

    function start(event: PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidth: column.width };
    }

    function move(event: PointerEvent<HTMLDivElement>) {
        if (drag.current !== null) {
            column.change(widthAfterDrag(drag.current.startWidth, event.clientX - drag.current.startX, column.side, column.limits));
        }
    }

    function finish() {
        if (drag.current !== null) {
            drag.current = null;
            column.keep();
        }
    }

    return (
        <div
            className="column-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-valuenow={column.width}
            aria-valuemin={column.limits.narrowest}
            aria-valuemax={column.limits.widest}
            tabIndex={0}
            title={t("ドラッグで幅を変更 · ダブルクリックで元に戻す")}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
            onDoubleClick={column.reset}
            onKeyDown={(event) => {
                const width = widthAfterKey(column.width, event.key, column.side, column.limits);
                if (width !== null) {
                    event.preventDefault();
                    column.change(width);
                }
            }}
            onKeyUp={() => column.keep()}
        />
    );
}
