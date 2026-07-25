import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/codec.ts",
        "src/error.ts",
        "src/result.ts",
      ],
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 60,
        statements: 72,
      },
    },
  },
});
