import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // vitest/ holds suites that must NOT live under src/: Next compiles every
    // file under src/ into the app graph, so a test importing a node builtin
    // (node:fs here) breaks `next build` with "the chunking context does not
    // support external modules". Playwright owns tests/, so this is its own dir.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "vitest/**/*.test.ts"],
    // src/lib/108heros-client is a self-contained sub-package with its own
    // package.json/node_modules/build pipeline (it publishes the 108heros-client
    // npm SDK) -- its own test suite needs deps only installed there.
    exclude: ["src/lib/108heros-client/**", "node_modules/**"],
  },
});
