import type { ReactNode } from "react";

function Icon({ children, size = 18, className = "" }: { children: ReactNode; size?: number; className?: string }) {
    return (
        <svg className={`i ${className}`} viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden="true">
            {children}
        </svg>
    );
}

type IconProps = { size?: number; className?: string };

export const BranchIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M6 3v12" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
    </Icon>
);
export const PersonIcon = (props: IconProps) => (
    <Icon {...props}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
);
export const BarsIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
);
export const BoxIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
        <path d="M3 7l9 4 9-4M12 11v10" />
    </Icon>
);
export const ShareIcon = (props: IconProps) => (
    <Icon {...props}>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="M8.2 10.9l7.6-4.6M8.2 13.1l7.6 4.6" />
    </Icon>
);
export const ChevronDownIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M6 9l6 6 6-6" />
    </Icon>
);
export const ChevronRightIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M9 6l6 6-6 6" />
    </Icon>
);
export const ChevronUpIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M6 15l6-6 6 6" />
    </Icon>
);
export const CloseIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
);
export const SwapIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M7 7h13l-4-4M17 17H4l4 4" />
    </Icon>
);
export const StarIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
    </Icon>
);
export const WarningIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M12 3l9.5 17h-19z" />
        <path d="M12 10v4M12 17.5v.01" />
    </Icon>
);
export const CompareIcon = (props: IconProps) => (
    <Icon {...props}>
        <rect x="3" y="4" width="7" height="16" rx="1.5" />
        <rect x="14" y="4" width="7" height="16" rx="1.5" />
    </Icon>
);
export const SpinnerIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    </Icon>
);
export const ImportIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Icon>
);
export const SortDownIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M12 5v14M6 13l6 6 6-6" />
    </Icon>
);
export const CopyIcon = (props: IconProps) => (
    <Icon {...props}>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Icon>
);
export const LinkIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
);
export const DownloadIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M12 4v11M7 10l5 5 5-5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </Icon>
);
export const PlusIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M12 5v14M5 12h14" />
    </Icon>
);
export const OpenOutsideIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Icon>
);
export const UndoIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
);
export const RedoIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="m15 14 5-5-5-5" />
        <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </Icon>
);
