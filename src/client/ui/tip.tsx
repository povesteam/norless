import { Tooltip } from "@heroui/react";
import { cloneElement, useRef, useState } from "react";

const LONG_PRESS = 500;
const SHOWN = 2000;

/**
 * `children`, one button, with `label` in a tooltip: on hover and keyboard focus, as
 * HeroUI's, and on a touch screen after half a second's press, which then doesn't press
 * the button. Other props (e.g. a button group's) go to the button.
 */
export function Tip({
  label,
  children,
  ...rest
}: {
  label: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined);
  const release = () => clearTimeout(press.current);
  return (
    <Tooltip delay={300} isOpen={open} onOpenChange={setOpen}>
      <span
        className="contents select-none [-webkit-touch-callout:none]"
        onPointerDownCapture={(e) => {
          if (e.pointerType !== "touch") return;
          const target = e.target;
          release();
          press.current = setTimeout(() => {
            // As React Aria's long-press: the button's press is cancelled.
            target.dispatchEvent(
              new PointerEvent("pointercancel", { bubbles: true }),
            );
            setOpen(true);
            clearTimeout(hide.current);
            hide.current = setTimeout(() => setOpen(false), SHOWN);
          }, LONG_PRESS);
        }}
        onPointerUpCapture={release}
        onPointerCancelCapture={release}
        // A phone's long-press menu would cover the tooltip.
        onContextMenu={(e) => e.preventDefault()}
      >
        {cloneElement(children, rest)}
      </span>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
