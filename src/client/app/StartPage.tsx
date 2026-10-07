import { buttonVariants } from "@heroui/react";
import { ArrowRight, BookOpenText, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Redirect } from "wouter";
import { type Community, lastCommunity, switchesOf } from "../data/community";
import { useJson } from "../data/fetch";
import { useFollowView } from "../screens/Follow";
import { featureIcons } from "../ui/icons";
import { installed, installSteps, useInstallPrompt } from "./Install";
import { manualOf } from "./manual";

type Listed = { slug: string; name: string };

/**
 * /: the community this device opened last. Otherwise a browser tab shows what Norless
 * is, Install first; the installed app, whose storage may not be the browser's, opens the
 * only community or lists them.
 */
export function StartPage() {
  const last = lastCommunity();
  const communities = useJson<Listed[]>(last ? null : "/api/communities").data;
  const only = communities?.length === 1 ? communities[0]?.slug : undefined;
  if (last) return <Redirect to={`/${last}`} replace />;
  if (!communities) return null;
  if (!installed()) return <Presentation communities={communities} />;
  if (only) return <Redirect to={`/${only}`} replace />;
  return <CommunityList communities={communities} />;
}

function CommunityList({ communities }: { communities: Listed[] }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("start.communities")} className="flex flex-col gap-2">
      {communities.map((c) => (
        <Link key={c.slug} href={`/${c.slug}`} className="link text-lg">
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * For the team first: Install, then the way into the community, in a card; during a
 * service, following along on top.
 */
function Presentation({ communities }: { communities: Listed[] }) {
  const { t } = useTranslation();
  const prompt = useInstallPrompt();
  const only = communities.length === 1 ? communities[0] : undefined;
  const community = useJson<Community>(
    only ? `/api/communities/${only.slug}` : null,
  ).data;
  const follows = !!community && switchesOf(community).has("followAlong");
  const following = useFollowView(follows && only ? only.slug : null);
  const manual = manualOf(
    useJson<{ source: string | null }>("/api/about").data?.source ?? null,
  );
  // Shown once what it depends on is known, so nothing moves in.
  if ((only && !community) || (follows && following === undefined)) return null;

  const FollowIcon = featureIcons.followAlong;
  const live = !!following?.entryId && !following.blank;
  // Chrome's install prompt comes a moment after the page: its place is kept for it in
  // the browsers that may offer one, so nothing moves when it comes.
  const mayOffer = !!prompt || "onbeforeinstallprompt" in window;
  const install = installSteps ? (
    <p className="flex items-center gap-3 rounded-2xl border border-separator bg-background p-4 text-start">
      <Download className="shrink-0" />
      {t(installSteps)}
    </p>
  ) : (
    mayOffer && (
      <div className="grid min-h-12 w-full">
        {prompt && (
          <button
            type="button"
            className={`${buttonVariants({ size: "lg" })} w-full`}
            onClick={() => void prompt.prompt()}
          >
            <Download />
            {t("install.install")}
          </button>
        )}
      </div>
    )
  );

  return (
    <article className="mx-auto flex w-full max-w-md flex-col gap-4 pt-4">
      {follows && only && (
        // Both lines in one cell, so going live moves nothing.
        <div className="grid">
          <Link
            href={`/${only.slug}/follow`}
            className={`${buttonVariants({ size: "lg", variant: "secondary" })} col-start-1 row-start-1 w-full ${live ? "" : "invisible"}`}
          >
            <FollowIcon />
            {t("start.follow")}
          </Link>
          <p
            className={`col-start-1 row-start-1 flex items-center gap-2 text-muted ${live ? "invisible" : ""}`}
          >
            <FollowIcon className="shrink-0" />
            {t("start.followLater")}
          </p>
        </div>
      )}
      {/* In a card, the app's icon on top; Log in is in the page's header. */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-separator bg-surface p-6 text-center shadow-sm">
        <img src="/icon.svg" alt="" className="size-16 rounded-2xl" />
        <p className="text-lg">{t("about.what")}</p>
        {install}
        {only && (
          <Link
            href={`/${only.slug}`}
            className={`${buttonVariants({ size: "lg", variant: "secondary" })} w-full`}
          >
            <ArrowRight />
            {t("start.open", { name: only.name })}
          </Link>
        )}
      </div>
      {!only && <CommunityList communities={communities} />}
      {manual && (
        <a href={manual} className="link self-start">
          <BookOpenText />
          {t("start.manual")}
        </a>
      )}
    </article>
  );
}
