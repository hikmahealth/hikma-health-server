import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// will use default port
const port = process.env.APP_PORT ? parseInt(process.env.APP_PORT) : undefined;

const config = defineConfig({
  server: {
    port,
    host: process.env.APP_ENV === "prod" ? "0.0.0.0" : undefined,
  },
  plugins: [
    tailwindcss(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
    nitro(),
  ],
});

export default config;
