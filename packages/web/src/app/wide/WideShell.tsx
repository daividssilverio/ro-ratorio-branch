import type { ReactNode } from "react";
import { BranchIcon } from "../Icons.tsx";
import { ProjectCredit, reuseNotice } from "../rights.tsx";
import type { OpenTab } from "../TabBar.tsx";
import { UndoButtons } from "../UndoButtons.tsx";
import { DisplayToggles } from "../text/DisplayToggles.tsx";
import type { TreeWorkspace } from "../use-tree-workspace.ts";
import { t } from "../text/ui-text.ts";

const navigationItems: readonly { label: string; opens: OpenTab }[] = [
    { label: t("ビルド"), opens: "build" },
    { label: t("ツリー"), opens: "tree" },
    { label: t("ランキング"), opens: "ranking" },
    { label: t("ロッカー"), opens: "locker" },
    { label: t("共有"), opens: "share" },
];

interface WideShellProps {
    readonly workspace: TreeWorkspace;
    readonly openTab: OpenTab;
    onOpen(tab: OpenTab): void;
    readonly children: ReactNode;
}

/** The desktop frame: navigation along the top, the open view below it, the rights notice at the bottom. */
export function WideShell({ workspace, openTab, onOpen, children }: WideShellProps) {
    const { tree, descriptions } = workspace;
    return (
        <div className="wide-app">
            <header className="top-bar">
                <div className="brand">
                    <div className="app-mark">
                        <BranchIcon size={17} />
                    </div>
                    <span>ROラトリオ Branch</span>
                </div>
                <span className="job-chip">
                    {descriptions.jobNames[tree.root.jobId] ?? `job #${tree.root.jobId}`} <span className="num">Lv{tree.root.baseLevel}</span>
                </span>
                <nav className="top-nav" aria-label={t("メイン")}>
                    {navigationItems.map(({ label, opens }) => (
                        <button
                            key={label}
                            type="button"
                            aria-current={opens === openTab ? "page" : undefined}
                            onClick={() => onOpen(opens)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
                <UndoButtons workspace={workspace} />
                <DisplayToggles />
            </header>
            {children}
            <footer className="wide-rights">
                <span>
                    © Gravity Co., Ltd. &amp; Lee MyoungJin(studio DTDS). All rights reserved. © GungHo Online Entertainment, Inc. All Rights
                    Reserved. {reuseNotice}
                </span>
                <span>
                    <ProjectCredit />
                </span>
            </footer>
        </div>
    );
}
