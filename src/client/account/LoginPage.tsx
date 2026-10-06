import { LogIn, Mail, Smartphone, Wrench } from "lucide-react";
import {
  Alert,
  Button,
  buttonVariants,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "wouter";
import { useDeviceType } from "../data/device";
import { send, useJson } from "../data/fetch";
import { PhoneLogin } from "./DeviceLogin";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

type Methods = {
  dev: boolean;
  email: boolean;
  google: boolean;
  /** Development without Google: a pretend Google that lists the accounts. */
  fakeGoogle: boolean;
  /** Development: emails are shown here instead of sent. */
  devMail: boolean;
};

/** Only paths on this site, so a login can't send people elsewhere. */
export const loginTarget = (next: string | null) =>
  next?.startsWith("/") && !next.startsWith("//") ? next : "/";

/**
 * The login page: the one way that fits the device first, the others
 * one tap away. A laptop shows the big QR for a phone where someone is logged in; a
 * phone offers Google. Development looks the same, with a pretend Google and the
 * email shown instead of sent.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const methods = useJson<Methods>("/api/auth/methods");
  const laptop = useDeviceType().deviceType === "laptop";
  const [others, setOthers] = useState(false);
  // Back from Google without a login, or Sign in with Google refused: why.
  const [refused, setRefused] = useState<string | null>(null);
  const google = refused ?? params.get("google");
  const target = loginTarget(params.get("next"));
  const m = methods.data;
  const googleButton = m?.google && (
    <GoogleButton
      href={
        m.fakeGoogle
          ? `/dev/google?next=${encodeURIComponent(target)}`
          : `/api/auth/google?next=${encodeURIComponent(target)}`
      }
      target={target}
      // Google's prompt only with the real Google.
      signIn={!m.fakeGoogle}
      onRefused={setRefused}
    />
  );
  const emailForm = m?.email && (
    <EmailLink target={target} devMail={m.devMail} />
  );
  // Without Google, a phone's main way is the email link.
  const phoneMain = googleButton || emailForm;
  // A phone can always be logged in from another phone.
  const hasOthers = laptop ? !!(googleButton || emailForm) : true;

  return (
    <div
      // On a laptop, a card in the middle of the window.
      className={`flex flex-col gap-4 ${
        laptop
          ? "mx-auto mt-6 w-full max-w-md rounded-2xl border border-separator bg-surface p-6 shadow-sm"
          : "max-w-90"
      }`}
    >
      <h2 className="text-2xl font-semibold">{t("auth.login")}</h2>
      {methods.failed && (
        <ErrorNotice message={t("states.loadFailed")} onRetry={methods.retry} />
      )}
      {google && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {t(
                google === "not-invited"
                  ? "auth.notInvited"
                  : google === "unverified"
                    ? "auth.googleUnverified"
                    : "auth.googleFailed",
              )}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {laptop && others ? (
        // On a laptop the other ways take the QR's place, so all fits the window.
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">{t("auth.otherWays")}</h3>
          {googleButton}
          {emailForm}
          <button
            type="button"
            className="link self-start underline"
            onClick={() => setOthers(false)}
          >
            <Smartphone />
            {t("deviceLogin.withPhone")}
          </button>
        </section>
      ) : (
        <>
          {laptop ? <PhoneLogin target={target} big /> : phoneMain}
          {hasOthers &&
            (others ? (
              <section className="flex flex-col gap-4 border-t border-separator pt-4">
                <h3 className="text-lg font-semibold">{t("auth.otherWays")}</h3>
                {googleButton && emailForm}
                <PhoneLogin target={target} />
              </section>
            ) : (
              <button
                type="button"
                className="link self-start underline"
                onClick={() => setOthers(true)}
              >
                <LogIn />
                {t("auth.otherWays")}
              </button>
            ))}
        </>
      )}
    </div>
  );
}

/** Google's sign-in script, as much of it as the login page uses. */
type Gis = {
  accounts: {
    id: {
      initialize: (options: object) => void;
      prompt: (
        listener?: (moment: { isSkippedMoment: () => boolean }) => void,
      ) => void;
    };
  };
};
let gis: Promise<Gis | null> | null = null;
/** Loaded once, and only by the login page. */
const loadGis = () =>
  (gis ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve((window as { google?: Gis }).google ?? null);
    script.onerror = () => {
      gis = null;
      resolve(null);
    };
    document.head.append(script);
  }));

