import { useEffect } from "react";
import type { LiveView } from "../../server/live/live-view";
import { formatReference } from "../../shared/bible";
import type { ScreenSettings } from "../../shared/screens";
import { formatLines, overlayRows } from "../../shared/song-render";
import { parseSong } from "../../shared/song-text";
import { Fit } from "./Projector";
import { rememberBackground } from "./background";
import { useLiveView } from "../data/room";
import { Segments } from "../songs/SongText";
import { SlidePage } from "./SlidePage";

const backgrounds = {
  transparent: "transparent",
  green: "#00b140", // chroma key green
  black: "#000",
};

/**
 * A broadcast overlay: the live slide as a lower third, inside title-safe margins, with
 * an outline that reads over any video. Its background is transparent (OBS), chroma
 * green or black (a video mixer); blank shows only the background.
 */
export function Overlay({
  slug,
  languages,
  settings,
  preview = false,
}: {
  slug: string;
  languages: string[];
  settings: ScreenSettings;
  /** Drawn in a tile of the Big screen: the page's own background stays. */
  preview?: boolean;
}) {
  const view = useLiveView(slug);
  const background = backgrounds[settings.overlayBackground ?? "transparent"];
  // The page itself must be transparent for a browser source.
  useEffect(() => {
    if (preview) return;
    const { style } = document.body;
    const before = style.background;
    style.background = background;
    document.documentElement.style.background = background;
    rememberBackground(background);
    return () => {
      style.background = before;
      document.documentElement.style.background = "";
    };
  }, [background, preview]);

  const rows = view && !view.blank ? overlayText(view, languages) : [];
  // A slides page full frame, the overlay's background around it.
  const slides =
    view && !view.blank && !view.verse && view.entry?.kind === "slides"
      ? (view.entry.slides?.files ?? [])
      : null;
  return (
    <div
      className="fixed inset-0 cursor-none select-none"
      style={{ background, fontFamily: settings.font }}
      lang={languages[0]}
    >
      {slides && view && (
        <SlidePage
          files={slides}
          languages={languages}
          slide={view.slide}
          className="absolute inset-0 h-full w-full"
        />
      )}
      {rows.length > 0 && (
        <div
          className="absolute inset-x-[10%] bottom-[8%] flex h-[22%] flex-col text-center font-semibold text-white"
          style={{
            color: settings.textColor ?? "#fff",
            // Readable over any video.
            textShadow:
              "0 0 0.12em #000, 0 0 0.12em #000, 0.05em 0.05em 0.1em #000",
            WebkitTextStroke: "0.03em #000",
            paintOrder: "stroke fill",
          }}
        >
          <Fit>
            {formatLines(rows).map((segments, i) => (
              <div key={i} className="leading-tight whitespace-pre">
                <Segments segments={segments} />
              </div>
            ))}
          </Fit>
        </div>
      )}
    </div>
  );
}

/** The live slide's lines for the overlay, in the screen's language. */
function overlayText(view: LiveView, languages: string[]): string[] {
  const { entry, song } = view;
  const [language = "ro"] = languages;
  if (entry?.bible) return [formatReference(entry.bible, language)];
  if (entry?.kind === "text")
    return overlayRows(
      (entry.text ?? "")
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").trim())
        .filter(Boolean),
    );
  if (!song) return [];
  const version =
    languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  const slides = version ? parseSong(version.text).slides : [];
  const slide = slides[Math.min(view.slide, slides.length - 1)];
  if (!slide) return [];
  return overlayRows(
    slide.lines
      .filter((l) => !l.chordsOnly && l.text.trim())
      .map((l) => l.text),
  );
}
