import optimizeLocales from "@react-aria/optimize-locales-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

/** Short links, which the server redirects (short-codes.ts). */
const shortLink = /^\/(?=[a-zA-Z]*[2-9])[2-9a-zA-Z]{3,7}$/;

export default defineConfig({
  plugins: [
    // React Aria's own strings only in the interface languages (i18n.ts).
    {
      ...optimizeLocales.vite({ locales: ["en", "ro", "uk"] }),
      enforce: "pre",
    },
    react(),
    tailwindcss(),
    // The stylesheet without holding back index.html's placeholder:
    // fetched at once and applied when it arrives; main.tsx renders once it's applied.
    {
      name: "stylesheet-after-shell",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler: (html) =>
          html.replace(
            /<link rel="stylesheet"( crossorigin)? href="([^"]+\.css)">/,
            `<link rel="preload" as="style"$1 href="$2" onload="this.rel='stylesheet'" data-app-css>`,
          ),
      },
    },
    // The service worker (app-shell spec): the built files from the cache, so the app
    // opens offline; a new version waits for the page to take it (src/client/app/update.ts).
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // public/manifest.webmanifest stays as it is.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Every page is the app, but for what the server answers itself.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, shortLink],
        cleanupOutdatedCaches: true,
        // Push for the team schedule.
        importScripts: ["/push-sw.js"],
      },
    }),
  ],
  build: { outDir: "dist/client", emptyOutDir: true },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", ws: true },
      // Short links (letters and digits, at least one digit) redirect on the server.
      [shortLink.source]: "http://127.0.0.1:3000",
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "deploy/*.test.ts"],
  },
});
