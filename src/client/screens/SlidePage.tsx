import type { SlideFile } from "../../shared/slides";
import { fileFor, pageOf, pageUrl } from "../../shared/slides";

/**
 * A slides entry's page as a picture, in the languages' file, at the
 * size the browser picks from `sizes`: a 4K projector loads the 3840 one, a phone the
 * 1280 one, a thumbnail the 320 one. Letterboxed in its box.
 */
export function SlidePage({
  files,
  languages,
  slide,
  sizes = "100vw",
  alt = "",
  className = "",
}: {
  files: SlideFile[];
  languages: string[];
  slide: number;
  /** How wide it shows, for the browser's choice of picture. */
  sizes?: string;
  alt?: string;
  className?: string;
}) {
  const file = fileFor(files, languages);
  const page = pageOf(file, slide);
  if (!file || page === null) return null;
  const url = (width: number) => pageUrl(file.id, page, width);
  return (
    <img
      src={url(1280)}
      srcSet={`${url(320)} 320w, ${url(1280)} 1280w, ${url(3840)} 3840w`}
      sizes={sizes}
      alt={alt}
      draggable={false}
      className={`object-contain ${className}`}
    />
  );
}
