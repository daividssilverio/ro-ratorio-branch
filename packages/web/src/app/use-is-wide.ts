import { useSyncExternalStore } from "react";

/** From this width up the app uses the desktop boards: top navigation, tables, and Compare beside the tree. */
const wideLayoutQuery = "(min-width: 900px)";

export function useIsWide(): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const mediaQueryList = window.matchMedia(wideLayoutQuery);
            mediaQueryList.addEventListener("change", onChange);
            return () => mediaQueryList.removeEventListener("change", onChange);
        },
        () => window.matchMedia(wideLayoutQuery).matches,
    );
}
