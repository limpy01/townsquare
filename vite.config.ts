import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue({})],
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".vue"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@townsquare/contracts/legacy-envelope": fileURLToPath(
        new URL("./packages/contracts/src/legacy-envelope.ts", import.meta.url),
      ),
    },
  },
  build: {
    sourcemap: false,
  },
});
