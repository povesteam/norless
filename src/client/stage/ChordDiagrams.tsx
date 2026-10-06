import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { fingering } from "../../shared/music/guitar";

/** Diagrams of the shapes a song uses, drawn by svguitar, loaded only here. */
export function ChordDiagrams({ shapes }: { shapes: string[] }) {
  const { t } = useTranslation();
  const known = shapes.filter((s) => fingering(s));
  if (known.length === 0) return null;
  return (
    <section
      aria-label={t("instruments.diagrams")}
      className="flex flex-wrap gap-3"
    >
      {known.map((shape) => (
        <Diagram key={shape} shape={shape} />
      ))}
    </section>
  );
}

function Diagram({ shape }: { shape: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    const shapeFingering = fingering(shape);
    if (!element || !shapeFingering) return;
    let cancelled = false;
    void import("svguitar").then(({ SVGuitarChord }) => {
      if (cancelled) return;
      element.replaceChildren();
      const color = getComputedStyle(element).color;
      new SVGuitarChord(element)
        .configure({
          color,
          titleColor: color,
          fretLabelColor: color,
          title: shape,
        })
        .chord({
          fingers: shapeFingering.fingers,
          barres: shapeFingering.barre
            ? [
                {
                  fret: shapeFingering.barre.fret,
                  fromString: shapeFingering.barre.from,
                  toString: shapeFingering.barre.to,
                },
              ]
            : [],
          position: shapeFingering.position,
        })
        .draw();
    });
    return () => {
      cancelled = true;
    };
  }, [shape]);
  return <div ref={box} role="img" aria-label={shape} className="w-24" />;
}
