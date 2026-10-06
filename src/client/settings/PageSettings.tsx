import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  Alert,
  Button,
  Input,
  Label,
  Modal,
  TextField,
  Switch,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Page } from "../../server/playlists/pages";
import { useCommunity, useShows } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { ActionButton, Empty, ErrorNotice, usePending } from "../ui/states";

/** Pages the team projects with one click, e.g. a start page before the service. */
export function Pages() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const url = `/api/communities/${slug}/pages`;
  const [version, setVersion] = useState(0);
  const { data: pages } = useJson<Page[]>(
    url,
    version + useChanges(slug, "pages"),
  );
  const [editing, setEditing] = useState<Page | "new" | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  const change = async (request: Promise<Response | null>) => {
    const response = await request;
    setProblem(!response?.ok);
    setVersion((n) => n + 1);
    return response?.ok ? response : null;
  };
  if (!pages) return null;

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">{t("pages.title")}</h3>
      <p className="text-sm text-muted">{t("pages.help")}</p>
      {problem && <ErrorNotice message={t("states.actionFailed")} />}
      {warning && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{warning}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      <div>
        <Button onPress={() => setEditing("new")}>
          <Plus />
          {t("pages.add")}
        </Button>
      </div>
      {pages.length === 0 ? (
        <Empty title={t("pages.empty")} description={t("pages.emptyHelp")} />
      ) : (
        <ul className="divide-y divide-separator border-y border-separator">
          {pages.map((page, i) => (
            <li
              key={page.id}
              aria-label={page.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            >
              <span className="font-medium">{page.name}</span>
              <span className="truncate text-sm text-muted">{page.url}</span>
              {shows("followAlong") && (
                <Switch
                  size="sm"
                  isSelected={page.qr}
                  onChange={(qr) =>
                    void change(send("PUT", `${url}/${page.id}/qr`, { qr }))
                  }
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Label>{t("follow.qrOnPage")}</Label>
                  </Switch.Content>
                </Switch>
              )}
              <span className="ms-auto flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  isDisabled={i === 0}
                  aria-label={t("pages.up")}
                  onPress={() =>
                    void change(
                      send("POST", `${url}/${page.id}/move`, { by: -1 }),
                    )
                  }
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  isDisabled={i === pages.length - 1}
                  aria-label={t("pages.down")}
                  onPress={() =>
                    void change(
                      send("POST", `${url}/${page.id}/move`, { by: 1 }),
                    )
                  }
                >
                  <ArrowDown />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setEditing(page)}
                >
                  <Pencil />
                  {t("playlist.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="danger-soft"
                  onPress={() =>
                    window.confirm(
                      t("pages.confirmDelete", { name: page.name }),
                    ) && void change(send("DELETE", `${url}/${page.id}`))
                  }
                >
                  <Trash2 />
                  {t("members.delete")}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <PageEditor
          page={editing === "new" ? null : editing}
          onSave={async (input) => {
            const response = await change(
              editing === "new"
                ? send("POST", url, input)
                : send("PUT", `${url}/${editing.id}`, input),
            );
            if (!response) return false;
            const { embeddable } = (await response.json()) as {
              embeddable: boolean | null;
            };
            setWarning(
              embeddable === false
                ? t("pages.notEmbeddable", { name: input.name })
                : null,
            );
            return true;
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function PageEditor({
  page,
  onSave,
  onClose,
}: {
  page: Page | null;
  onSave: (input: { name: string; url: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(page?.name ?? "");
  const [url, setUrl] = useState(page?.url ?? "https://");
  const [save, saving] = usePending(async () => {
    if (await onSave({ name, url })) onClose();
  });
  const https = /^https:\/\/[^/\s]+/.test(url);
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{page ? page.name : t("pages.add")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <TextField value={name} onChange={setName} isRequired autoFocus>
              <Label>{t("schedule.name")}</Label>
              <Input />
            </TextField>
            <TextField type="url" value={url} onChange={setUrl} isRequired>
              <Label>{t("pages.address")}</Label>
              <Input />
            </TextField>
            {!https && (
              <p className="text-sm text-muted">{t("pages.httpsOnly")}</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              isPending={saving}
              isDisabled={!name.trim() || !https}
              onPress={() => void save()}
            >
              <Save />
              {t("editor.save")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
