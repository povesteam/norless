import { Input, type InputProps } from "@heroui/react";
import { useContext, useEffect, useEffectEvent, useState } from "react";
import { ComboBoxStateContext, type Key } from "react-aria-components";

// React Aria's combobox leaves both of these to the app.

/** A combobox's input that opens the options on click as well as on focus. */
export function ComboBoxInput(props: InputProps) {
  const state = useContext(ComboBoxStateContext);
  return (
    <Input
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        state?.open(null, "manual");
      }}
    />
  );
}

/**
 * Keeps a combobox's first option selected when `options` change and when nothing is
 * selected (React Aria clears it on every keystroke), so Enter always picks one. While
 * they aren't `ready`, nothing is selected, so Enter can't pick an old result. Goes
 * after the popover, whose list clears the selection when its options change.
 */
export function FirstOptionSelected({
  options,
  ready = true,
  first,
}: {
  options: unknown;
  /** False while the options shown are still those of the previous text. */
  ready?: boolean;
  /** The option to select instead of the first one. */
  first?: Key;
}) {
  const state = useContext(ComboBoxStateContext);
  const isOpen = state?.isOpen ?? false;
  // The option to select, once the list has it: its collection follows a render later.
  const key = first ?? state?.collection.getFirstKey() ?? null;
  const firstKey = key !== null && state?.collection.getItem(key) ? key : null;
  const noneSelected = state?.selectionManager.focusedKey == null;
  const selectFirst = useEffectEvent(() => {
    if (firstKey !== null) state?.selectionManager.setFocusedKey(firstKey);
  });
  useEffect(() => {
    if (isOpen && ready) selectFirst();
  }, [isOpen, firstKey, options, noneSelected, ready]);
  return null;
}

const MOVES = /^(Arrow(Up|Down)|Page(Up|Down)|Home|End)$/;
const MODIFIERS = /^(Shift|Control|Alt|Meta)$/;

/**
 * The option Enter picks in a filled frame, and the focus ring only once the keys move
 * through the options, not while typing, which a phone's keyboard counts as keyboard use
 * too. Spread `input` on the `ComboBoxInput`, `list` on the
 * `ListBox`.
 */
export function useOptionsFrame() {
  const [moved, setMoved] = useState(false);
  return {
    input: {
      onKeyDown: (event: React.KeyboardEvent) => {
        if (!MODIFIERS.test(event.key)) setMoved(MOVES.test(event.key));
      },
    },
    list: {
      className: `[&_.list-box-item[data-focused=true]]:bg-accent-soft ${
        moved ? "" : "[&_.list-box-item]:[box-shadow:none]"
      }`,
    },
  };
}
