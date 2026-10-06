import { hierarchy, tree } from "d3-hierarchy";
import {
  type Feature,
  featureNames,
  needsOf,
  planned,
  type Planned,
} from "../../shared/features";

/**
 * Where the Features page puts each feature: each feature that
 * others need roots a tree drawn left to right by d3-hierarchy's tidy tree, so no two
 * lines cross; the features on their own sit in a grid beside the trees. Computed, not
 * measured, so the lines know where the nodes are.
 */

/** The branches, left to right. */
export const branches = [
  "screens",
  "live",
  "stage",
  "chords",
  "songs",
  "stats",
  "app",
  "team",
] as const;
export type Branch = (typeof branches)[number];

/** Each feature's branch; a new feature takes one. */
export const branchOf = {
  feedback: "app",
  deviceLogin: "live",
  export: "songs",
  appFrame: "app",
  layouts: "live",
  textSlides: "live",
  times: "live",
  problems: "live",
  commands: "live",
  presence: "live",
  mediaKeys: "live",
  stageViews: "stage",
  liveNotice: "live",
  screenMenu: "screens",
  touchLayouts: "live",
  chords: "chords",
  history: "chords",
  notation: "chords",
  instruments: "stage",
  recordings: "stage",
  tempoCheck: "stage",
  screens: "screens",
  projectHere: "screens",
  followAlong: "screens",
  shortLinks: "screens",
  sideBySide: "songs",
  install: "app",
  theme: "app",
  shortcuts: "live",
  songFeedback: "songs",
  referenceLink: "chords",
  credits: "songs",
  statistics: "stats",
  rotation: "stats",
  yearRecap: "stats",
  servicesGrid: "stats",
  searchMisses: "stats",
  chapters: "stats",
  chordColors: "stage",
  host: "live",
  changes: "songs",
  practiceRooms: "live",
  midiChords: "chords",
  audioChords: "chords",
  chordWheel: "chords",
  liveChord: "stage",
  serviceRoles: "team",
  mySchedule: "team",
  signUps: "team",
  blockouts: "team",
  pushNotifications: "team",
  chordHelper: "chords",
  fileSlides: "screens",
  bigScreen: "live",
  welcome: "screens",
  melodia: "songs",
  webhooks: "app",
  offline: "app",
  ledBy: "team",
  churchCalendar: "team",
  playlistNews: "team",
  replays: "songs",
  insertBetween: "live",
} as const satisfies Record<Feature | Planned, Branch>;

/** A node: its icon and name in a pill; a row's height; a parent's column to its children's. */
export const PILL = 150;
export const NODE = 32;
export const ROW = 36;
export const COL = 180;
/** Between the trees and the grid, and between two cells of the grid. */
const GAP = 24;
const CELL_GAP = 12;

export type TreeNode = {
  id: Feature | Planned;
  needs?: Feature | Planned;
  planned: boolean;
};

export const treeNodes: TreeNode[] = [
  ...featureNames.map((id) => ({ id, needs: needsOf(id), planned: false })),
  ...(Object.entries(planned) as [Planned, { needs?: Feature }][]).map(
    ([id, p]) => ({ id, needs: p.needs, planned: true }),
  ),
];

/** A node, by its pill's left edge and its middle. */
export type Placed = TreeNode & { x: number; y: number };

/** A line from a feature to one that needs it. */
export type Link = { from: Placed; to: Placed };

/**
 * Lays the graph out: the tallest tree on the left, the other trees on the right one under
 * another, then the features on their own in as many columns as the right side holds.
 * Children come in the order of `nodes`, as `features` declares them.
 */
export function layOut(nodes: TreeNode[] = treeNodes) {
  const ids = new Set(nodes.map((n) => n.id));
  const childrenOf = (node: TreeNode) =>
    nodes.filter((n) => n.needs === node.id);
  const roots = nodes.filter((n) => !n.needs || !ids.has(n.needs));
  const trees = roots
    .filter((root) => childrenOf(root).length)
    .map((root) => {
      const laid = tree<TreeNode>()
        .nodeSize([ROW, COL])
        .separation(() => 1)(hierarchy(root, childrenOf));
      const all = laid.descendants();
      const top = Math.min(...all.map((n) => n.x));
      return {
        nodes: all.map((n) => ({ node: n.data, x: n.y, y: n.x - top })),
        width: Math.max(...all.map((n) => n.y)) + PILL,
        height: Math.max(...all.map((n) => n.x)) - top + ROW,
      };
    })
    .sort((a, b) => b.height - a.height);
  const singles = roots.filter((root) => !childrenOf(root).length);

  const placed: Placed[] = [];
  const put = (node: TreeNode, x: number, y: number) =>
    placed.push({ ...node, x, y: y + ROW / 2 });
  const [first, ...rest] = trees;
  const right = first ? first.width + GAP : 0;
  first?.nodes.forEach((n) => put(n.node, n.x, n.y));
  let y = 0;
  for (const t of rest) {
    t.nodes.forEach((n) => put(n.node, right + n.x, y + n.y));
    y += t.height + GAP;
  }
  const side = Math.max(PILL, ...rest.map((t) => t.width));
  const columns = Math.max(
    1,
    Math.floor((side + CELL_GAP) / (PILL + CELL_GAP)),
  );
  // Their heading in the gap above them, or a row of its own at the top
  //.
  const singlesAt = singles.length
    ? { x: right, y: Math.max(0, y - GAP) }
    : null;
  if (singles.length && y === 0) y += ROW;
  singles.forEach((node, i) =>
    put(
      node,
      right + (i % columns) * (PILL + CELL_GAP),
      y + Math.floor(i / columns) * ROW,
    ),
  );
  y += Math.ceil(singles.length / columns) * ROW;

  const at = new Map(placed.map((n) => [n.id, n]));
  const links: Link[] = placed.flatMap((to) => {
    const from = to.needs && at.get(to.needs);
    return from ? [{ from, to }] : [];
  });
  return {
    width: right + side,
    height: Math.max(first?.height ?? 0, y),
    placed,
    links,
    /** Where the features on their own start: their heading's place. */
    singlesAt,
  };
}

/**
 * A line from the end of the parent's pill to the start of the child's: an S-curve with
 * the same horizontal shape as every other line between those two columns, so two lines
 * can't cross.
 */
export function linkPath({ from, to }: Link) {
  const x0 = from.x + PILL;
  const x1 = to.x;
  const mid = (x0 + x1) / 2;
  return `M ${x0} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${x1} ${to.y}`;
}
