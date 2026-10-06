import { Button, Dropdown, Label } from "@heroui/react";

/** Something the team can do to a playlist entry, shown in its menu. */
export type EntryAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
};

/** An entry's actions in a menu at a point: the pointer's, or its "⋯" button's. */
export function ActionsMenu({
  at,
  label,
  actions,
  onClose,
}: {
  at: { x: number; y: number };
  label: string;
  actions: EntryAction[];
  onClose: () => void;
}) {
  return (
    <Dropdown isOpen onOpenChange={(open) => !open && onClose()}>
      {/* Where the menu opens from: the pointer. */}
      <Button
        aria-label={label}
        excludeFromTabOrder
        className="fixed size-0 min-h-0 min-w-0 overflow-hidden p-0 opacity-0"
        style={{ left: at.x, top: at.y }}
      />
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label={label}
          disabledKeys={actions.filter((a) => a.disabled).map((a) => a.id)}
          onAction={(key) => actions.find((a) => a.id === key)?.run()}
        >
          {actions.map((action) => (
            <Dropdown.Item
              key={action.id}
              id={action.id}
              textValue={action.label}
              variant={action.danger ? "danger" : undefined}
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
