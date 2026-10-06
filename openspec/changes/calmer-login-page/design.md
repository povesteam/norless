# Design

## Context

The login page (`LoginPage.tsx`) shows one way first by device: the QR card on a laptop, Google on a phone, the rest under "Other ways to log in", which until now opened below the main way. Google's script renders its button in an iframe and, on phones, its One Tap prompt, both from one `initialize`. The install suggestion sits above every page of the app frame.

## Goals / Non-Goals

**Goals:**
- Every way in fits a laptop's window without scrolling.
- One "Continue as" at a time on a phone.

**Non-Goals:**
- Changing which way comes first on each device.
- The phone's other ways (the email link and another phone), which still open below Google.

## Decisions

- **The other ways replace the QR on a laptop.** The card shows one thing at a time, and "Log in with your phone" goes back. Alternatives: two columns on wide windows, rejected as two ways at once; a smaller QR, rejected since the QR is the laptop's main way and must scan from across a desk.
- **One Tap's prompt first, the button after.** The button's space is kept but empty while the prompt may show, and fills on the prompt's skipped or dismissed moment, the only moments FedCM still reports (it reports no display moment). Where the script doesn't load or isn't asked to prompt, the button shows at once. Alternative: the button only, without the prompt, rejected by the maintainer.
- **Google's iframe takes the light color scheme.** An iframe whose color scheme differs from its document's gets an opaque backdrop, which showed as a white strip in dark mode; `color-scheme: light` on the button's container matches Google's document, so the backdrop stays transparent.
- **The install suggestion skips the login page.** Someone logging in has one task there; the suggestion shows on the next page.

## Risks / Trade-offs

- [A browser where Google reports no moment at all would keep the button's space empty] → the email link and another phone stay under "Other ways to log in".
