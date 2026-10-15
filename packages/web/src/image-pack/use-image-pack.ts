import { useEffect, useState, useSyncExternalStore } from "react";
import { type PictureKind, pictureKeyOfPath, pictureKeysOf } from "./image-pack-model.ts";
import { type ImagePackStore, indexedDbImagePackStore, type StoredPicture } from "./image-pack-store.ts";
import { readZipEntries } from "./zip-reader.ts";

let store: ImagePackStore | undefined;
const sharedStore = () => (store ??= indexedDbImagePackStore());

/** The keys of the pictures in the pack. `null` until the browser's store was read. */
let pictureKeys: ReadonlySet<string> | null = null;
let isReadingKeys = false;
const addressOfKey = new Map<string, string>();
const listeners = new Set<() => void>();

function setPictureKeys(keys: ReadonlySet<string>) {
    pictureKeys = keys;
    for (const address of addressOfKey.values()) {
        URL.revokeObjectURL(address);
    }
    addressOfKey.clear();
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (pictureKeys === null && !isReadingKeys) {
        isReadingKeys = true;
        void sharedStore()
            .keys()
            .then((keys) => setPictureKeys(new Set(keys)));
    }
    return () => listeners.delete(listener);
}

/** How many pictures the pack holds. `null` while the browser's store is read. */
export function usePictureCount(): number | null {
    return useSyncExternalStore(subscribe, () => pictureKeys)?.size ?? null;
}

/** The address of the picture the pack has for a thing, or `null` when it has none or while it loads. */
export function usePicture(kind: PictureKind, id: number, name: string): string | null {
    const keys = useSyncExternalStore(subscribe, () => pictureKeys);
    const key = keys === null ? undefined : pictureKeysOf(kind, id, name).find((candidate) => keys.has(candidate));
    const [loaded, setLoaded] = useState<{ readonly key: string; readonly address: string } | null>(null);

    useEffect(() => {
        if (key === undefined) {
            return;
        }
        const known = addressOfKey.get(key);
        if (known !== undefined) {
            setLoaded({ key, address: known });
            return;
        }
        let isCurrent = true;
        void sharedStore()
            .get(key)
            .then((content) => {
                if (content === undefined || !isCurrent) {
                    return;
                }
                const address = addressOfKey.get(key) ?? URL.createObjectURL(content);
                addressOfKey.set(key, address);
                setLoaded({ key, address });
            });
        return () => {
            isCurrent = false;
        };
    }, [key, keys]);

    return key !== undefined && loaded?.key === key ? loaded.address : null;
}

export interface PicturesAdded {
    readonly addedCount: number;
    /** Files that are not pictures, and archives that could not be read. */
    readonly skippedCount: number;
}

/**
 * Adds the pictures among the chosen files to the pack: picture files, a
 * folder of them, or zip archives of them. A picture takes the place of
 * one already kept under the same name.
 */
export async function addPictures(files: readonly File[]): Promise<PicturesAdded> {
    const pictures: StoredPicture[] = [];
    let skippedCount = 0;
    const take = (path: string, content: Blob) => {
        const key = pictureKeyOfPath(path);
        if (key === null) {
            skippedCount++;
        } else {
            pictures.push({ key, content });
        }
    };
    for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
            try {
                for (const entry of await readZipEntries(file)) {
                    take(entry.path, entry.content);
                }
            } catch {
                skippedCount++;
            }
        } else {
            take(file.webkitRelativePath === "" ? file.name : file.webkitRelativePath, file);
        }
    }
    await sharedStore().putAll(pictures);
    setPictureKeys(new Set(await sharedStore().keys()));
    return { addedCount: pictures.length, skippedCount };
}

export async function removeAllPictures(): Promise<void> {
    await sharedStore().clear();
    setPictureKeys(new Set());
}
