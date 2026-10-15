import {
    addTreeToWorkspace,
    emptyWorkspace,
    parseTree,
    parseWorkspace,
    type Tree,
    type Workspace,
} from "@ro-ratorio-branch/core/platform-neutral";

/** Where the workspace document is kept between visits. */
export interface WorkspaceStore {
    /** The stored document as it was saved, or `undefined` when nothing is stored or storage cannot be read. */
    load(): Promise<unknown>;
    save(workspace: Workspace): Promise<void>;
}

export interface OpenedWorkspace {
    readonly workspace: Workspace;
    readonly activeTreeId: string;
    readonly origin: "stored" | "earlierVersionTree" | "example";
}

const lastOpenTreeStorageKey = "ro-ratorio-branch.open-tree";

/** Which tree was open last time in this browser. Kept apart from the workspace: it is where the user was, not what they made. */
export function loadLastOpenTreeId(): string | null {
    try {
        return window.localStorage.getItem(lastOpenTreeStorageKey);
    } catch {
        return null;
    }
}

export function storeLastOpenTreeId(treeId: string): void {
    try {
        window.localStorage.setItem(lastOpenTreeStorageKey, treeId);
    } catch {
        // Without storage the app opens on the first tree next time.
    }
}

/**
 * The workspace to start with: the stored one when it is valid; otherwise one
 * made from the single tree an earlier version of the app kept; otherwise one
 * made from the example tree.
 */
export async function openWorkspace(store: WorkspaceStore, earlierVersionTreeText: string | null, exampleTree: Tree, lastOpenTreeId: string | null = null): Promise<OpenedWorkspace> {
    const storedWorkspace = validWorkspaceOrUndefined(await store.load());
    const firstStoredTreeId = storedWorkspace === undefined ? undefined : Object.keys(storedWorkspace.trees)[0];
    if (storedWorkspace !== undefined && firstStoredTreeId !== undefined) {
        // The tree that was open last time, as long as the workspace still has it.
        const activeTreeId = lastOpenTreeId !== null && Object.hasOwn(storedWorkspace.trees, lastOpenTreeId) ? lastOpenTreeId : firstStoredTreeId;
        return { workspace: storedWorkspace, activeTreeId, origin: "stored" };
    }

    const earlierVersionTree = validTreeOrUndefined(earlierVersionTreeText);
    const added = addTreeToWorkspace(storedWorkspace ?? emptyWorkspace(), earlierVersionTree ?? exampleTree, "ツリー 1");
    return {
        workspace: added.workspace,
        activeTreeId: added.treeId,
        origin: earlierVersionTree === undefined ? "example" : "earlierVersionTree",
    };
}

function validWorkspaceOrUndefined(candidate: unknown): Workspace | undefined {
    try {
        return candidate === undefined ? undefined : parseWorkspace(candidate);
    } catch {
        return undefined;
    }
}

function validTreeOrUndefined(treeText: string | null): Tree | undefined {
    try {
        return treeText === null ? undefined : parseTree(JSON.parse(treeText));
    } catch {
        return undefined;
    }
}

const databaseName = "ro-ratorio-branch";
const objectStoreName = "documents";
const workspaceKey = "workspace";

/** A store in the browser's IndexedDB. When the browser refuses storage, it loads nothing and saving does nothing. */
export function indexedDbWorkspaceStore(): WorkspaceStore {
    function withObjectStore<Result>(mode: IDBTransactionMode, use: (objectStore: IDBObjectStore) => IDBRequest<Result>): Promise<Result> {
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
                    resolve(request.result);
                };
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            };
        });
    }

    return {
        load: () => withObjectStore<unknown>("readonly", (objectStore) => objectStore.get(workspaceKey)).catch(() => undefined),
        save: (workspace) =>
            withObjectStore("readwrite", (objectStore) => objectStore.put(workspace, workspaceKey)).then(
                () => undefined,
                () => undefined,
            ),
    };
}
