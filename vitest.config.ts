import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      include: ["src/"],
      exclude: ["src/local.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
      },
    },
  },
});
