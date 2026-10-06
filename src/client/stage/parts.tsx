import { useTranslation } from "react-i18next";
import { Button as AriaButton } from "react-aria-components";
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

/** A part: highlighted when live, marked when next, and for controllers a tap sends it live. */
export function PartBox({
  active,
  next,
  onPress,
  children,
  after,
  standalone = false,
}: {
  active: boolean;
  next: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  /** Shown under the box, outside the button: what has buttons of its own. */
  after?: React.ReactNode;
  /** Shown alone (the live part, the next one), not as an item of a list of parts. */
  standalone?: boolean;
}) {
  // Live in the live color, next only dashed, so the two never look alike; one
  // border width for all, so nothing moves on.
  const look = `block w-full rounded-xl border-2 p-3 text-start ${
    active
      ? "border-live bg-live/10"
      : next
        ? "border-dashed border-muted"
        : "border-separator"
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
