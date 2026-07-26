import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ["packages/*/test/**/*.test.ts", "src/**/*.test.ts"],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      all: true,
      include: ["packages/*/src/**/*.ts", "src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/assets/**", "src/main.ts"],
    },
  },
});
