/** One file of a zip archive. */
export interface ZipEntry {
    readonly path: string;
    readonly content: Blob;
}

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectoryEntrySignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;
const endOfCentralDirectoryLength = 22;
const longestArchiveComment = 0xffff;
const storedMethod = 0;
const deflatedMethod = 8;
const nameIsUtf8Flag = 0x0800;

/**
 * The files of a zip archive, read in the browser. Reads what ordinary
 * archives hold: files stored as they are or deflated. An archive that is
 * encrypted, split or larger than 4 GB is not read.
 *
 * @throws {RangeError} when the bytes are not a zip archive this reads.
 */
export async function readZipEntries(archive: Blob): Promise<ZipEntry[]> {
    const tail = new DataView(await archive.slice(Math.max(0, archive.size - endOfCentralDirectoryLength - longestArchiveComment)).arrayBuffer());
    let endPosition = tail.byteLength - endOfCentralDirectoryLength;
    while (endPosition >= 0 && tail.getUint32(endPosition, true) !== endOfCentralDirectorySignature) {
        endPosition--;
    }
    if (endPosition < 0) {
        throw new RangeError("Not a zip archive");
    }
    const entryCount = tail.getUint16(endPosition + 10, true);
    const directorySize = tail.getUint32(endPosition + 12, true);
    const directoryStart = tail.getUint32(endPosition + 16, true);
    const directory = new DataView(await archive.slice(directoryStart, directoryStart + directorySize).arrayBuffer());

    const entries: ZipEntry[] = [];
    let position = 0;
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
        if (position + 46 > directory.byteLength || directory.getUint32(position, true) !== centralDirectoryEntrySignature) {
            throw new RangeError("The zip archive's list of files is damaged");
        }
        const flags = directory.getUint16(position + 8, true);
        const method = directory.getUint16(position + 10, true);
        const compressedSize = directory.getUint32(position + 20, true);
        const nameLength = directory.getUint16(position + 28, true);
        const extraLength = directory.getUint16(position + 30, true);
        const commentLength = directory.getUint16(position + 32, true);
        const localHeaderStart = directory.getUint32(position + 42, true);
        const nameBytes = new Uint8Array(directory.buffer, directory.byteOffset + position + 46, nameLength);
        // Archives made in Japan without the UTF-8 flag name their files in Shift_JIS.
        const path = new TextDecoder((flags & nameIsUtf8Flag) !== 0 ? "utf-8" : "shift_jis").decode(nameBytes);
        position += 46 + nameLength + extraLength + commentLength;

        if (path.endsWith("/") || (method !== storedMethod && method !== deflatedMethod)) {
            continue;
        }
        const localHeader = new DataView(await archive.slice(localHeaderStart, localHeaderStart + 30).arrayBuffer());
        if (localHeader.byteLength < 30 || localHeader.getUint32(0, true) !== localFileHeaderSignature) {
            throw new RangeError("A file in the zip archive is damaged");
        }
        const contentStart = localHeaderStart + 30 + localHeader.getUint16(26, true) + localHeader.getUint16(28, true);
        const stored = archive.slice(contentStart, contentStart + compressedSize);
        const content = method === storedMethod ? stored : await new Response(stored.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
        entries.push({ path, content });
    }
    return entries;
}
