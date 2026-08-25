import { defineConfig } from "vitest/config";

// A vitest config local to this sub-package.
//
// Without it, running `vitest` here walks up the directory tree and loads the
// repo-root vitest.config.ts, which (a) imports `vite-tsconfig-paths` -- a
// root-only devDep not installed in this package's isolated node_modules, so
// config load fails with "Cannot find module 'vite-tsconfig-paths'" in CI
// (where the sub-package test runs before the root install) -- and (b)
// deliberately excludes `src/lib/108heros-client/**`, which would make this
// suite silently run zero tests. This package uses relative imports only, so
// no path-alias plugin is needed.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
