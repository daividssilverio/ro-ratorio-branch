import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/**
 * Puts licence texts next to the page, so that anyone who gets the app from
 * a host also gets the terms and notices they require. Each published file
 * joins its sources in order.
 */
export function licenceFiles(sourcesOfPublishedFile: Readonly<Record<string, readonly string[]>>): Plugin {
    return {
        name: "licence-files",
        apply: "build",
        generateBundle() {
            for (const [fileName, sourcePaths] of Object.entries(sourcesOfPublishedFile)) {
                this.emitFile({ type: "asset", fileName, source: sourcePaths.map((sourcePath) => readFileSync(sourcePath, "utf8").trim()).join("\n\n---\n\n") + "\n" });
            }
        },
    };
}
