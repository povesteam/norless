import { Button, Dropdown, Label } from "@heroui/react";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

export type RowAction = {
  id: string;
  icon: ReactNode;
  label: string;
  /** Asked first, for what can't be undone. */
  confirm?: string;
  onAction: () => void;
};

/**
 * A row's ⋯ menu, for actions that shouldn't sit on every row, such as removing it
 *: a slip on a list doesn't hit them.
 */
export function RowMenu({
  label,
  actions,
  isPending = false,
}: {
  /** "Actions: Ana Popescu". */
  label: string;
  actions: RowAction[];
  isPending?: boolean;
}) {
  return (
    <Dropdown>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={label}
        isPending={isPending}
      >
        <Ellipsis />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={label}
          onAction={(key) => {
            const action = actions.find((a) => a.id === key);
            if (action && (!action.confirm || window.confirm(action.confirm)))
              action.onAction();
          }}
        >
          {actions.map((action) => (
            <Dropdown.Item
              key={action.id}
              id={action.id}
              textValue={action.label}
            >
              {action.icon}
              <Label>{action.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
