import { RotateCw } from "lucide-react";
import {
  Alert,
  Button,
  type ButtonProps,
  EmptyState,
  Skeleton,
  Spinner,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { track } from "../data/usage";

/** Whether `ms` have passed since the component appeared. */
function useAfter(ms: number) {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPassed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return passed;
}

const widths = ["w-4/5", "w-3/5", "w-2/3", "w-1/2"];

/** Placeholders showing, and when the last one went away. */
let placeholders = 0;
let placeholderGone = -Infinity;

/**
 * Takes away the placeholder `index.html` shows while the app's code loads
 *, once the app shows something; a placeholder following it shows at
 * once, as one following another does.
 */
export function removeShell() {
  if (shellShows()) placeholderGone = performance.now();
  document.getElementById("shell")?.remove();
}

/** Whether index.html's placeholder shows: one rendering now follows it. */
function shellShows() {
  const shell = document.getElementById("shell");
  return !!shell && getComputedStyle(shell).opacity !== "0";
}

/**
 * Grey bars where a page's heading and `lines` of content will be. They show only after
 * 300 ms, so content that comes quickly doesn't flash a placeholder first; at once when
 * they follow another, e.g. the community, then its newest playlist, loading on opening
 * the app, so they don't blink.
 */
export function Placeholder({ lines = 6 }: { lines?: number }) {
  const { t } = useTranslation();
  // The one it replaces may still be showing while this one renders.
  const [follows] = useState(
    () =>
      placeholders > 0 ||
      performance.now() - placeholderGone < 500 ||
      shellShows(),
  );
  const late = useAfter(300) || follows;
  useEffect(() => {
    if (!late) return;
    placeholders++;
    return () => {
      placeholders--;
      placeholderGone = performance.now();
    };
  }, [late]);
  if (!late) return null;
  return (
    <div
      role="status"
      aria-label={t("states.loading")}
      className="flex flex-col gap-3"
    >
      <Skeleton className="h-7 w-1/3 rounded-lg" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-4 rounded-lg ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** What failed and what to do next, in warning colors so it never looks like an empty state. */
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    track("error.shown", {
      page: location.pathname,
      message: message.slice(0, 200),
    });
  }, [message]);
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content className="flex flex-col items-start gap-2">
        <Alert.Title>{message}</Alert.Title>
        {onRetry && (
          <Button size="sm" variant="danger-soft" onPress={onRetry}>
            <RotateCw />
            {t("states.tryAgain")}
          </Button>
        )}
      </Alert.Content>
    </Alert>
  );
}

/**
 * Nothing here yet: what would appear here, and `children` with the next step for those
 * allowed to take it. Calm on purpose: no warning colors, icons or words like "error".
 */
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <EmptyState className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-md">{description}</p>
      {children}
    </EmptyState>
  );
}

/**
 * Runs `action` one at a time, so a second tap on Save while it saves does nothing
 * (and gives undefined). `pending` is for the button to show that it's working.
 */
export function usePending<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
) {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const run = async (...args: A): Promise<R | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setPending(true);
    try {
      return await action(...args);
    } finally {
      running.current = false;
      setPending(false);
    }
  };
  return [run, pending] as const;
}

/** A button that shows a spinner while `isPending`, and ignores presses meanwhile. */
export function ActionButton({
  children,
  ...props
}: Omit<ButtonProps, "children"> & { children: React.ReactNode }) {
  return (
    <Button {...props}>
      {({ isPending }) => (
        <>
          {isPending && <Spinner color="current" size="sm" aria-hidden />}
          {children}
        </>
      )}
    </Button>
  );
}
