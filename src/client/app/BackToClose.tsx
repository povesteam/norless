import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { installed } from "./Install";

/** The Navigation API's place in the history (Chromium); undefined elsewhere. */
const place = () =>
  (window as { navigation?: { currentEntry?: { index: number } } }).navigation
    ?.currentEntry?.index;

/**
 * The installed app on Android closes on back from its first page, which could lose it
 * mid-service: there, a guard entry over the first page takes the first back, which says
 * "Press back again to close"; a second back within 2 seconds closes the app, and after
 * that the guard comes back.
 */
export function BackToClose() {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!installed() || place() !== 0) return;
    const guard = () => history.pushState(history.state, "");
    guard();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pop = () => {
      if (place() !== 0) return;
      setAsking(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setAsking(false);
        if (place() === 0) guard();
      }, 2000);
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      clearTimeout(timer);
    };
  }, []);
  return asking ? (
    <p
      role="status"
      className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl bg-foreground px-4 py-2 text-background shadow-lg"
    >
      {t("app.backAgain")}
    </p>
  ) : null;
}
