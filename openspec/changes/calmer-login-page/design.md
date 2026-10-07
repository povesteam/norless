# Design

## Context

The login page (`LoginPage.tsx`) shows one way first by device: the QR card on a laptop, Google on a phone, the rest under "Other ways to log in", which until now opened below the main way. Google's script renders its button in an iframe and, on phones, its One Tap prompt, both from one `initialize`. The install suggestion sits above every page of the app frame.

## Goals / Non-Goals

**Goals:**
- Every way in fits a laptop's window without scrolling.
- One "Continue as" at a time on a phone.
- Nothing from Google before the person chooses it.

**Non-Goals:**
- Changing which way comes first on each device.

## Decisions

- **The other ways replace the QR on a laptop.** The card shows one thing at a time, and "Log in with your phone" goes back. Alternatives: two columns on wide windows, rejected as two ways at once; a smaller QR, rejected since the QR is the laptop's main way and must scan from across a desk.
- **Google loads on the press.** The page shows only its own button in Google's look; pressed, it loads Google's script and asks for a nonce, then opens the "Continue as" prompt. On the prompt's skipped moment (closed, or no Google account in the browser), the only moment FedCM still reports besides dismissed, it goes to Google's own login page, as it does when the script doesn't load. So Google learns of a visit only from someone who chose it, and the person's Google name and photo no longer show before the press. Alternatives: the prompt on opening the page with Google's own button (tried first, it loaded Google for everyone); straight to Google's login page with no script (rejected by the maintainer: the prompt keeps the person on the page).
- **On a phone too, the other ways take the main way's place.** Decided with the maintainer on 2026-10-07: with Google's button above the other ways, a phone showed two ways at once. "Continue with Google" goes back, as "Log in with your phone" does on a laptop. Alternatives: tabs (Google, Email, Phone), rejected for one pattern on both devices; keeping both, which was the complaint.
- **The Google button shows it's loading.** Pressed, it waits for Google's script and a nonce before Google's card appears, which on a phone took long enough to look broken; it shows a spinner and ignores presses until then, and comes back if Google's prompt is skipped and the page stays.
- **The install suggestion skips the login page.** Someone logging in has one task there; the suggestion shows on the next page.

## Risks / Trade-offs

- [A browser where Google reports no moment at all would leave the press without an answer] → pressing again tries again, and the email link and another phone stay under "Other ways to log in".
