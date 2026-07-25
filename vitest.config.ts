import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/_testkit.ts",
        "src/compat/**",
        "src/index.ts",
        "src/result.ts",
        "src/types.ts",
      ],
      thresholds: {
        lines: 98,
        functions: 95,
        branches: 88,
        statements: 98,
      },
    },
  },
});
