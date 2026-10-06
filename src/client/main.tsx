import "./index.css";
import "./app/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./app/Root";
// The service worker: the app opens offline, and new versions wait to be taken.
import "./app/update";

// Light or dark follows the system, whatever is switched on.
const dark = window.matchMedia("(prefers-color-scheme: dark)");
const applyScheme = () =>
  document.documentElement.classList.toggle("dark", dark.matches);
applyScheme();
dark.addEventListener("change", applyScheme);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// The built stylesheet arrives beside index.html's placeholder (in
// vite.config.ts): the app renders once it's applied, so it never shows unstyled, or
// without it if it fails.
const css = document.querySelector<HTMLLinkElement>("link[data-app-css]");
const styled = new Promise<void>((resolve) => {
  if (!css || css.sheet) return resolve();
  const done = () => {
    // The first load is the fetch; the sheet applies with the next.
    if (!css.sheet) return;
    css.removeEventListener("load", done);
    resolve();
  };
  css.addEventListener("load", done);
  css.addEventListener("error", () => resolve());
});
void styled.then(() =>
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  ),
);
