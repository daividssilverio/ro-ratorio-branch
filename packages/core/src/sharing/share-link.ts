/** Where the app is published. Links made outside the app, by the CLI or the MCP server, open it here. */
export const publishedAppAddress = "https://daividssilverio.github.io/ro-ratorio-branch/";

/** A link to the app that carries a share code in its fragment, so the code never reaches a server. */
export function shareLinkOf(pageUrl: string, shareCode: string): string {
    const link = new URL(pageUrl);
    link.search = "";
    link.hash = shareCode;
    return link.href;
}

const shareCodeFragment = /^#(B\d+\.[A-Za-z0-9_-]+)$/;

/** The share code a page was opened with, if its URL fragment is one. */
export function shareCodeInFragment(urlFragment: string): string | null {
    return shareCodeFragment.exec(urlFragment)?.[1] ?? null;
}
