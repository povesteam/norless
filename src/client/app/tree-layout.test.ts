import { describe, expect, it } from "vitest";
import { layOut, NODE, PILL, ROW, treeNodes } from "./tree-layout";

describe("the feature graph's layout", () => {
  const graph = layOut();
  const byId = new Map(graph.placed.map((n) => [n.id, n]));

  it("places every feature once", () => {
    const ids = graph.placed.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(treeNodes.map((n) => n.id).sort());
  });

  it("fits a 1440-pixel laptop beside the page's margins", () => {
    expect(graph.width).toBeLessThanOrEqual(1224);
  });

  it("overlaps no two nodes", () => {
    const nodes = graph.placed;
    for (const [i, a] of nodes.entries())
      for (const b of nodes.slice(i + 1)) {
        const apart =
          a.x + PILL <= b.x || b.x + PILL <= a.x || Math.abs(a.y - b.y) >= NODE;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
  });

  it("puts each feature one column right of the one it needs", () => {
    for (const { from, to } of graph.links) {
      expect(to.x - from.x - PILL, to.id).toBeGreaterThan(0);
      expect(byId.get(to.needs ?? "appFrame"), to.id).toBe(from);
    }
  });

  it("crosses no two lines", () => {
    // Lines between the same two columns share their shape, so they cross only when
    // their ends swap order.
    for (const [i, a] of graph.links.entries())
      for (const b of graph.links.slice(i + 1)) {
        if (a.from.x !== b.from.x) continue;
        const starts = Math.sign(a.from.y - b.from.y);
        const ends = Math.sign(a.to.y - b.to.y);
        expect(
          starts * ends,
          `${a.to.id} and ${b.to.id}`,
        ).toBeGreaterThanOrEqual(0);
      }
  });

  it("runs no line behind a node", () => {
    for (const link of graph.links)
      for (const node of graph.placed) {
        if (node === link.from || node === link.to) continue;
        const between =
          node.x + PILL > link.from.x + PILL && node.x < link.to.x;
        const within =
          node.y + NODE / 2 > Math.min(link.from.y, link.to.y) &&
          node.y - NODE / 2 < Math.max(link.from.y, link.to.y);
        expect(between && within, `${link.to.id} behind ${node.id}`).toBe(
          false,
        );
      }
  });

  it("keeps a feature's children in step order, one row apart at least", () => {
    for (const parent of graph.placed) {
      const children = graph.links
        .filter((l) => l.from === parent)
        .map((l) => l.to);
      const ys = children.map((c) => c.y);
      expect(ys, parent.id).toEqual([...ys].sort((a, b) => a - b));
      ys.slice(1).forEach((y, i) =>
        expect(y - (ys[i] ?? 0)).toBeGreaterThanOrEqual(ROW),
      );
    }
  });
});
