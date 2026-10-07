import { RotateCw, Sparkles, X } from "lucide-react";
import { Button } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tip } from "../ui/tip";
import { useLocation } from "wouter";
import { takeNewVersion, useNewVersion } from "./update";

/** Screens and stage devices, which take a new version by themselves (ReloadWhenIdle). */
const screens = /^\/(pair$|s\/)|^\/[^/]+\/(projector|local)\/|^\/[^/]+\/stage$/;

/**
 * Controllers' and members' pages: a new version is ready, with Reload. Nothing reloads
 * under them, so it waits, over the page and moving nothing, until they press it, or
 * close it until the next version.
 */
export function NewVersionNotice() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const waiting = useNewVersion();
  const [closed, setClosed] = useState(0);
  if (waiting <= closed || screens.test(location)) return null;
  return (
    <section
      aria-label={t("update.label")}
      className="fixed inset-x-4 top-2 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-separator bg-overlay py-1.5 ps-3 pe-1.5 text-sm shadow-lg"
    >
      <Sparkles className="shrink-0" />
      <p className="min-w-0 flex-1">{t("update.ready")}</p>
      <Button size="sm" onPress={takeNewVersion}>
        <RotateCw />
        {t("update.reload")}
      </Button>
      <Tip label={t("update.close")}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={t("update.close")}
          onPress={() => setClosed(waiting)}
        >
          <X />
        </Button>
      </Tip>
    </section>
  );
}
