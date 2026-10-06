import { useTranslation } from "react-i18next";
import { type Named, playlistDate } from "../../shared/playlist-name";

/**
 * A playlist as people read it: its title, then its date muted; or the
 * date alone. In a flex row, the title is cut first and the date stays whole.
 */
export function PlaylistName({ playlist }: { playlist: Named }) {
  const { i18n } = useTranslation();
  const date = playlistDate(playlist.date, i18n.language);
  if (!playlist.title) return <span className="truncate">{date}</span>;
  return (
    <>
      <span className="truncate">{playlist.title}</span>{" "}
      <span className="shrink-0 text-[0.85em] font-normal text-muted">
        {date}
      </span>
    </>
  );
}
