/** Where a new gist is written. A build code is pasted there by hand: saving one needs a GitHub sign-in, which stays with GitHub. */
export const newGistPage = "https://gist.github.com/";

const gistAddress = /^https:\/\/gist\.github(?:usercontent)?\.com\/(?:[\w-]+\/)?([0-9a-f]{20,40})(?:[/?#]\S*)?$/i;

/** The ID of the gist a pasted text points at, or `null` when the text is not the address of a gist. */
export function gistIdOf(text: string): string | null {
    return gistAddress.exec(text.trim())?.[1]?.toLowerCase() ?? null;
}

export type GistRead =
    | { readonly state: "read"; readonly text: string }
    | { readonly state: "failed"; readonly reason: "notFound" | "rateLimited" | "empty" | "unreachable" };

interface GistFile {
    readonly content?: unknown;
    readonly truncated?: unknown;
    readonly raw_url?: unknown;
}

type Fetch = (address: string, options?: { readonly headers?: Readonly<Record<string, string>> }) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/**
 * The text of a public gist's first file that has any, read from GitHub
 * without signing in. GitHub allows a few dozen such reads an hour from
 * one address.
 */
export async function readGist(gistId: string, fetchFrom: Fetch = fetch): Promise<GistRead> {
    try {
        const response = await fetchFrom(`https://api.github.com/gists/${gistId}`, { headers: { Accept: "application/vnd.github+json" } });
        if (!response.ok) {
            return { state: "failed", reason: response.status === 404 ? "notFound" : response.status === 403 || response.status === 429 ? "rateLimited" : "unreachable" };
        }
        const gist = await response.json();
        const files: GistFile[] = typeof gist === "object" && gist !== null && "files" in gist && typeof gist.files === "object" && gist.files !== null ? Object.values(gist.files) : [];
        for (const file of files) {
            // GitHub cuts a large file short in this answer and says where the whole of it is.
            if (file.truncated === true && typeof file.raw_url === "string" && new URL(file.raw_url).hostname === "gist.githubusercontent.com") {
                const whole = await fetchFrom(file.raw_url);
                if (whole.ok) {
                    return { state: "read", text: await whole.text() };
                }
            } else if (typeof file.content === "string" && file.content.trim() !== "") {
                return { state: "read", text: file.content };
            }
        }
        return { state: "failed", reason: "empty" };
    } catch {
        return { state: "failed", reason: "unreachable" };
    }
}
