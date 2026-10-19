import { defineConfig } from "vitest/config";
import { engineTestSettings } from "../../vitest.shared.ts";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        ...engineTestSettings,
    },
});
