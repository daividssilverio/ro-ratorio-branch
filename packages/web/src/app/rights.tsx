import { t } from "./text/ui-text.ts";

/** The line the game's rights holders ask fan works to show under their copyright. */
export const reuseNotice = "当コンテンツの再利用（再転載・配布など）は、禁止しています。";

/** Where the build puts the licence the app is under, next to the page. */
const licenceFileName = "./LICENSE.txt";

const upstreamProjectAddress = "https://github.com/roratorio-hub/ratorio";
const questionsAddress = "https://github.com/daividssilverio/ro-ratorio-branch/issues";

/** What this app is, whose engine it borrows, where questions go, and where its licence and credits are. */
export function ProjectCredit() {
    return (
        <>
            {t("ROラトリオ Branch は、ROラトリオHUB の計算エンジンをお借りして作った、個人による非公式のファンメイドツールです（非営利）。")}{" "}
            {t("ROラトリオHUB 公式のものではありません。本ツールについてのお問い合わせは、ROラトリオHUB の開発者様ではなく、本ツールの GitHub へお願いいたします。")}{" "}
            <a href={upstreamProjectAddress} target="_blank" rel="noreferrer">
                ROラトリオHUB
            </a>
            {" · "}
            <a href={questionsAddress} target="_blank" rel="noreferrer">
                {t("お問い合わせ")}
            </a>
            {" · "}
            <a href={licenceFileName}>{t("ライセンス・クレジット")}</a>
        </>
    );
}
