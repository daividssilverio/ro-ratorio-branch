import { useEffect, useRef, useState } from "react";
import { formatInteger, formatSignedPercent } from "./format.ts";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from "./Icons.tsx";
import { rootLabel } from "./labels.ts";
import { t } from "./text/ui-text.ts";
import { doubleTapWindowInMilliseconds, isSecondTapOfDouble, type Tap, type TreeLine, treeLinesOf } from "./tree-view-model.ts";
import type { TreeWorkspace } from "./use-tree-workspace.ts";

interface MiniTreeProps {
    /** The stored workspace, whichever build of its tree the editor shows. */
    readonly workspace: TreeWorkspace;
    /** `null` for the root. */
    readonly selectedNodeId: string | null;
    /** On a phone the tree is one line until it is opened; on a desktop it is always open. */
    readonly isWide: boolean;
    onSelect(nodeId: string | null): void;
    /** Adds a node under the selected one, or under the root. */
    onAddBranch(parentNodeId: string | null): void;
}

/**
 * The tree at a glance while a build is edited: one line per node, each
 * with what it does against the root. A tap on a line makes the editor
 * show that build; a double tap on a node's line renames the node there.
 */
export function MiniTree({ workspace, selectedNodeId, isWide, onSelect, onAddBranch }: MiniTreeProps) {
    const [isOpenOnPhone, setIsOpenOnPhone] = useState(false);
    const [renamedNodeId, setRenamedNodeId] = useState<string | null>(null);
    const previousTap = useRef<Tap | null>(null);
    const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lines = treeLinesOf(workspace.tree, workspace.comparison);
    const root = workspace.comparison?.root;
    const rootDamagePerSecond = root?.state === "ready" ? root.battleSummary.averageDamagePerSecond : null;
    const selectedLine = lines.find((line) => line.nodeId === selectedNodeId);
    const isOpen = isWide || isOpenOnPhone;

    useEffect(() => () => clearTimeout(closing.current), []);

    /** Notes the tap and says whether it completes a double tap on the same thing. */
    function completesDoubleTap(target: string): boolean {
        const tap: Tap = { target, timeInMilliseconds: Date.now() };
        const isSecond = isSecondTapOfDouble(previousTap.current, tap);
        previousTap.current = isSecond ? null : tap;
        return isSecond;
    }

    function tapLine(nodeId: string | null) {
        if (nodeId !== null && completesDoubleTap(nodeId)) {
            clearTimeout(closing.current);
            setRenamedNodeId(nodeId);
            return;
        }
        onSelect(nodeId);
        // The list closes a moment later, so that a second tap still lands on the line.
        clearTimeout(closing.current);
        closing.current = setTimeout(() => setIsOpenOnPhone(false), doubleTapWindowInMilliseconds);
    }

    function tapCurrentLine() {
        if (selectedLine !== undefined && completesDoubleTap(`current:${selectedLine.nodeId}`)) {
            setIsOpenOnPhone(false);
            setRenamedNodeId(selectedLine.nodeId);
            return;
        }
        setIsOpenOnPhone(!isOpenOnPhone);
    }

    function rename(nodeId: string, label: string | null) {
        if (label !== null && label.trim() !== "") {
            workspace.renameNode(nodeId, label.trim());
        }
        setRenamedNodeId(null);
    }

    const rootNumber = <span className="num mini-number">{rootDamagePerSecond === null ? "…" : `${formatInteger(rootDamagePerSecond)}/s`}</span>;

    return (
        <section className={`card tree-glance${isOpen ? " open" : ""}`} data-testid="mini-tree" aria-label={t("ツリー")}>
            <div className="mini-head">
                {isWide ? (
                    <span className="eyebrow mini-title">
                        {t("ツリー")} · {lines.length} nodes
                    </span>
                ) : selectedLine !== undefined && renamedNodeId === selectedLine.nodeId && !isOpenOnPhone ? (
                    <RenameLine line={selectedLine} showsGuides={false} onDone={(label) => rename(selectedLine.nodeId, label)} />
                ) : (
                    <button type="button" className="mini-line mini-current" aria-expanded={isOpenOnPhone} onClick={tapCurrentLine}>
                        {isOpenOnPhone ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                        <span className="mini-label">{selectedLine?.label ?? rootLabel}</span>
                        {selectedLine === undefined ? rootNumber : <LineNumber line={selectedLine} rootDamagePerSecond={rootDamagePerSecond} />}
                    </button>
                )}
                <button type="button" className="btn mini-add" data-testid="add-branch" onClick={() => onAddBranch(selectedLine?.nodeId ?? null)}>
                    <PlusIcon size={14} />
                    {t("分岐")}
                </button>
            </div>
            {isOpen && (
                <div className="mini-lines">
                    <button type="button" className="mini-line" aria-current={selectedLine === undefined ? "true" : undefined} onClick={() => tapLine(null)}>
                        <span className="mini-label">{rootLabel}</span>
                        {rootNumber}
                    </button>
                    {lines.map((line) =>
                        line.nodeId === renamedNodeId ? (
                            <RenameLine key={line.nodeId} line={line} showsGuides onDone={(label) => rename(line.nodeId, label)} />
                        ) : (
                            <button
                                key={line.nodeId}
                                type="button"
                                className="mini-line"
                                aria-current={line.nodeId === selectedNodeId ? "true" : undefined}
                                title={t("ダブルタップで名前を変更")}
                                onClick={() => tapLine(line.nodeId)}
                            >
                                <Guides line={line} />
                                <span className="mini-label">{line.label}</span>
                                <LineNumber line={line} rootDamagePerSecond={rootDamagePerSecond} />
                            </button>
                        ),
                    )}
                </div>
            )}
        </section>
    );
}

/** A node's line while its name is typed: Enter or leaving the box keeps the name, Escape keeps the old one. */
function RenameLine({ line, showsGuides, onDone }: { line: TreeLine; showsGuides: boolean; onDone(label: string | null): void }) {
    const isDone = useRef(false);
    const finish = (label: string | null) => {
        if (!isDone.current) {
            isDone.current = true;
            onDone(label);
        }
    };
    return (
        <div className="mini-line renaming">
            {showsGuides && <Guides line={line} />}
            <input
                className="mini-rename"
                aria-label={t("ノード名")}
                defaultValue={line.label}
                autoFocus
                onFocus={(event) => event.target.select()}
                onBlur={(event) => finish(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        finish(event.currentTarget.value);
                    } else if (event.key === "Escape") {
                        finish(null);
                    }
                }}
            />
        </div>
    );
}

/** The lines in front of a node that show what it hangs off. */
function Guides({ line }: { line: TreeLine }) {
    return (
        <span className="mini-guides" aria-hidden="true">
            {line.guides.map((guide, level) => (
                <span key={level} className={`mini-guide ${guide}`} />
            ))}
        </span>
    );
}

/** What a node does against the root, or why it has no number. */
function LineNumber({ line, rootDamagePerSecond }: { line: TreeLine; rootDamagePerSecond: number | null }) {
    if (line.state === "pending" || (line.state === "ready" && rootDamagePerSecond === null)) {
        return <span className="num mini-number">…</span>;
    }
    if (line.state !== "ready" || line.damagePerSecondGain === undefined || rootDamagePerSecond === null) {
        return <span className={`badge ${line.state === "stale" ? "stl" : "bad"}`}>{line.state === "stale" ? "stale" : "!"}</span>;
    }
    const gain = line.damagePerSecondGain;
    return (
        <span className={`badge num ${gain > 0 ? "good" : gain < 0 ? "bad" : "flat"}`}>
            {gain > 0 ? "▲ " : gain < 0 ? "▼ " : ""}
            {formatSignedPercent(gain, rootDamagePerSecond)}
        </span>
    );
}
