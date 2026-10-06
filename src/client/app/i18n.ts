import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";

// English is in the bundle, as the fallback; the others load when chosen.
const others: Record<string, () => Promise<{ default: object }>> = {
  ro: () => import("../locales/ro.json"),
  uk: () => import("../locales/uk.json"),
};

export const uiLanguages = ["en", ...Object.keys(others)];

/** Loads a language's strings once, e.g. for an export in the playlist's language. */
export async function loadLanguage(code: string) {
  const loader = others[code];
  if (loader && !i18n.hasResourceBundle(code, "translation"))
    i18n.addResourceBundle(code, "translation", (await loader()).default);
}

// English for everyone until the Romanian and Ukrainian texts are reviewed; they stay complete, so the choice can come back by setting this.
export const languageChoice = false;

// ponytail: saved per device; member profiles keep it once there are logins.
const STORAGE_KEY = "norless.language";
const saved = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
})();

// A link from the old Ukrainian app asks for its language once (?lang=uk).
const params = new URLSearchParams(location.search);
const asked = params.get("lang");
if (asked) {
  params.delete("lang");
  const rest = params.toString();
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`,
  );
}

// The language asked for, else the saved choice, else the first browser language we
// support, else English.
const lng = !languageChoice
  ? "en"
  : ([asked, saved, ...navigator.languages.map((tag) => tag.slice(0, 2))].find(
      (code) => code !== null && uiLanguages.includes(code),
    ) ?? "en");

await i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng,
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
});
await loadLanguage(lng);

document.documentElement.lang = lng;
if (asked && asked === lng) {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Kept for this visit.
  }
}

export async function chooseLanguage(code: string) {
  await loadLanguage(code);
  await i18n.changeLanguage(code);
  document.documentElement.lang = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode: the choice lasts until the tab closes.
  }
}

export default i18n;
