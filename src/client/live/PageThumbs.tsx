import { Button as AriaButton } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import { SlidePage } from "../screens/SlidePage";

/**
 * A slides entry's pages as thumbnails, where a song shows its parts:
 * the live one framed, and for the team a click or tap sends that page live. While the
 * file isn't ready, what it's doing.
 */
export function PageThumbs({
  entry,
  live,
  onGo,
  strip = false,
}: {
  entry: Entry;
  /** The page on the screens, when this entry is live. */
  live: number | null;
  onGo?: (slide: number) => void;
  /** One row that scrolls, as Big now and next's parts. */
  strip?: boolean;
}) {
  const { t } = useTranslation();
  const files = entry.slides?.files ?? [];
  const main = files.find((f) => f.language === null);
  if (main?.state !== "ready" || !main.total)
    return (
      <p className="rounded-xl border-2 border-separator p-3 text-sm text-muted">
        {main?.state === "failed"
          ? (main.error ?? t("slides.failed"))
          : t("slides.preparing", {
              pages: main?.pages ?? 0,
              total: main?.total ?? "…",
            })}
      </p>
    );
  const total = main.total;
  return (
    <div
      role="list"
      aria-label={t("live.slides")}
      className={
        strip
          ? "flex gap-2 overflow-x-auto pb-1 *:w-40 *:shrink-0"
          : "grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2"
      }
    >
      {Array.from({ length: total }, (_, i) => (
        <div role="listitem" key={i}>
          <AriaButton
            isDisabled={!onGo}
            onPress={() => onGo?.(i)}
            aria-current={live === i || undefined}
            aria-label={t("slides.page", { page: i + 1, total })}
            // A frame in the live color, as wide as the plain one, so nothing moves.
            className={`flex w-full flex-col items-start gap-1 rounded-xl border-2 p-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[focus-visible]:ring-inset ${
              live === i ? "border-live" : "border-separator"
            } ${onGo ? "cursor-pointer data-[hovered]:bg-default" : ""}`}
          >
            <SlidePage
              files={files}
              languages={[]}
              slide={i}
              sizes="160px"
              className="aspect-video w-full rounded-lg bg-black"
            />
            <span className="px-1 text-xs text-muted tabular-nums">
              {i + 1}
            </span>
          </AriaButton>
        </div>
      ))}
    </div>
  );
}
