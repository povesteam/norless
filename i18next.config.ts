import { defineConfig } from "i18next-cli";

// i18next-cli's lint (`npm run check`): user-facing text in the client's JSX goes
// through t() (app-shell spec). Only lint: the locale files keep their own layout, and
// src/client/locales.test.ts compares them.
export default defineConfig({
  locales: ["en", "ro", "uk"],
  extract: {
    input: ["src/client/**/*.tsx"],
    ignore: ["src/**/*.test.tsx"],
    output: "src/client/locales/{{language}}.json",
  },
  lint: {
    checkConcatenation: "error",
  },
});
