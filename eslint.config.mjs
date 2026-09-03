import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested git worktrees. Several agents and sessions drive this repo at once
    // and keep their checkouts under these paths, so from the repo root a bare
    // `pnpm lint` walked three extra full copies of the app -- 2460 files and
    // 3228 errors, none of them this checkout's code. That made the command mean
    // something different depending on which directory you ran it from, which is
    // exactly the kind of thing that gets mistaken for a real regression.
    ".worktrees/**",
    ".claude/worktrees/**",
  ]),
  {
    rules: {
      // Surface explicit any usages as warnings to guide cleanup.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
