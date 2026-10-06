import { Headphones, Plus, Trash2 } from "lucide-react";
import { Button, Description, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReferenceLink } from "../../server/songs/songs";
import { send } from "../data/fetch";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/** The address's own site, when the link names none: "youtube.com". */
export const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, "");
  } catch {
    return url;
  }
};

/** A link's picture, or a headphones sign in the same space. */
function Picture({ link }: { link: ReferenceLink }) {
  return link.image ? (
    <img
      src={`/api/images/${link.image}`}
      alt=""
      className="h-12 w-20 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-default text-muted">
      <Headphones />
    </span>
  );
}

/** The song page's recordings to learn the song from, each opening in a new tab. */
export function ReferenceLinkList({ links }: { links: ReferenceLink[] }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{t("song.references")}</h3>
      <ul className="flex flex-col gap-2">
        {links.map((link, i) => (
          <li key={i}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg hover:bg-default"
            >
              <Picture link={link} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {link.title || siteOf(link.url)}
                </span>
                <span className="truncate text-sm text-muted">
                  {link.site || siteOf(link.url)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** An address the server takes for a link: https, without spaces. */
export const isHttps = (url: string) =>
  /^https:\/\/\S+$/.test(url) && url.length <= 500;

/**
 * The Chords mode's links: adding one reads its title, site and
 * picture; the title can be changed, and links removed.
 */
export function ReferenceLinksField({
  slug,
  links,
  onChange,
}: {
  slug: string;
  links: ReferenceLink[];
  onChange: (links: ReferenceLink[]) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const bad = url.trim() !== "" && !isHttps(url.trim());
  const [add, adding] = usePending(async () => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/link-preview`,
      { url: url.trim() },
    );
    setFailed(!response?.ok);
    if (!response?.ok) return;
    onChange([...links, (await response.json()) as ReferenceLink]);
    setUrl("");
  });
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-semibold">{t("song.references")}</h3>
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-3">
          <Picture link={link} />
          <TextField
            value={link.title}
            onChange={(title) =>
              onChange(links.map((l, j) => (j === i ? { ...l, title } : l)))
            }
            maxLength={200}
            className="min-w-0 flex-1"
          >
            <Label className="sr-only">{t("chords.linkTitle")}</Label>
            <Input placeholder={siteOf(link.url)} />
            <Description className="truncate">
              {link.site || siteOf(link.url)}
            </Description>
          </TextField>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={t("chords.removeLink")}
            onPress={() => onChange(links.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      {links.length < 10 && (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim() && !bad) void add();
          }}
        >
          <TextField
            value={url}
            onChange={setUrl}
            isInvalid={bad}
            className="min-w-60 flex-1"
          >
            <Label>{t("chords.reference")}</Label>
            <Input type="url" inputMode="url" placeholder="https://" />
            <Description>{t("chords.referenceHelp")}</Description>
          </TextField>
          <ActionButton
            type="submit"
            variant="secondary"
            className="mt-6"
            isPending={adding}
            isDisabled={!url.trim() || bad}
          >
            <Plus />
            {t("chords.addLink")}
          </ActionButton>
        </form>
      )}
    </section>
  );
}
