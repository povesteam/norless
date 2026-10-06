import { X } from "lucide-react";
import { Button, Kbd, Modal } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Every keyboard shortcut, shown on "?" outside a text field. */
export function Shortcuts() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  if (!open) return null;

  const save = mac ? "⌘ S" : "Ctrl S";
  const rows: [string[], string][] = [
    [[t("shortcuts.letter")], t("shortcuts.search")],
    [["Enter"], t("shortcuts.add")],
    [["↑", "↓"], t("shortcuts.select")],
    [["Alt ↑", "Alt ↓"], t("shortcuts.move")],
    [["Enter"], t("shortcuts.live")],
    [["→", "PageDown"], t("shortcuts.next")],
    [["←", "PageUp"], t("shortcuts.previous")],
    [["Esc"], t("shortcuts.blank")],
    [["Delete", "Backspace"], t("shortcuts.remove")],
    [[save], t("shortcuts.save")],
    [["?"], t("shortcuts.this")],
  ];
  return (
    <Modal.Backdrop isOpen onOpenChange={setOpen}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("shortcuts.title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              {rows.map(([keys, what], i) => (
                <div key={i} className="contents">
                  <dt className="flex flex-wrap gap-1">
                    {keys.map((key, j) => (
                      <Kbd key={j}>{key}</Kbd>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={() => setOpen(false)}>
              <X />
              {t("editor.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
