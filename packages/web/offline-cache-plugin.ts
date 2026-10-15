import { createHash } from "node:crypto";
import type { Plugin } from "vite";

const serviceWorkerFileName = "sw.js";

/**
 * Emits a service worker that stores every file of the build, so the app,
 * including the engine and its data, opens without a connection. Each build
 * gets its own cache, named after the content of its files; the previous one
 * is dropped when the new worker takes over.
 *
 * Font files are the exception: the Japanese font is split into many files by
 * character range, and a page needs only a few of them, so each is stored the
 * first time the page asks for it instead of all of them up front.
 */
export function offlineCache(pageFileNames: readonly string[]): Plugin {
    return {
        name: "offline-cache",
        apply: "build",
        generateBundle(_outputOptions, bundle) {
            const builtFileNames = Object.keys(bundle).sort();
            const contentHash = createHash("sha256");
            for (const fileName of builtFileNames) {
                const builtFile = bundle[fileName];
                contentHash.update(fileName);
                contentHash.update(builtFile?.type === "chunk" ? builtFile.code : String(builtFile?.source ?? ""));
            }
            // Pages and files from the public folder are written after this hook, so they are named here.
            const filesToStore = [
                "./",
                ...pageFileNames.map((fileName) => `./${fileName}`),
                ...builtFileNames.filter((fileName) => !isFontFile(fileName)).map((fileName) => `./${fileName}`),
                "./manifest.webmanifest",
                "./icon.svg",
            ];
            this.emitFile({
                type: "asset",
                fileName: serviceWorkerFileName,
                source: serviceWorkerSource(`ro-ratorio-branch-${contentHash.digest("hex").slice(0, 16)}`, filesToStore),
            });
        },
    };
}

const fontFileExtension = /\.(woff2?|ttf|otf)$/;

function isFontFile(fileName: string): boolean {
    return fontFileExtension.test(fileName);
}

function serviceWorkerSource(cacheName: string, filesToStore: readonly string[]): string {
    return `const cacheName = ${JSON.stringify(cacheName)};
const filesToStore = ${JSON.stringify(filesToStore)};
const fontFileExtension = ${fontFileExtension.toString()};

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(cacheName)
            .then((cache) => cache.addAll(filesToStore))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) => Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
        return;
    }
    event.respondWith(
        caches.open(cacheName).then(async (cache) => {
            // Matching by address alone: the same file is asked for with different request headers.
            const stored = await cache.match(request.url, { ignoreSearch: true, ignoreVary: true });
            if (stored !== undefined) {
                return stored;
            }
            const response = await fetch(request);
            if (response.ok && fontFileExtension.test(new URL(request.url).pathname)) {
                await cache.put(request.url, response.clone());
            }
            return response;
        }),
    );
});
`;
}
