import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    proxy: {
      "/rpc": "http://localhost:8787",
    },
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    cloudflare(),
  ],
});
