import { expect, test } from "vitest";
import { chooseLayout, deviceTypeFor, layoutsAt } from "./preferences.js";
import { shows, switchesOn } from "./features.js";

test("phones by their short side, tablets by touch, laptops by mouse", () => {
  expect(deviceTypeFor({ width: 390, height: 844, touch: true })).toBe("phone");
  expect(deviceTypeFor({ width: 844, height: 390, touch: true })).toBe("phone");
  expect(deviceTypeFor({ width: 1024, height: 768, touch: true })).toBe(
    "tablet",
  );
  expect(deviceTypeFor({ width: 1440, height: 900, touch: false })).toBe(
    "laptop",
  );
  // An iPad with a keyboard and trackpad looks like a laptop; the member corrects it.
  expect(deviceTypeFor({ width: 1180, height: 820, touch: false })).toBe(
    "laptop",
  );
});

test("the member's layout for the device type, or the first that fits", () => {
  const layouts = [
    { id: "controller", devices: ["laptop"] },
    { id: "running-order", devices: ["laptop", "tablet"] },
    { id: "phone", devices: ["phone"] },
  ] as const;
  expect(chooseLayout(layouts, "laptop", undefined)?.id).toBe("controller");
  expect(chooseLayout(layouts, "laptop", "running-order")?.id).toBe(
    "running-order",
  );
  expect(chooseLayout(layouts, "tablet", undefined)?.id).toBe("running-order");
  // A choice that doesn't fit the device, or no longer exists, is ignored.
  expect(chooseLayout(layouts, "phone", "controller")?.id).toBe("phone");
  expect(chooseLayout(layouts, "laptop", "gone")?.id).toBe("controller");
  // A view with nothing for the device still shows something.
  expect(
    chooseLayout([{ id: "only", devices: ["laptop"] }], "phone", undefined)?.id,
  ).toBe("only");
});

test("the layouts switched on are offered, Classic everywhere", () => {
  const layouts = [
    { id: "controller", devices: ["laptop"], feature: "layouts" },
    { id: "phone", devices: ["phone"], feature: "touchLayouts" },
    { id: "classic", devices: ["phone", "tablet", "laptop"] },
  ] as const;
  // Only Classic's set; the app frame and laptop layouts; and the touch layouts too.
  const sets = [
    {},
    { appFrame: true, layouts: true },
    { appFrame: true, layouts: true, touchLayouts: true },
  ] as const;
  const at = (set: number, device: "phone" | "laptop", choice?: string) =>
    chooseLayout(
      layoutsAt(layouts, (f) => shows(switchesOn(sets[set] ?? {}), f)),
      device,
      choice,
    )?.id;
  expect(at(0, "laptop")).toBe("classic");
  expect(at(0, "phone")).toBe("classic");
  expect(at(1, "laptop")).toBe("controller");
  expect(at(1, "phone")).toBe("classic");
  expect(at(2, "phone")).toBe("phone");
  // Classic stays a choice; a choice not switched on waits until it is.
  expect(at(1, "laptop", "classic")).toBe("classic");
  expect(at(1, "phone", "phone")).toBe("classic");
  expect(at(2, "phone", "phone")).toBe("phone");
});
