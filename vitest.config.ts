import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/tests/integration/**"],
    coverage: {
      reporter: ["text", "json", "json-summary", "html"],
      exclude: [
        "**/node_modules/**",
        "**/test/**",
        "**/src/components/ui/**", // UI components from shadcn
      ],
      thresholds: {
        // Ratchet thresholds: raise these as coverage improves. Target: 50%.
        statements: 3,
        branches: 50,
        functions: 30,
        lines: 3,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