/** Google's G, in its colors. */
const GoogleLogo = () => (
  <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

/**
 * Continue with Google, in Google's look. Nothing loads from Google before it's pressed;
 * pressed, Google's script opens its "Continue as …" prompt on the page, and where the
 * script doesn't load or the prompt doesn't come, Google's own login page opens instead.
 */
function GoogleButton({
  href,
  target,
  signIn,
  onRefused,
}: {
  href: string;
  target: string;
  signIn: boolean;
  onRefused: (why: string) => void;
}) {
  const { t } = useTranslation();
  const leave = () => window.location.assign(href);
  const press = async () => {
    const [google, start] = await Promise.all([
      loadGis(),
      fetch("/api/auth/google/one-tap")
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ clientId: string; nonce: string }>)
            : null,
        )
        .catch(() => null),
    ]);
    if (!google || !start) return leave();
    google.accounts.id.initialize({
      client_id: start.clientId,
      nonce: start.nonce,
      context: "signin",
      itp_support: true,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }: { credential: string }) => {
        const response = await send("POST", "/api/auth/google/one-tap", {
          credential,
          next: target,
        });
        const body = (await response?.json().catch(() => null)) as {
          next?: string;
          error?: string;
        } | null;
        if (response?.ok && body?.next) window.location.assign(body.next);
        else onRefused(body?.error ?? "failed");
      },
    });
    // Closed, or not shown (no Google account in this browser): Google's own page.
    google.accounts.id.prompt((moment) => {
      if (moment.isSkippedMoment()) leave();
    });
  };
  return (
    <a
      href={href}
      onClick={(event) => {
        if (!signIn) return;
        event.preventDefault();
        void press();
      }}
      // Google's branding: white or near-black, a grey line, its G before the words.
      className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-4 text-sm font-medium text-[#1F1F1F] outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3]"
    >
      <GoogleLogo />
      {t("auth.google")}
    </a>
  );
}

/** "Email me a link"; in development, the email is shown here instead of sent. */
function EmailLink({ target, devMail }: { target: string; devMail: boolean }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<"failed" | "sent" | "tooMany" | null>(
    null,
  );
  const [shown, setShown] = useState<string | null>(null);
  // The same answer whether or not the address can log in.
  const [askLink, asking] = usePending(async () => {
    const response = await send("POST", "/api/auth/email-link", {
      email,
      next: target,
      language: i18n.language,
    });
    setOutcome(
      response?.ok ? "sent" : response?.status === 429 ? "tooMany" : "failed",
    );
    if (!response?.ok || !devMail) return;
    const mail = await fetch(
      `/api/auth/dev-mail?to=${encodeURIComponent(email)}`,
    ).then((r) => (r.ok ? (r.json() as Promise<{ text: string }>) : null));
    setShown(mail?.text.match(/https?:\/\/\S+/)?.[0] ?? null);
  });
  return (
    <>
      {outcome === "failed" && (
        <ErrorNotice message={t("states.actionFailed")} />
      )}
      {outcome === "tooMany" && <ErrorNotice message={t("auth.tooMany")} />}
      {outcome === "sent" && (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("auth.checkEmail", { email })}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {shown && (
        <div className="flex flex-col items-start gap-2 rounded-xl border-2 border-dashed border-warning p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Wrench />
            {t("auth.devMail")}
          </p>
          <a className={buttonVariants({ variant: "secondary" })} href={shown}>
            <Mail />
            {t("auth.devOpenLink")}
          </a>
        </div>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void askLink();
        }}
      >
        <TextField type="email" isRequired value={email} onChange={setEmail}>
          <Label>{t("auth.email")}</Label>
          <Input />
        </TextField>
        <ActionButton type="submit" isPending={asking}>
          <Mail />
          {t("auth.emailLink")}
        </ActionButton>
      </form>
    </>
  );
}

/**
 * /dev/google, in development without Google: a pretend Google account chooser, plainly
 * marked, that logs in the account chosen without checking it.
 */
export function DevGooglePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const target = loginTarget(params.get("next"));
  const methods = useJson<Methods>("/api/auth/methods").data;
  const accounts = useJson<{ name: string; email: string }[]>(
    methods?.fakeGoogle ? "/api/auth/dev-accounts" : null,
  ).data;
  const [email, setEmail] = useState("");
  const [choose, choosing] = usePending(async (address: string) => {
    const response = await send("POST", "/api/auth/dev-login", {
      email: address,
    });
    // As after Google: back to the login page with why, or a whole page load into
    // Norless, so the live connection knows who it is.
    if (response?.status === 403)
      location.assign(
        `/login?google=not-invited&next=${encodeURIComponent(target)}`,
      );
    else if (response?.ok) location.assign(target);
  });
  if (methods && !methods.fakeGoogle) return <p>{t("auth.devGoogleOff")}</p>;
  return (
    <div className="flex max-w-90 flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl border-2 border-dashed border-warning p-3 text-sm font-semibold">
        <Wrench className="shrink-0" />
        {t("auth.devGoogle")}
      </div>
      <h2 className="text-2xl font-semibold">{t("auth.chooseAccount")}</h2>
      <ul className="flex flex-col gap-2">
        {(accounts ?? []).map((a) => (
          <li key={a.email}>
            <Button
              variant="secondary"
              fullWidth
              className="h-auto justify-start py-2 text-start"
              isDisabled={choosing}
              onPress={() => void choose(a.email)}
            >
              <span className="flex flex-col">
                <span className="font-semibold">{a.name || a.email}</span>
                <span className="text-sm text-muted">{a.email}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-4 border-t border-separator pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void choose(email);
        }}
      >
        <TextField type="email" isRequired value={email} onChange={setEmail}>
          <Label>{t("auth.anotherAccount")}</Label>
          <Input />
        </TextField>
        <ActionButton type="submit" isPending={choosing}>
          <LogIn />
          {t("auth.continue")}
        </ActionButton>
      </form>
    </div>
  );
}
