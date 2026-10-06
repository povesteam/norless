/** Slides from files: what both sides know of a slides entry's files. */

export type SlideKind = "pdf" | "pictures";
export type SlideFile = {
  id: string;
  /** Null for the main file, shown where a language has none of its own. */
  language: string | null;
  name: string;
  kind: SlideKind;
  /** Pages drawn so far, of `total` (null until it's known). */
  pages: number;
  total: number | null;
  state: "preparing" | "ready" | "failed";
  error: string | null;
};
export type Slides = { files: SlideFile[]; seconds: number | null };

/** The widths pages are drawn at: screens, phones and the stage, thumbnails. */
export const pageWidths = [3840, 1280, 320] as const;

/** The file a screen of these languages shows: its first language's, else the main one. */
export const fileFor = (files: SlideFile[], languages: string[]) =>
  languages
    .map((l) => files.find((f) => f.language === l && f.state === "ready"))
    .find(Boolean) ?? files.find((f) => f.language === null);

/** A ready file's page for a live slide: a shorter file shows its last page. */
export const pageOf = (file: SlideFile | undefined, slide: number) =>
  file?.state === "ready" && file.total
    ? Math.min(slide, file.total - 1) + 1
    : null;

/** A page's picture at a width. */
export const pageUrl = (fileId: string, page: number, width: number) =>
  `/api/slide-pages/${fileId}/${page}/${width}`;
