/** One picture of a pack, under the key it is found by. */
export interface StoredPicture {
    readonly key: string;
    readonly content: Blob;
}

/** Where the pictures a user loaded are kept between visits: in this browser only. */
export interface ImagePackStore {
    keys(): Promise<string[]>;
    get(key: string): Promise<Blob | undefined>;
    putAll(pictures: readonly StoredPicture[]): Promise<void>;
    clear(): Promise<void>;
}

const databaseName = "ro-ratorio-branch-images";
const objectStoreName = "pictures";

/** A store in the browser's IndexedDB. When the browser refuses storage, it holds nothing. */
export function indexedDbImagePackStore(): ImagePackStore {
    function inTransaction<Result>(mode: IDBTransactionMode, use: (objectStore: IDBObjectStore) => IDBRequest<Result> | undefined): Promise<Result | undefined> {
        return new Promise((resolve, reject) => {
            const opening = indexedDB.open(databaseName, 1);
            opening.onupgradeneeded = () => opening.result.createObjectStore(objectStoreName);
            opening.onerror = () => reject(opening.error);
            opening.onsuccess = () => {
                const database = opening.result;
                const transaction = database.transaction(objectStoreName, mode);
                const request = use(transaction.objectStore(objectStoreName));
                transaction.oncomplete = () => {
                    database.close();
                    resolve(request?.result);
                };
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            };
        });
    }

    return {
        keys: () => inTransaction("readonly", (objectStore) => objectStore.getAllKeys()).then((keys) => (keys ?? []).map(String), () => []),
        get: (key) => inTransaction<Blob | undefined>("readonly", (objectStore) => objectStore.get(key)).catch(() => undefined),
        putAll: (pictures) =>
            inTransaction("readwrite", (objectStore) => {
                for (const { key, content } of pictures) {
                    objectStore.put(content, key);
                }
                return undefined;
            }).then(() => undefined),
        clear: () => inTransaction("readwrite", (objectStore) => objectStore.clear()).then(() => undefined),
    };
}
