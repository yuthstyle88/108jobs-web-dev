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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // src/lib/108heros-client is a self-contained sub-package with its own
    // package.json/node_modules/build pipeline (it publishes the 108heros-client
    // npm SDK) -- its own test suite needs deps only installed there.
    exclude: ["src/lib/108heros-client/**", "node_modules/**"],
  },
});
