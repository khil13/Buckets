/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves a project site under /<repo-name>/, not the domain
// root — the workflow that builds for Pages sets VITE_BASE_PATH=/Buckets/.
// Netlify (or any host serving from a domain root) doesn't need this.
const basePath = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Buckets",
        short_name: "Buckets",
        description: "NBA betting research: matchup context, props, and model edge in one place.",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        start_url: basePath,
        scope: basePath,
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
