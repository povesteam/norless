import { Button, Input, TextField } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { type Named, playlistDate } from "../../shared/playlist-name";
import { Tip } from "../ui/tip";
import { PlaylistName } from "./PlaylistName";

/**
 * The open playlist's name in the bar: for the team, a click
 * turns its title into a text field, where Enter or leaving saves and Escape cancels; an
 * empty title leaves the date alone.
 */
export function PlaylistTitle({
  playlist: { title, date },
  canChange,
  editing,
  onEditing,
  onRename,
  asMenu,
}: {
  playlist: Named;
  canChange: boolean;
  editing: boolean;
  onEditing: (editing: boolean) => void;
  /** Resolves to nothing when the server refused. */
  onRename: (title: string) => Promise<unknown>;
  /** On a phone: the title opens the playlist's actions. */
  asMenu?: (trigger: ReactElement) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [typed, setTyped] = useState(title ?? "");
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Leaving after Enter or Escape saves nothing more; their focus goes back to the title.
  const finished = useRef(false);
  const refocus = useRef(false);
  // A new title shows at once, until the playlist loads again with it.
  const [renamed, setRenamed] = useState<{ title: string | null } | null>(null);
  const [loaded, setLoaded] = useState(title);
  if (loaded !== title) {
    setLoaded(title);
    setRenamed(null);
  }
  const shown = renamed ? renamed.title : title;
  // Editing starts from the title as it is then.
  const [started, setStarted] = useState(editing);
  if (started !== editing) {
    setStarted(editing);
    if (editing) setTyped(shown ?? "");
  }
  useEffect(() => {
    if (editing) {
      finished.current = false;
      input.current?.select();
    } else if (refocus.current) {
      refocus.current = false;
      button.current?.focus();
    }
  }, [editing]);
  const finish = (save: boolean, back: boolean) => {
    if (finished.current) return;
    finished.current = true;
    refocus.current = back;
    const trimmed = typed.trim();
    if (save && trimmed !== (shown ?? "")) {
      setRenamed({ title: trimmed || null });
      void onRename(trimmed).then((ok) => {
        if (!ok) setRenamed(null);
      });
    }
    onEditing(false);
  };

  if (canChange && editing)
    return (
      <TextField
        data-bar-title
        aria-label={t("playlist.title")}
        value={typed}
        onChange={setTyped}
        onBlur={() => finish(true, false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Its keypress would click the title, which takes the focus now.
            event.preventDefault();
            finish(true, true);
          }
          if (event.key === "Escape") finish(false, true);
        }}
        className="w-[min(22rem,55vw)] min-w-0"
      >
        <Input
          ref={input}
          placeholder={playlistDate(date, i18n.language)}
          className="h-9 text-lg font-semibold"
        />
      </TextField>
    );
  return (
    // Whole up to two thirds of the bar; the community's name takes what's left.
    // On a phone the community's name is above the bar, so the title takes the line.
    <h2
      data-bar-title
      className={`flex min-w-0 text-lg font-semibold ${asMenu ? "flex-1" : "max-w-[65%] shrink-0"}`}
    >
      {asMenu ? (
        asMenu(
          <Button
            ref={button}
            variant="ghost"
            className="h-9 min-w-0 max-w-full justify-start gap-2 px-1 text-lg font-semibold"
          >
            <PlaylistName playlist={{ title: shown, date }} />
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </Button>,
        )
      ) : canChange ? (
        <Tip label={t("playlist.rename")}>
          <Button
            ref={button}
            variant="ghost"
            className="h-9 min-w-0 max-w-full justify-start gap-2 px-1 text-lg font-semibold"
            onPress={() => onEditing(true)}
          >
            <PlaylistName playlist={{ title: shown, date }} />
          </Button>
        </Tip>
      ) : (
        <span className="flex min-w-0 items-baseline gap-2">
          <PlaylistName playlist={{ title: shown, date }} />
        </span>
      )}
    </h2>
  );
}
