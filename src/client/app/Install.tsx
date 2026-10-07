import { Download, X } from "lucide-react";
import { Button } from "@heroui/react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Shown } from "../data/community";

type InstallPrompt = Event & { prompt: () => Promise<void> };

/** Whether this is the installed app, in its own window. */
export const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
const macSafari =
  /Macintosh/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/Chrome|Chromium|Edg|Firefox/.test(navigator.userAgent);

/** The steps to install, where the browser has no install prompt (Safari). */
export const installSteps = ios
  ? "install.ios"
  : macSafari
    ? "install.macSafari"
    : null;

const DISMISSED = "norless:install-dismissed";
const dismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
};

/** The browser's install prompt, once it offers one; caught once, for every menu. */
let offered: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const offer = (next: InstallPrompt | null) => {
  offered = next;
  for (const listener of listeners) listener();
};
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  offer(event as InstallPrompt);
});
window.addEventListener("appinstalled", () => offer(null));

export function useInstallPrompt() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => offered,
  );
}

/**
 * In a browser tab, a one-time suggestion to install the app: the browser's install
 * button where it has one, the steps where it doesn't (Safari). Dismissed, it doesn't
 * come back on this device.
 */
export function InstallSuggestion() {
  const { t } = useTranslation();
  const prompt = useInstallPrompt();
  const [hidden, setHidden] = useState(() => installed() || dismissed());
  if (hidden || (!prompt && !installSteps)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Asked again next visit.
    }
    setHidden(true);
  };
  return (
    <div
      role="region"
      aria-label={t("install.title")}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-separator px-4 py-2 text-sm"
    >
      <span className="flex-1">{t(installSteps ?? "install.why")}</span>
      {prompt && (
        <Button
          size="sm"
          onPress={() => void prompt.prompt().then(dismiss, dismiss)}
        >
          <Download />
          {t("install.install")}
        </Button>
      )}
      <Button size="sm" variant="ghost" onPress={dismiss}>
        <X />
        {t(prompt ? "install.notNow" : "install.ok")}
      </Button>
    </div>
  );
}

/** Install Norless, where the browser offers it, in a phone's menu. */
export function InstallLink() {
  const { t } = useTranslation();
  const prompt = useInstallPrompt();
  if (!prompt) return null;
  return (
    <Shown feature="install">
      <button
        type="button"
        className="link"
        onClick={() => void prompt.prompt()}
      >
        <Download />
        {t("install.install")}
      </button>
    </Shown>
  );
}
