import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Tip } from "../ui/tip";

/**
 * The page a community's page goes back to when it was opened from a link, by its path
 * inside the community; null for a page at the top, which keeps the menu (app-shell
 * spec, Back on a phone).
 */
export function parentOf(path: string): string | null {
  const [area, id, sub] = path.split("/").filter(Boolean);
  if (area === "songs" && id && sub) return `/songs/${id}`;
  if (area === "songs" && id) return "/";
  if ((area === "recordings" || area === "settings") && id) return `/${area}`;
  return null;
}

type Navigation = {
  currentEntry?: { index: number };
  entries?: () => { url: string | null }[];
};

/**
 * Whether history's back stays in the app on another page: the entry before is Norless's
 * (the Navigation API lists only the app's own) and not the installed app's guard over
 * the same page (BackToClose). Without the Navigation API, false.
 */
function backStaysIn() {
  const navigation = (window as { navigation?: Navigation }).navigation;
  const index = navigation?.currentEntry?.index ?? 0;
  const before = index > 0 ? navigation?.entries?.()[index - 1]?.url : null;
  return !!before && before !== location.href;
}

/**
 * On a phone's bar, in the menu's place on a page below the top: back to the page it
 * came from, or to `to` when it was opened from a link. iPhones have no back button.
 */
export function BackButton({ to }: { to: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  return (
    <Tip label={t("app.back")}>
      <Button
        isIconOnly
        variant="ghost"
        aria-label={t("app.back")}
        onPress={() => (backStaysIn() ? history.back() : navigate(to))}
      >
        <ArrowLeft className="size-6" />
      </Button>
    </Tip>
  );
}
