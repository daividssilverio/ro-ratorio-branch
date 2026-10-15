import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { applyStoredFuriganaChoice } from "./app/text/DisplayToggles.tsx";
import { menuLanguage } from "./app/text/ui-text.ts";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./styles.css";

document.documentElement.lang = menuLanguage;
applyStoredFuriganaChoice();

const appElement = document.getElementById("app");
if (appElement === null) {
    throw new Error("The page has no #app element");
}
createRoot(appElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
    // Without the worker the app still runs; it just needs a connection to open.
    void navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}
