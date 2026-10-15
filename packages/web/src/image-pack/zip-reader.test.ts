import { describe, expect, it } from "vitest";
import { readZipEntries } from "./zip-reader.ts";

interface FileToArchive {
    readonly path: string;
    readonly text: string;
    readonly isDeflated: boolean;
}

const bytesOf = (...numbers: [value: number, byteCount: 2 | 4][]) => {
    const view = new DataView(new ArrayBuffer(numbers.reduce((total, [, byteCount]) => total + byteCount, 0)));
    let position = 0;
    for (const [value, byteCount] of numbers) {
        if (byteCount === 2) {
            view.setUint16(position, value, true);
        } else {
            view.setUint32(position, value, true);
        }
        position += byteCount;
    }
    return new Uint8Array(view.buffer);
};

/** A zip archive put together by hand, the way an archiver writes one. The checksums are left at 0: the reader does not check them. */
async function zipOf(files: readonly FileToArchive[]): Promise<Blob> {
    const parts: Uint8Array[] = [];
    const directoryParts: Uint8Array[] = [];
    let position = 0;
    for (const { path, text, isDeflated } of files) {
        const name = new TextEncoder().encode(path);
        const plain = new TextEncoder().encode(text);
        const content = isDeflated ? new Uint8Array(await new Response(new Blob([plain]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()) : plain;
        const method = isDeflated ? 8 : 0;
        const localHeader = bytesOf([0x04034b50, 4], [20, 2], [0x0800, 2], [method, 2], [0, 2], [0, 2], [0, 4], [content.length, 4], [plain.length, 4], [name.length, 2], [0, 2]);
        directoryParts.push(
            bytesOf([0x02014b50, 4], [20, 2], [20, 2], [0x0800, 2], [method, 2], [0, 2], [0, 2], [0, 4], [content.length, 4], [plain.length, 4], [name.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [position, 4]),
            name,
        );
        parts.push(localHeader, name, content);
        position += localHeader.length + name.length + content.length;
    }
    const directorySize = directoryParts.reduce((total, part) => total + part.length, 0);
    const end = bytesOf([0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [directorySize, 4], [position, 4], [0, 2]);
    return new Blob([...parts, ...directoryParts, end] as BlobPart[]);
}

describe("readZipEntries", () => {
    it("reads files stored as they are and deflated files, with their paths", async () => {
        const archive = await zipOf([
            { path: "pack/item/メロンメイス.png", text: "stored bytes", isDeflated: false },
            { path: "pack/monster/ポリン.png", text: "deflated bytes ".repeat(40), isDeflated: true },
        ]);
        const entries = await readZipEntries(archive);

        expect(entries.map((entry) => entry.path)).toEqual(["pack/item/メロンメイス.png", "pack/monster/ポリン.png"]);
        expect(await entries[0]?.content.text()).toBe("stored bytes");
        expect(await entries[1]?.content.text()).toBe("deflated bytes ".repeat(40));
    });

    it("leaves out folders", async () => {
        const entries = await readZipEntries(await zipOf([{ path: "pack/", text: "", isDeflated: false }, { path: "pack/a.png", text: "a", isDeflated: false }]));

        expect(entries.map((entry) => entry.path)).toEqual(["pack/a.png"]);
    });

    it("refuses bytes that are not a zip archive", async () => {
        await expect(readZipEntries(new Blob(["just some text that is long enough to look at"]))).rejects.toBeInstanceOf(RangeError);
        await expect(readZipEntries(new Blob([]))).rejects.toBeInstanceOf(RangeError);
    });
});
