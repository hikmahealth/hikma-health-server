import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
// import viteTsConfigPaths from "vite-tsconfig-paths";
import { devtools } from "@tanstack/devtools-vite";
// import { nitro } from "nitro/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";

// import { wrapVinxiConfigWithSentry } from "@sentry/tanstackstart-react";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  // plugins: [
  //   // this is the plugin that enables path aliases
  //   viteTsConfigPaths({
  //     projects: ["./tsconfig.json"],
  //   }),
  //   tailwindcss(),
  //   tanstackStart(),
  // ],
  plugins: [
    devtools(),
    // nitro({
    //   rollupConfig: {
    //     external: [/^@sentry\//, "exceljs", /^echarts/, "zrender"],
    //   },
    //   preset: "render_com",
    // }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    // nitro(),
    viteReact(),
    sentryTanstackStart({
      org: process.env.VITE_SENTRY_ORG,
      project: process.env.VITE_SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
    }),
  ],
  esbuild: {
    jsx: "automatic",
  },
  server: {
    allowedHosts: true,
  },
});
