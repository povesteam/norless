/*
 * The Big screen layout's rules, by the window's width in CSS
 * pixels, which a 4K monitor at 150% scaling gives as 2560: QHD's arrangement.
 */

/** From this width the layout is offered, and chosen when nothing was picked. */
export const BIG_SCREEN = 1900;

/** The arrangement: 1 from Full HD, 2 from QHD (people get a column), 3 from 4K at 100%. */
export const tierOf = (width: number) =>
  width >= 3800 ? 3 : width >= 2500 ? 2 : 1;

/** The playlist's layouts a window this wide offers. */
export const layoutsFor = <L extends { id: string }>(
  layouts: readonly L[],
  width: number,
) => layouts.filter((l) => l.id !== "big-screen" || width >= BIG_SCREEN);
