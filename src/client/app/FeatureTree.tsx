import {
  Button,
  Label,
  Modal,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { HandHelping, ListTree, Undo2, X } from "lucide-react";
import { useState } from "react";
import { Button as TileButton } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "wouter";
import type { FeatureRequests } from "../../server/community/feature-requests";
import {
  type Feature,
  isNew,
  ownOn,
  pathTo,
  planned,
  switchable,
  type Switches,
  switchesOn,
} from "../../shared/features";
import { useChanges } from "../data/changes";
import { useCommunity, useReloadCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { featureIcons, plannedIcons } from "../ui/icons";
import { FeatureLegend, marks } from "./FeatureLegend";
import { hasRole, useIsMember, useRoles } from "../data/me";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";
import {
  type Branch,
  branchOf,
  layOut,
  linkPath,
  NODE,
  PILL,
  type Placed,
  type TreeNode,
  treeNodes,
} from "./tree-layout";

type Node = TreeNode;

const graph = layOut();
const byId = new Map(treeNodes.map((n) => [n.id, n]));

/** A color per branch, readable on light and dark backgrounds, with white on it. */
const branchColors: Record<Branch, string> = {
  screens: "oklch(0.6 0.14 225)",
  live: "oklch(0.55 0.19 265)",
  stage: "oklch(0.56 0.2 305)",
  chords: "oklch(0.6 0.13 75)",
  songs: "oklch(0.58 0.19 10)",
  stats: "oklch(0.57 0.14 150)",
  app: "oklch(0.55 0.04 255)",
  team: "oklch(0.6 0.16 40)",
};
const colorOf = (id: string) =>
  branchColors[branchOf[id as keyof typeof branchOf]];

type State = "planned" | "always" | "on" | "off" | "locked" | "new";

const lit = (state: State) => state === "on" || state === "always";

/**
 * Every feature in a graph of what each needs: trees left to right
 * whose lines never cross, the features on their own beside them. A node opens the
 * feature: owners switch it on or off there, members ask for it.
 */
export function FeatureTree() {
  const { t } = useTranslation();
  const community = useCommunity();
  const { slug } = community;
  const owner = hasRole(useRoles(slug), "owner");
  const member = useIsMember(slug);
  const reload = useReloadCommunity();
  const requests =
    useJson<FeatureRequests>(
      member ? `/api/communities/${slug}/feature-requests` : null,
      useChanges(slug, "feature_requests"),
    ).data ?? undefined;
  // A change shows at once, until the community loads again with it.
  const [pending, setPending] = useState<{ base: Switches; set: Switches }>();
  const set =
    pending?.base === community.switches ? pending.set : community.switches;
  const on = switchesOn(set);
  const [failed, setFailed] = useState(false);
  // What's new links to a feature: /features?feature=<id> opens it.
  const [params] = useSearchParams();
  const [open, setOpen] = useState(() => {
    const id = params.get("feature");
    return id && byId.has(id as Node["id"]) ? id : undefined;
  });

  const save = async (next: Switches) => {
    setPending({ base: community.switches, set: next });
    const response = await send("PUT", `/api/communities/${slug}/switches`, {
      switches: next,
    });
    setFailed(!response?.ok);
    if (response?.ok) reload();
    else setPending(undefined);
  };
  /** Switches a feature on, with the path it needs, or off. */
  const turn = (name: Feature, value: boolean) => {
    const next = { ...set };
    if (value) for (const n of pathTo(set, name)) next[n] = true;
    next[name] = value;
    return save(next);
  };

  const stateOf = (node: Node): State => {
    if (node.planned) return "planned";
    const name = node.id as Feature;
    if (!switchable(name)) return "always";
    if (on.has(name)) return "on";
    if (ownOn(set, name)) return "locked";
    if (pathTo(set, name).length) return "locked";
    if (isNew(set, name)) return "new";
    return "off";
  };
  const name = (id: string) => t(`features.${id}.name`);
  const stateText = (node: Node, state: State) =>
    state === "locked"
      ? t("featureTree.state.locked", { name: name(node.needs ?? "") })
      : t(`featureTree.state.${state}`);

  const lines = graph.links.map((link) => ({
    node: link.to,
    lit: !link.to.planned && on.has(link.to.id as Feature),
    d: linkPath(link),
  }));

  const openNode = open ? byId.get(open as Node["id"]) : undefined;
  return (
    <section aria-labelledby="tree-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="tree-title"
          className="flex items-center gap-2 text-2xl font-semibold"
        >
          <ListTree />
          {t("featureTree.title")}
        </h2>
      </div>
      <p className="text-sm text-muted">
        {t(owner ? "featureTree.helpOwner" : "featureTree.help")}
      </p>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      <FeatureLegend colors={branchColors} />
      {/* Its laptop size everywhere: a phone scrolls it both ways, and zooms. */}
      <div className="-mx-4 overflow-auto px-4 pt-1 pb-2">
        <div
          className="relative"
          style={{ width: graph.width, height: graph.height }}
        >
          {graph.singlesAt && (
            <h3
              className="absolute text-sm font-semibold text-muted"
              style={{ left: graph.singlesAt.x, top: graph.singlesAt.y + 2 }}
            >
              {t("featureTree.onTheirOwn")}
            </h3>
          )}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={graph.width}
            height={graph.height}
          >
            {/* The lit lines last, over the others where two meet. */}
            {[...lines]
              .sort((a, b) => Number(a.lit) - Number(b.lit))
              .map(({ node, lit, d }) => (
                <path
                  key={node.id}
                  d={d}
                  fill="none"
                  strokeWidth={lit ? 2.5 : 1.5}
                  strokeDasharray={node.planned ? "4 4" : undefined}
                  className={lit ? undefined : "stroke-separator"}
                  style={lit ? { stroke: colorOf(node.id) } : undefined}
                />
              ))}
          </svg>
          <ul aria-label={t("featureTree.title")}>
            {graph.placed.map((node) => (
              <li key={node.id}>
                <TreeNodeButton
                  node={node}
                  state={stateOf(node)}
                  label={`${name(node.id)}, ${stateText(node, stateOf(node))}`}
                  name={name(node.id)}
                  asked={requests?.counts[node.id] ?? 0}
                  onPress={() => setOpen(node.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
      {openNode && (
        <FeatureDialog
          node={openNode}
          state={stateOf(openNode)}
          path={
            openNode.planned
              ? []
              : pathTo(set, openNode.id as Feature).map(name)
          }
          owner={owner}
          member={member}
          requests={requests}
          onTurn={(value) => turn(openNode.id as Feature, value)}
          onClose={() => setOpen(undefined)}
        />
      )}
    </section>
  );
}

/** A feature's pill: its round icon in its branch's color, and its name beside it. */
function TreeNodeButton({
  node,
  state,
  label,
  name,
  asked,
  onPress,
}: {
  node: Placed;
  state: State;
  label: string;
  name: string;
  asked: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const Icon = node.planned
    ? plannedIcons[node.id as keyof typeof plannedIcons]
    : featureIcons[node.id as Feature];
  const Mark = marks[state];
  const color = colorOf(node.id);
  const on = lit(state);
  const faint = state === "locked" || state === "planned";
  return (
    <TileButton
      aria-label={
        asked ? `${label}, ${t("featureTree.asked", { count: asked })}` : label
      }
      onPress={onPress}
      className={`group absolute z-10 flex items-center gap-1.5 rounded-full border-2 bg-background pe-2 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[hovered]:scale-[1.03] motion-safe:transition-transform ${
        state === "planned" ? "border-dashed" : ""
      }`}
      style={{
        left: node.x,
        top: node.y - NODE / 2,
        width: PILL,
        height: NODE,
        // Faint, the pill keeps its name readable: only its ring and icon fade.
        borderColor: faint
          ? `color-mix(in oklab, ${color} 45%, transparent)`
          : color,
        background: on
          ? `color-mix(in oklab, ${color} 16%, var(--background))`
          : undefined,
        boxShadow: on
          ? `0 0 12px color-mix(in oklch, ${color} 45%, transparent)`
          : undefined,
      }}
    >
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full"
        style={{
          background: on ? color : undefined,
          color: on ? "white" : color,
          opacity: faint ? 0.55 : undefined,
        }}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <span
        className={`line-clamp-2 min-w-0 text-start text-[11px] leading-[13px] ${
          faint ? "text-muted" : ""
        }`}
      >
        {name}
      </span>
      {Mark && (
        <span className="absolute -end-1.5 -top-1.5 grid size-4 place-items-center rounded-full border border-separator bg-background text-foreground">
          <Mark aria-hidden className="size-2.5" />
        </span>
      )}
      {asked > 0 && (
        <span className="absolute -start-1.5 -top-1.5 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] leading-4 font-semibold text-background">
          {asked}
        </span>
      )}
    </TileButton>
  );
}

/** A feature: what it does, its switch for owners, asking for it for members. */
function FeatureDialog({
  node,
  state,
  path,
  owner,
  member,
  requests,
  onTurn,
  onClose,
}: {
  node: Node;
  state: State;
  path: string[];
  owner: boolean;
  member: boolean;
  requests: FeatureRequests | undefined;
  onTurn: (value: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const mine = requests?.mine[node.id];
  const [note, setNote] = useState(mine ?? "");
  const [failed, setFailed] = useState(false);
  const [ask, asking] = usePending(async (method: "PUT" | "DELETE") => {
    const response = await send(
      method,
      `/api/communities/${slug}/feature-requests/${node.id}`,
      method === "PUT" ? { note } : undefined,
    );
    setFailed(!response?.ok);
  });
  const lit = state === "on" || state === "always";
  const askable = member && !lit;
  const who = requests?.who?.[node.id] ?? [];
  const count = requests?.counts[node.id] ?? 0;
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t(`features.${node.id}.name`)}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p>{t(`features.${node.id}.adds`)}</p>
            <p className="text-sm text-muted">
              {state === "locked"
                ? t("featureTree.state.locked", {
                    name: t(`features.${node.needs ?? ""}.name`),
                  })
                : t(`featureTree.state.${state}`)}
            </p>
            {owner && !node.planned && state !== "always" && (
              <div className="flex flex-col gap-1">
                <Switch
                  isSelected={lit}
                  onChange={(value) => void onTurn(value)}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Label>{t("featureTree.switch")}</Label>
                  </Switch.Content>
                </Switch>
                <p className="min-h-5 text-sm text-muted">
                  {!lit && path.length > 0
                    ? t("featureTree.path", { names: path.join(", ") })
                    : ""}
                </p>
              </div>
            )}
            {askable && (
              <TextField value={note} onChange={setNote}>
                <Label>{t("featureTree.note")}</Label>
                <TextArea rows={2} maxLength={500} />
              </TextField>
            )}
            {count > 0 && (
              <p className="text-sm text-muted">
                {t("featureTree.asked", { count })}
              </p>
            )}
            {owner && who.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {who.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.name}</span>
                    {w.note && `: ${w.note}`}
                  </li>
                ))}
              </ul>
            )}
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("feedback.close")}
            </Button>
            {askable && mine !== undefined && (
              <ActionButton
                variant="secondary"
                isPending={asking}
                onPress={() => void ask("DELETE")}
              >
                <Undo2 />
                {t("featureTree.withdraw")}
              </ActionButton>
            )}
            {askable && (
              <ActionButton isPending={asking} onPress={() => void ask("PUT")}>
                <HandHelping />
                {mine === undefined
                  ? t("featureTree.ask")
                  : t("featureTree.askAgain")}
              </ActionButton>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** /<community>/features: the feature tree, for every member. */
export function FeaturesPage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  if (!useIsMember(slug)) return <p>{t("featureTree.membersOnly")}</p>;
  return <FeatureTree />;
}

/** On the owners' Ideas page: the features members asked for, most asked first. */
export function RequestedFeatures() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const requests = useJson<FeatureRequests>(
    `/api/communities/${slug}/feature-requests`,
    useChanges(slug, "feature_requests"),
  ).data;
  const asked = Object.entries(requests?.who ?? {}).sort(
    ([, a], [, b]) => b.length - a.length,
  );
  return (
    <section aria-labelledby="asked-title" className="flex flex-col gap-3">
      <h3 id="asked-title" className="text-xl font-semibold">
        {t("featureTree.askedTitle")}
      </h3>
      {asked.length === 0 ? (
        <p className="text-sm text-muted">{t("featureTree.askedNone")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {asked.map(([id, who]) => {
            const Icon =
              id in planned
                ? plannedIcons[id as keyof typeof plannedIcons]
                : featureIcons[id as Feature];
            return (
              <li key={id} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                  {Icon && <Icon aria-hidden className="size-4" />}
                  {t(`features.${id}.name`)}
                  <span className="text-sm font-normal text-muted">
                    {t("featureTree.asked", { count: who.length })}
                  </span>
                </span>
                <ul className="flex flex-col gap-0.5 pl-6 text-sm">
                  {who.map((w, i) => (
                    <li key={i}>
                      <span className="font-medium">{w.name}</span>
                      {w.note && `: ${w.note}`}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/features" className="link text-sm">
        <ListTree />
        {t("featureTree.open")}
      </Link>
    </section>
  );
}
