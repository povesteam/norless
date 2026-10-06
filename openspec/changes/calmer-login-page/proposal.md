# Proposal

## Why

Production's first logins showed a crowded login page, and Google's script loaded before anyone chose Google. On a laptop, "Other ways to log in" opens below the big QR card, out of the window. On a phone, the install suggestion, Google's own button (on a white strip in dark mode) and Google's One Tap prompt all show at once, two of them saying "Continue as". Decided with the maintainer on 2026-10-06, the Google part revised the same day: Google loads only once chosen.

## What Changes

- Laptop: "Other ways to log in" takes the QR's place in the card (Google and the email link), and "Log in with your phone" brings the QR back.
- Nothing loads from Google until "Continue with Google" is pressed; pressed, Google's "Continue as" prompt opens on the page, else Google's own login page. Google's own button (and its white strip in dark mode) and the prompt on opening the page go.
- The install suggestion doesn't show on the login page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `device-login`: on a laptop, the other ways replace the QR instead of opening below it.
- `auth`: Google loads only once its button is pressed.
- `app-shell`: no install suggestion on the login page.

## Impact

- `src/client/account/LoginPage.tsx` (laptop layout, Google on the press), `src/client/app/App.tsx` (the install suggestion's place).
- `e2e/auth.spec.ts`, `e2e/device-login.spec.ts`, `e2e/members.spec.ts` (the other ways on a laptop); the login screenshots (`e2e/screenshots/shots/classic.ts`).
