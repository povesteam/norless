/** An email to send; `replyTo` overrides MAIL_REPLY_TO. */
export type Mail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};
export type Mailer = (mail: Mail) => Promise<boolean>;

/**
 * Sends through Mailgun's HTTP API when MAILGUN_API_KEY, MAILGUN_DOMAIN and MAIL_FROM
 * are set (MAILGUN_API_URL for its EU region, MAIL_REPLY_TO for where answers go).
 * Null otherwise: nothing can be sent.
 */
export function mailgun(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  const { MAILGUN_API_KEY: key, MAILGUN_DOMAIN: domain, MAIL_FROM: from } = env;
  if (!key || !domain || !from) return null;
  const url = `${env.MAILGUN_API_URL ?? "https://api.mailgun.net"}/v3/${domain}/messages`;
  return async ({ to, subject, text, replyTo = env.MAIL_REPLY_TO }) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        from,
        to,
        subject,
        text,
        ...(replyTo ? { "h:Reply-To": replyTo } : {}),
      }),
    }).catch(() => null);
    return !!response?.ok;
  };
}

/** For development and tests: keeps each address's last email instead of sending it. */
export function devMailer() {
  const last = new Map<string, Mail>();
  const send: Mailer = async (mail) => {
    last.set(mail.to, mail);
    return true;
  };
  return { send, last: (to: string) => last.get(to) };
}
