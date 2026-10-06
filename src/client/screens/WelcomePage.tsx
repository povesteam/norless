import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Welcome } from "../../server/community/welcome";
import { useJson } from "../data/fetch";
import { Markdown } from "../ui/markdown";
import { clock } from "../ui/time";
import { untilStart } from "./welcome";

/** Each announcement shows this long before the next. */
const ANNOUNCEMENT_MS = 8000;

/**
 * The built-in welcome page on the projectors: the community's
 * logo and name, a countdown to the next service or rehearsal that hides at zero, and
 * the owners' announcements one after another. Sizes in the screen's own units.
 */
export function WelcomePage({
  slug,
  welcome,
}: {
  slug: string;
  welcome: { startsAt: string | null; event: string | null };
}) {
  const { t, i18n } = useTranslation();
  const content = useJson<Welcome>(`/api/communities/${slug}/welcome`).data;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = untilStart(welcome.startsAt, now);
  const announcements = content?.announcements ?? [];
  const shown =
    announcements[
      Math.floor(now / ANNOUNCEMENT_MS) % (announcements.length || 1)
    ];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqmin] p-[6cqmin] text-center">
      {content?.logo && (
        <img
          src={content.logo}
          alt=""
          className="max-h-[22cqh] max-w-[40cqw] object-contain"
        />
      )}
      <h1 className="text-[8cqmin] leading-tight font-semibold">
        {content?.name}
      </h1>
      {/* Its line stays while it's empty, so nothing moves at zero. */}
      <p className="min-h-[1.3em] text-[5cqmin] tabular-nums opacity-80">
        {left &&
          ("countdown" in left
            ? welcome.event
              ? t("welcome.eventIn", {
                  event: welcome.event,
                  time: left.countdown,
                })
              : t("welcome.in", { time: left.countdown })
            : t("welcome.at", {
                event: welcome.event ?? "",
                day: left.later.toLocaleDateString(i18n.language, {
                  weekday: "long",
                }),
                time: clock(left.later, i18n.language),
              }))}
      </p>
      {shown && (
        <div
          key={shown}
          className="flex min-h-[20cqh] max-w-[80cqw] flex-col gap-[1.5cqmin] text-[4.5cqmin] leading-snug"
        >
          <Markdown text={shown} />
        </div>
      )}
    </div>
  );
}
