/**
 * Vitest config for the Marcus Krispy (Next.js App Router, TS) test suite.
 *
 * - Resolves the `@/*` path alias to the project root (matching tsconfig.json):
 *   `resolve.tsconfigPaths` reads tsconfig natively (Vite 8+), and an explicit
 *   `@` alias is kept as a belt-and-suspenders fallback so resolution never
 *   depends on tsconfig parsing.
 * - Uses the `node` environment: every test here exercises lib/route logic, not
 *   React rendering. (Switch a single file to jsdom with a `// @vitest-environment
 *   jsdom` docblock if a component test is ever added.)
 * - No app behavior is changed — this file is test-only tooling.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Mirror tsconfig's `"@/*": ["./*"]` so `@/lib/...` resolves to the root.
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**", "app/script/Markdown.tsx"],
      reporter: ["text", "text-summary"],
    },
  },
});
