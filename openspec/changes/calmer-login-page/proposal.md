# Proposal

## Why

Production's first logins showed a crowded login page. On a laptop, "Other ways to log in" opens below the big QR card, out of the window. On a phone, the install suggestion, Google's own button (on a white strip in dark mode) and Google's One Tap prompt all show at once, two of them saying "Continue as". Decided with the maintainer on 2026-10-06.

## What Changes

- Laptop: "Other ways to log in" takes the QR's place in the card (Google and the email link), and "Log in with your phone" brings the QR back.
- Phone and tablet: One Tap's prompt shows alone; Google's button shows in its kept space once the prompt is closed or doesn't come.
- Google's button sits on the page's background in dark mode, without the white strip.
- The install suggestion doesn't show on the login page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `device-login`: on a laptop, the other ways replace the QR instead of opening below it.
- `auth`: One Tap's prompt alone on phones; Google's button on the page's background.
- `app-shell`: no install suggestion on the login page.

## Impact

- `src/client/account/LoginPage.tsx` (laptop layout, One Tap's moments, the button's color scheme), `src/client/app/App.tsx` (the install suggestion's place).
- `e2e/auth.spec.ts`, `e2e/device-login.spec.ts`, `e2e/members.spec.ts` (the other ways on a laptop); the login screenshots (`e2e/screenshots/shots/classic.ts`).
