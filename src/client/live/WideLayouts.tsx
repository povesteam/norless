import type { LiveView } from "../../server/live/live-view";
import { BigNowNext, Previews } from "./ControllerViews";
import { LiveBar } from "./LiveBar";
import type { ProjectHere } from "./LocalProjection";

/** The laptop layouts that fill the window like Classic, by their id. */
export const wideLayouts = ["controller", "running-order", "big"] as const;
export type WideLayoutId = (typeof wideLayouts)[number];

// From 1024 pixels the columns sit side by side, each scrolling on its own.
const grid = "grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]";
const column = "flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto";

/**
 * Controller, Running order and Big now and next (live-control spec, Laptop layouts) as
 * app screens: on a window 1024 pixels wide or more the window holds them, each column
 * scrolls on its own and the controls stay where they are; narrower, they stack and the
 * page scrolls.
 */
export function WideLayout({
  layout,
  list,
  parts,
  order,
  view,
  project,
}: {
  layout: WideLayoutId;
  /** The playlist's entries. */
  list: React.ReactNode;
  /** Controller's middle: the selected entry's parts, or the song editor. */
  parts: React.ReactNode;
  /** Running order's list, or the song editor. */
  order: React.ReactNode;
  view: LiveView | undefined;
  project: ProjectHere;
}) {
  if (layout === "controller")
    return (
      <div
        className={`${grid} lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]`}
      >
        <div className={column}>{list}</div>
        {/* Always a cell, so the previews keep their column while a song loads. */}
        <div className={column}>{parts}</div>
        <div className={column}>
          <Previews />
          <LiveBar view={view} side project={project} />
        </div>
      </div>
    );
  if (layout === "running-order")
    return (
      <div className={`${grid} lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`}>
        <div className={column}>{order}</div>
        <div className={column}>
          <Previews />
          <LiveBar view={view} side project={project} />
        </div>
      </div>
    );
  return (
    <div className={`${grid} lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`}>
      <div className={column}>
        <BigNowNext view={view} />
      </div>
      {/* The controls stay; the playlist scrolls under them. */}
      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <LiveBar view={view} side big project={project} />
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{list}</div>
      </div>
    </div>
  );
}
