import { useState } from "react";
import { loadDisplayPreferences, storeDisplayPreferences } from "./display-preferences.ts";
import { menuLanguage } from "./ui-text.ts";

const furiganaOffClass = "furigana-off";

/** Puts the stored furigana choice on the page. Called once, before the first render. */
export function applyStoredFuriganaChoice(): void {
    document.documentElement.classList.toggle(furiganaOffClass, !loadDisplayPreferences().showsFurigana);
}

/** The two choices of how text is shown: furigana over kanji, and the language of the app's own words. */
export function DisplayToggles() {
    const [showsFurigana, setShowsFurigana] = useState(() => loadDisplayPreferences().showsFurigana);

    function toggleFurigana() {
        const next = !showsFurigana;
        storeDisplayPreferences({ ...loadDisplayPreferences(), showsFurigana: next });
        document.documentElement.classList.toggle(furiganaOffClass, !next);
        setShowsFurigana(next);
    }

    // Texts held in module-level tables are read once, so the page starts again in the other language.
    function switchMenuLanguage() {
        storeDisplayPreferences({ ...loadDisplayPreferences(), menuLanguage: menuLanguage === "ja" ? "en" : "ja" });
        window.location.reload();
    }

    return (
        <div className="display-toggles">
            <button type="button" className="display-toggle" aria-pressed={showsFurigana} onClick={toggleFurigana}>
                <ruby>
                    振<rt>ふ</rt>
                </ruby>
                {menuLanguage === "ja" ? "ふりがな" : "Furigana"}
            </button>
            <button type="button" className="display-toggle" lang={menuLanguage === "ja" ? "en" : "ja"} onClick={switchMenuLanguage}>
                {menuLanguage === "ja" ? "English" : "日本語"}
            </button>
        </div>
    );
}
