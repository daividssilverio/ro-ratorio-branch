import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { licenceFiles } from "./licence-file-plugin.ts";
import { offlineCache } from "./offline-cache-plugin.ts";
import { engineTestTimeouts } from "../../vitest.shared.ts";

const pathOf = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));
const shippedFonts = ["@fontsource/ibm-plex-sans", "@fontsource/ibm-plex-mono", "@fontsource-variable/noto-sans-jp"];

export default defineConfig({
    // Relative asset paths, so the build works from any folder of a static host.
    base: "./",
    plugins: [react(), licenceFiles({ "LICENSE.txt": [pathOf("../../LICENSE")], "FONT-LICENSES.txt": shippedFonts.map((fontPackage) => pathOf(`./node_modules/${fontPackage}/LICENSE`)) }), offlineCache(["index.html", "engine-host.html"])],
    build: {
        target: "es2023",
        rollupOptions: {
            input: {
                app: fileURLToPath(new URL("./index.html", import.meta.url)),
                engineHost: fileURLToPath(new URL("./engine-host.html", import.meta.url)),
            },
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        ...engineTestTimeouts,
    },
});
