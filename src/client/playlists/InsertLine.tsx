import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tip } from "../ui/tip";

/**
 * Where the pointer is between two rows, a line with a + that opens what can go there
 *. It sits on the row below's top edge, over both rows.
 */
export function InsertLine({
  onPress,
}: {
  /** Opens the menu at a point. */
  onPress: (x: number, y: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-2 -top-3 z-10 flex h-6 items-center gap-1">
      <span className="h-0.5 flex-1 rounded-full bg-accent" />
      <Tip label={t("playlist.insertHere")}>
        <Button
          isIconOnly
          size="sm"
          aria-label={t("playlist.insertHere")}
          className="pointer-events-auto size-6 min-h-6 min-w-6 rounded-full"
          onPress={(event) => {
            const box = (event.target as Element).getBoundingClientRect();
            onPress(box.left, box.bottom);
          }}
        >
          <Plus className="size-4" />
        </Button>
      </Tip>
      <span className="h-0.5 flex-1 rounded-full bg-accent" />
    </div>
  );
}
