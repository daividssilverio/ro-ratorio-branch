import { describe, expect, it } from "vitest";
import { gistIdOf, readGist } from "./gist.ts";

const gistId = "0123456789abcdef0123456789abcdef";

describe("gistIdOf", () => {
    it.each([
        { text: `https://gist.github.com/someone/${gistId}`, id: gistId },
        { text: `  https://gist.github.com/${gistId}\n`, id: gistId },
        { text: `https://gist.github.com/some-one/${gistId.toUpperCase()}#file-build-txt`, id: gistId },
        { text: `https://gist.githubusercontent.com/someone/${gistId}/raw/abc/build.txt`, id: gistId },
        { text: "https://gist.github.com/someone", id: null },
        { text: `https://example.com/someone/${gistId}`, id: null },
        { text: `see https://gist.github.com/someone/${gistId}`, id: null },
        { text: "B1.lVZPb-NEHP0q1e", id: null },
    ])("reads $text as $id", ({ text, id }) => {
        expect(gistIdOf(text)).toBe(id);
    });
});

describe("readGist", () => {
    const answering = (answers: Readonly<Record<string, { status: number; body: unknown }>>) => {
        const asked: string[] = [];
        const fetchFrom = async (address: string) => {
            asked.push(address);
            const answer = answers[address];
            if (answer === undefined) {
                throw new TypeError("network down");
            }
            return { ok: answer.status === 200, status: answer.status, json: async () => answer.body, text: async () => String(answer.body) };
        };
        return { asked, fetchFrom };
    };
    const gistAddress = `https://api.github.com/gists/${gistId}`;

    it("gives the text of the first file that has any", async () => {
        const { asked, fetchFrom } = answering({ [gistAddress]: { status: 200, body: { files: { "a.txt": { content: "  " }, "build.txt": { content: "B1.code" } } } } });

        expect(await readGist(gistId, fetchFrom)).toEqual({ state: "read", text: "B1.code" });
        expect(asked).toEqual([gistAddress]);
    });

    it("fetches the whole of a file GitHub cut short, from GitHub's own host only", async () => {
        const rawAddress = `https://gist.githubusercontent.com/someone/${gistId}/raw/build.txt`;
        const cutShort = answering({ [gistAddress]: { status: 200, body: { files: { "build.txt": { content: "B1.co", truncated: true, raw_url: rawAddress } } } }, [rawAddress]: { status: 200, body: "B1.code" } });
        const elsewhere = answering({ [gistAddress]: { status: 200, body: { files: { "build.txt": { truncated: true, raw_url: "https://example.com/build.txt" } } } } });

        expect(await readGist(gistId, cutShort.fetchFrom)).toEqual({ state: "read", text: "B1.code" });
        expect(await readGist(gistId, elsewhere.fetchFrom)).toEqual({ state: "failed", reason: "empty" });
        expect(elsewhere.asked).toEqual([gistAddress]);
    });

    it.each([
        { situation: "a gist that does not exist", answers: { [gistAddress]: { status: 404, body: {} } }, reason: "notFound" },
        { situation: "too many reads in an hour", answers: { [gistAddress]: { status: 403, body: {} } }, reason: "rateLimited" },
        { situation: "a gist without text", answers: { [gistAddress]: { status: 200, body: { files: {} } } }, reason: "empty" },
        { situation: "an answer that is not a gist", answers: { [gistAddress]: { status: 200, body: "nope" } }, reason: "empty" },
        { situation: "no connection", answers: {}, reason: "unreachable" },
    ])("says why it could not read $situation", async ({ answers, reason }) => {
        expect(await readGist(gistId, answering(answers).fetchFrom)).toEqual({ state: "failed", reason });
    });
});
