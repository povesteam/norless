import { HardDrive, WifiOff } from "lucide-react";
import { Chip, Spinner } from "@heroui/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { live } from "../data/connection";
import { keeps } from "./offline-store";

/** Shows when the live connection is down; hidden while connected. */
export function ConnectionStatus() {
  const { t } = useTranslation();
  const status = useSyncExternalStore(live.onStatus, live.status);
  // A device that keeps the community's songs opens them offline.
  const [location] = useLocation();
  const slug = location.split("/")[1] ?? "";
  const down = status === "reconnecting" || status === "offline";
  // The delay keeps a quick connect or reconnect from flashing.
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setLate(true), 1000);
    return () => {
      clearTimeout(timer);
      setLate(false);
    };
  }, [down]);

  if (!down || !late) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex flex-wrap items-center gap-2"
    >
      <Chip size="lg" color={status === "offline" ? "danger" : "warning"}>
        {status === "reconnecting" ? (
          <Spinner size="sm" color="current" aria-hidden />
        ) : (
          <WifiOff />
        )}
        <Chip.Label>
          {t(
            status === "offline"
              ? "connection.offline"
              : "connection.reconnecting",
          )}
        </Chip.Label>
      </Chip>
      {status === "offline" && slug && keeps(slug) && (
        <a
          href={`/${slug}/offline`}
          className="link rounded-full bg-background px-3 py-1 text-sm shadow"
        >
          <HardDrive />
          {t("offline.open")}
        </a>
      )}
    </div>
  );
}
