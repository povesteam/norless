import { buttonVariants } from "@heroui/react";
import { ListMusic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button as AriaButton, Focusable } from "react-aria-components";
import { Link } from "wouter";
import { Tip } from "../ui/tip";
import type { LiveView } from "../../server/live/live-view";
import type { Slide } from "../../shared/song-text";
import { SlidePage } from "../screens/SlidePage";

/** "Verse 2", "Refrain", or the part's name, for the slide `label` names. */
export function usePartName() {
  const { t } = useTranslation();
  return (slide: Pick<Slide, "type" | "name"> | undefined, label: string) => {
    if (!slide) return label;
    if (slide.type === "verse" && /^\d+$/.test(label))
      return t("live.verse", { n: label });
    if (slide.type === "other" || (slide.name !== null && slide.name !== label))
      return label;
    return t(`live.types.${slide.type}`);
  };
}

/** Back to the community's playlist, as big as the toolbar's other buttons. */
export function ToPlaylist({ slug }: { slug: string }) {
  const { t } = useTranslation();
  return (
    <Tip label={t("stage.toPlaylist")}>
      {/* Focusable gives the tooltip the link's place, as a button would. */}
      <Focusable>
        <Link
          href={`~/${slug}`}
          aria-label={t("stage.toPlaylist")}
          className={`${buttonVariants({ isIconOnly: true, size: "sm", variant: "secondary" })} shrink-0`}
        >
          <ListMusic />
        </Link>
      </Focusable>
    </Tip>
  );
}

/**
 * A part's mark, faint in its box's top corner as the song map writes it (1, 2, R),
 * instead of its name, which is only read out. The box is `relative` and keeps the room.
 */
export function PartMark({ mark, name }: { mark: string; name: string }) {
  return (
    <>
      <span className="sr-only">{name}</span>
      {/* Drawn from an attribute: a shadow of the name, not text to read. */}
      <span
        aria-hidden
        data-mark={mark}
        className="absolute end-3 top-2 text-3xl leading-none font-bold text-muted opacity-40 after:content-[attr(data-mark)]"
      />
    </>
  );
}

/** A part: highlighted when live, and for controllers a tap sends it live. */
export function PartBox({
  active,
  onPress,
  children,
  after,
  standalone = false,
}: {
  active: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  /** Shown under the box, outside the button: what has buttons of its own. */
  after?: React.ReactNode;
  /** Shown alone (the live part, the next one), not as an item of a list of parts. */
  standalone?: boolean;
}) {
  // Live in the live color, the others alike; one border width for all, so nothing
  // moves on.
  // Room on the right for its mark (PartMark).
  const look = `relative block w-full rounded-xl border-2 p-3 pe-10 text-start ${
    active ? "border-live bg-live/10" : "border-separator"
  }`;
  return (
    <div
      role={standalone ? undefined : "listitem"}
      aria-current={active || undefined}
    >
      {onPress ? (
        // A touch that starts a scroll doesn't press it.
        <AriaButton
          className={`${look} outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus`}
          onPress={onPress}
        >
          {children}
        </AriaButton>
      ) : (
        <div className={look}>{children}</div>
      )}
      {after}
    </div>
  );
}

/**
 * The message to the stage in the musicians and vocalists views: a line above the song,
 * which moves down under it rather than being covered.
 */
export function StageNotice({
  message,
}: {
  message: string | null | undefined;
}) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="mx-3 mt-3 rounded-xl bg-warning px-4 py-2 text-center text-lg font-bold text-black"
    >
      {message}
    </p>
  );
}

/** A slides entry on the stage views: its title, "Slides 3/12" and the page small. */
export function StageSlides({
  view,
  languages,
}: {
  view: LiveView;
  languages: string[];
}) {
  const { t } = useTranslation();
  if (view.entry?.kind !== "slides") return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold">{view.entry.text}</h2>
      <p className="text-lg text-muted">
        {t("slides.page", { page: view.slide + 1, total: view.slides })}
      </p>
      <SlidePage
        files={view.entry.slides?.files ?? []}
        languages={languages}
        slide={view.slide}
        sizes="(min-width: 768px) 576px, 100vw"
        className="max-h-[40vh] w-full max-w-xl self-start rounded-lg"
      />
    </div>
  );
}
