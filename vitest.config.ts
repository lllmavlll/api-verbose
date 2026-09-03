import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "{app,components,lib}/**/*.test.{ts,tsx}",
      "scripts/**/*.test.mjs",
    ],
    passWithNoTests: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
