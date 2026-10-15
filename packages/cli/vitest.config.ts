import { defineConfig } from "vitest/config";
import { engineTestTimeouts } from "../../vitest.shared.ts";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        ...engineTestTimeouts,
    },
});
