import type { ReactNode } from "react";
import { BarsIcon, BoxIcon, BranchIcon, PersonIcon, ShareIcon } from "./Icons.tsx";
import { t } from "./text/ui-text.ts";

export type OpenTab = "build" | "tree" | "ranking" | "locker" | "share";

interface TabDefinition {
    readonly label: string;
    readonly icon: ReactNode;
    readonly opens: OpenTab;
}

const tabs: readonly TabDefinition[] = [
    { label: t("ビルド"), icon: <PersonIcon />, opens: "build" },
    { label: t("ツリー"), icon: <BranchIcon />, opens: "tree" },
    { label: t("ランキング"), icon: <BarsIcon />, opens: "ranking" },
    { label: t("ロッカー"), icon: <BoxIcon />, opens: "locker" },
    { label: t("共有"), icon: <ShareIcon />, opens: "share" },
];

export function TabBar({ openTab, onOpen }: { openTab: OpenTab; onOpen: (tab: OpenTab) => void }) {
    return (
        <nav className="tab-bar" aria-label={t("メイン")}>
            {tabs.map(({ label, icon, opens }) => (
                <button
                    key={label}
                    type="button"
                    className="tab"
                    aria-current={opens === openTab ? "page" : undefined}
                    onClick={() => onOpen(opens)}
                >
                    {icon}
                    {label}
                </button>
            ))}
        </nav>
    );
}
