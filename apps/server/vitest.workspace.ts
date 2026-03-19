import { defineWorkspace } from "vitest/config";
import { resolve } from "path";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "unit",
    },
  },
  {
    extends: "./vitest.integration.config.ts",
    test: {
      name: "integration",
    },
  },
]);
