import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue({})],
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".vue"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@townsquare/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url),
      ),
      "@townsquare/contracts/legacy-envelope": fileURLToPath(
        new URL("./packages/contracts/src/legacy-envelope.ts", import.meta.url),
      ),
      "@townsquare/contracts/legacy-client-command": fileURLToPath(
        new URL(
          "./packages/contracts/src/legacy-client-command.ts",
          import.meta.url,
        ),
      ),
      "@townsquare/contracts/legacy-session-command": fileURLToPath(
        new URL(
          "./packages/contracts/src/legacy-session-command.ts",
          import.meta.url,
        ),
      ),
      "@townsquare/contracts/custom-script": fileURLToPath(
        new URL("./packages/contracts/src/custom-script.ts", import.meta.url),
      ),
      "@townsquare/contracts/game-state": fileURLToPath(
        new URL("./packages/contracts/src/game-state.ts", import.meta.url),
      ),
      "@townsquare/contracts/dynamic-init": fileURLToPath(
        new URL("./packages/contracts/src/dynamic-init.ts", import.meta.url),
      ),
      "@townsquare/contracts/local-storage": fileURLToPath(
        new URL("./packages/contracts/src/local-storage.ts", import.meta.url),
      ),
    },
  },
  build: {
    sourcemap: false,
  },
});
