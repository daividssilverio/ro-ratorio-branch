import { useState } from "react";

interface CommittedNumberFieldProps {
    readonly value: number | null;
    readonly lowest: number;
    readonly highest?: number;
    readonly allowsEmpty?: boolean;
    readonly allowsDecimals?: boolean;
    readonly ariaLabel: string;
    onCommit(value: number | null): void;
}

/**
 * A number box that hands over its value when the user leaves it or presses
 * Enter, so that typing "130" does not calculate for "1" and "13" on the way.
 */
export function CommittedNumberField({ value, lowest, highest, allowsEmpty = false, allowsDecimals = false, ariaLabel, onCommit }: CommittedNumberFieldProps) {
    const [draft, setDraft] = useState<string | null>(null);

    function commit() {
        if (draft === null) {
            return;
        }
        setDraft(null);
        if (draft.trim() === "") {
            if (allowsEmpty && value !== null) {
                onCommit(null);
            }
            return;
        }
        const typed = allowsDecimals ? Number(draft) : Math.round(Number(draft));
        if (!Number.isFinite(typed)) {
            return;
        }
        const committed = Math.min(Math.max(typed, lowest), highest ?? Number.MAX_SAFE_INTEGER);
        if (committed !== value) {
            onCommit(committed);
        }
    }

    return (
        <input
            className="text-field num-field num"
            // The numeric keypad of a phone has no minus sign.
            inputMode={lowest < 0 ? "text" : allowsDecimals ? "decimal" : "numeric"}
            aria-label={ariaLabel}
            value={draft ?? (value === null ? "" : String(value))}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.currentTarget.blur();
                }
            }}
        />
    );
}

export function CommittedTextArea({ value, onCommit }: { value: string; onCommit(value: string): void }) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <textarea
            className="note-field"
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft !== null && draft !== value) {
                    onCommit(draft);
                }
                setDraft(null);
            }}
        />
    );
}

/** A one-line text box that hands over its value when the user leaves it or presses Enter. */
export function CommittedTextField({ value, ariaLabel, onCommit }: { value: string; ariaLabel: string; onCommit(value: string): void }) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <input
            className="text-field"
            aria-label={ariaLabel}
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft !== null && draft.trim() !== "" && draft !== value) {
                    onCommit(draft.trim());
                }
                setDraft(null);
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.currentTarget.blur();
                }
            }}
        />
    );
}
