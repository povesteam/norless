import { Hourglass, Lock, Move, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDeviceType } from "../data/device";
import { type Branch, branches } from "./tree-layout";

/** The mark on a node's corner, so its state isn't told by color alone. */
export const marks: Partial<Record<string, typeof Lock>> = {
  planned: Hourglass,
  locked: Lock,
  new: Sparkles,
};

/**
 * Above the Features graph: its branches' colors, what the corner marks mean, and on a
 * phone that it pans.
 */
export function FeatureLegend({ colors }: { colors: Record<Branch, string> }) {
  const { t } = useTranslation();
  const phone = useDeviceType().deviceType === "phone";
  return (
    <>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <ul
          aria-label={t("featureTree.branchesTitle")}
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold"
        >
          {branches.map((branch) => (
            <li key={branch} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: colors[branch] }}
              />
              {t(`featureTree.branches.${branch}`)}
            </li>
          ))}
        </ul>
        {/* What the corner marks mean. */}
        <ul
          aria-label={t("featureTree.marksTitle")}
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"
        >
          {(["locked", "planned", "new"] as const).map((state) => {
            const Mark = marks[state];
            return (
              Mark && (
                <li key={state} className="flex items-center gap-1.5">
                  <Mark aria-hidden className="size-3.5" />
                  {t(`featureTree.marks.${state}`)}
                </li>
              )
            );
          })}
        </ul>
      </div>
      {phone && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Move aria-hidden className="size-4" />
          {t("featureTree.pan")}
        </p>
      )}
    </>
  );
}
