/** A community's look, so the app matches its other materials. Unset parts keep the app's. */
export type Theme = {
  /** The primary color, e.g. of buttons, as #rrggbb. */
  color?: string;
  /** The background in light mode, as #rrggbb. */
  tint?: string;
  /** A font family name, and its file (a data: URL of a woff2 or woff font), so Norless serves it. */
  font?: string;
  fontFile?: string;
  /** Where the page loads the font file from; the server sets it instead of sending the file. */
  fontFileUrl?: string;
  /** The logo, as a data: URL of an image. */
  logo?: string;
};

/** Unu-Unu's site: terracotta, warm neutrals and Switzer, whose file an owner uploads. */
export const UNU_UNU_THEME: Theme = {
  color: "#ac5334",
  tint: "#f9f5f2",
  font: "Switzer",
};

const WHITE = "#fdfdfd"; // HeroUI's text on the primary color
const TEXT = "#18181b"; // and its text in light mode

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];

/** WCAG's relative luminance of a #rrggbb color. */
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG's contrast ratio between two #rrggbb colors, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Two #rrggbb colors mixed, `share` of the first. */
const mix = (a: string, b: string, share: number) =>
  `#${rgb(a)
    .map((c, i) =>
      Math.round((c * share + (rgb(b)[i] ?? 0) * (1 - share)) * 255),
    )
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;

/**
 * Where text would fall below WCAG AA (4.5:1): white text on the primary color, text on
 * the tint, and primary-colored text (soft buttons, chips) on the tint.
 */
export function themeProblems(theme: Theme): ("color" | "tint" | "soft")[] {
  const problems: ("color" | "tint" | "soft")[] = [];
  const tint = theme.tint ?? "#f7f7f7";
  if (theme.color && contrast(WHITE, theme.color) < 4.5) problems.push("color");
  if (theme.tint && contrast(TEXT, theme.tint) < 4.5) problems.push("tint");
  if (theme.color && contrast(mix(theme.color, TEXT, 0.7), tint) < 4.5)
    problems.push("soft");
  return problems;
}

/** The theme as CSS: the primary color in light and dark mode, the tint and the font. */
export function themeCss(theme: Theme): string {
  const light = [
    theme.color && `--accent: ${theme.color};`,
    theme.tint && `--background: ${theme.tint};`,
  ].filter(Boolean);
  const dark = [theme.color && `--accent: ${theme.color};`].filter(Boolean);
  const font = theme.font?.replace(/["\\;{}<>]/g, "");
  const file = (theme.fontFileUrl ?? theme.fontFile)?.replace(/["\\)]/g, "");
  return [
    // Not on a dark page: the tint is a light background.
    light.length && `:root:not(.dark), .light { ${light.join(" ")} }`,
    dark.length && `.dark { ${dark.join(" ")} }`,
    // One file for every weight: a variable font, or the browser makes bold.
    font &&
      file &&
      `@font-face { font-family: "${font}"; src: url("${file}"); font-weight: 100 900; font-display: swap; }`,
    font &&
      `body { font-family: "${font}", ui-sans-serif, system-ui, sans-serif; }`,
  ]
    .filter(Boolean)
    .join("\n");
}
