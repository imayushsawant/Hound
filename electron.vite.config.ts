import { resolve } from "node:path";
import { cpSync } from "node:fs";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [
      {
        name: "copy-sql-migrations",
        closeBundle() {
          cpSync("electron/main/db/migrations", "out/main/migrations", { recursive: true });
        },
      },
    ],
    build: {
      rollupOptions: { input: resolve("electron/main/index.ts") },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve("electron/preload/index.ts"),
        output: { format: "cjs", entryFileNames: "index.cjs" },
      },
    },
  },
  renderer: {
    root: ".",
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "hound-document",
        transformIndexHtml: (html) =>
          html.replace("<!-- figma:lang -->", "en").replace("<!-- figma:title -->", "Hound"),
      },
    ],
    build: { rollupOptions: { input: resolve("index.html") } },
  },
});
