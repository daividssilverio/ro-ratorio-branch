import type { LockerCommit } from "@ro-ratorio-branch/core/platform-neutral";
import { useState } from "react";
import { BoxIcon } from "./Icons.tsx";
import type { TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

/**
 * Writes the gear state of a node into the locker, on request only. The
 * outcome stays visible, since the changes it wrote disappear from the tree.
 */
export function ApplyToLockerButton({ workspace, nodeId }: { workspace: TreeWorkspace; nodeId: string }) {
    const [lastCommit, setLastCommit] = useState<LockerCommit | null>(null);

    return (
        <div className="apply-to-locker">
            <button type="button" className="btn" onClick={() => setLastCommit(workspace.applyNodeToLocker(nodeId))}>
                <BoxIcon />
                {t("ロッカーに反映")}
            </button>
            <span className="meta" role="status">
                {lastCommit === null
                    ? t("このノードまでの装備の変更（精錬・超越・カード・装備の入れ替え）をロッカーに書き込みます。")
                    : t("{0} 件を反映しました", lastCommit.committedChanges.length) +
                      (lastCommit.skippedChanges.length > 0 ? t(" · {0} 件はロッカー外の装備のため未反映", lastCommit.skippedChanges.length) : "")}
            </span>
        </div>
    );
}
