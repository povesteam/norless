import { PanelTop, X } from "lucide-react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { Page } from "../../server/playlists/pages";
import { useCommunity, useShows } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { sendLive } from "../data/room";
import { WelcomeIcon } from "../ui/icons";

/**
 * The community's pages, used now and then: one small button with a menu of them. While
 * one is on the screens, the button shows its name, and its menu marks it, offers the
 * others and takes it off.
 */
export function Pages({
  live,
  narrow = false,
}: {
  live: string | null;
  /** On a narrow page, only the icon (the name of a page on the screens stays). */
  narrow?: boolean;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const listed = useJson<Page[]>(
    `/api/communities/${slug}/pages`,
    useChanges(slug, "pages"),
  ).data;
  // The built-in welcome page first, once it's switched on.
  const pages = [
    ...(shows("welcome") ? [{ id: "welcome", name: t("welcome.name") }] : []),
    ...(listed ?? []),
  ];
  if (!pages.length) return null;
  const show = (pageId: string | null) =>
    void sendLive(slug, { type: "page", pageId });
  const current = pages.find((page) => page.id === live);
  return (
    <Dropdown>
      {current ? (
        <Button
          size="sm"
          aria-label={t("pages.showing", { name: current.name })}
        >
          <PanelTop />
          {current.name}
        </Button>
      ) : (
        <Button size="sm" variant="tertiary" aria-label={t("pages.title")}>
          <PanelTop />
          <span className={narrow ? "max-[749px]:sr-only" : undefined}>
            {t("pages.title")}
          </span>
        </Button>
      )}
      <Dropdown.Popover placement="top start">
        <Dropdown.Menu
          aria-label={t("pages.title")}
          onAction={(key) => key === "clear" && show(null)}
        >
          <Dropdown.Section
            selectionMode="single"
            selectedKeys={current ? [current.id] : []}
            onSelectionChange={(keys) => {
              const [key] = keys === "all" ? [] : keys;
              if (key !== undefined) show(String(key));
            }}
          >
            {pages.map((page) => (
              <Dropdown.Item key={page.id} id={page.id} textValue={page.name}>
                <Dropdown.ItemIndicator type="dot" />
                {page.id === "welcome" ? <WelcomeIcon /> : <PanelTop />}
                <Label>{page.name}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          {current ? (
            <>
              <Separator />
              <Dropdown.Item
                id="clear"
                textValue={t("pages.clear", { name: current.name })}
              >
                <X />
                <Label>{t("pages.clear", { name: current.name })}</Label>
              </Dropdown.Item>
            </>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
