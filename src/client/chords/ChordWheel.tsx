import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Heard,
  keyStep,
  RINGS,
  wheelDot,
  wheelLabels,
  wheelPlace,
  wheelPoint,
} from "../../shared/music/chord-detect";
import type { Key } from "../../shared/music/chords";

/**
 * The circle of fifths (the maintainer's "ferris wheel"): major chords
 * outside, their relative minors inside, the song's key at the top; the wheel turns the
 * short way when the key changes. A dot drifts toward the chord played, on it when sure
 * and toward the middle when several chords fit.
 */
export function ChordWheel({
  songKey,
  chord,
  scores,
  className = "",
}: {
  songKey: Key | null;
  /** The chord played, when known. */
  chord: string | null;
  /** How well each chord fits what's heard, from audio; MIDI knows the chord. */
  scores?: Heard["scores"];
  className?: string;
}) {
  const { t } = useTranslation();
  // The turn so far, so a new key turns the short way round.
  const step = keyStep(songKey);
  const [turn, setTurn] = useState({ step, degrees: step * 30 });
  const degrees = turn.degrees + (((step - turn.step + 18) % 12) - 6) * 30;
  if (turn.step !== step) setTurn({ step, degrees });

  // In their places from C, spelled for the key: the group turns them.
  const labels = wheelLabels(songKey, 0);
  const place = chord ? wheelPlace(chord, songKey) : null;
  const dot = scores?.length
    ? wheelDot(scores, songKey)
    : place
      ? wheelPoint(place.step, place.minor)
      : null;
  // The chord on the wheel, in its absolute place (C at 0).
  const on = place && { at: (place.step + step) % 12, minor: place.minor };
  const glide = "transform 600ms ease-in-out";
  return (
    <svg
      viewBox="-1.1 -1.1 2.2 2.2"
      role="img"
      aria-label={chord ? t("detect.wheelOn", { chord }) : t("detect.wheel")}
      className={`aspect-square ${className}`}
    >
      <circle
        r={1}
        className="fill-surface stroke-separator"
        strokeWidth={0.01}
      />
      <circle
        r={(RINGS.major + RINGS.minor) / 2}
        className="fill-none stroke-separator"
        strokeWidth={0.008}
      />
      {/* Behind the labels, so the chord it's on stays readable. */}
      {dot && (
        <g
          style={{
            transform: `translate(${dot.x}px, ${dot.y}px)`,
            transition: "transform 300ms ease-out",
          }}
        >
          <circle r={0.13} className="fill-accent opacity-30" />
        </g>
      )}
      <g style={{ transform: `rotate(${-degrees}deg)`, transition: glide }}>
        {labels.map((label, i) =>
          (["major", "minor"] as const).map((ring) => {
            const point = wheelPoint(i, ring === "minor");
            const lit = on?.at === i && on.minor === (ring === "minor");
            return (
              <g
                key={`${i}${ring}`}
                style={{
                  transform: `translate(${point.x}px, ${point.y}px) rotate(${degrees}deg)`,
                  transition: glide,
                }}
              >
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={ring === "major" ? 0.15 : 0.11}
                  className={lit ? "fill-accent font-bold" : "fill-foreground"}
                >
                  {label[ring]}
                </text>
              </g>
            );
          }),
        )}
      </g>
    </svg>
  );
}
