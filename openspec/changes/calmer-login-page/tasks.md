# Tasks

## 1. Login page

- [x] 1.1 Laptop: "Other ways to log in" replaces the QR in the card, with "Log in with your phone" back; update `e2e/auth.spec.ts`, `e2e/device-login.spec.ts` and `e2e/members.spec.ts` where they open the other ways on a laptop, plus a check that the QR comes back
- [x] 1.2 Google loads only on the press: the prompt, else Google's login page (replaces One Tap on opening the page and Google's own button)
- [ ] 1.3 Try on norless.com: nothing from accounts.google.com before the press (browser's network panel), then Continue as on a phone and on a laptop
- [x] 1.4 No install suggestion on the login page (`App.tsx`)
- [x] 1.5 Phone: "Other ways to log in" replaces Google's button, with "Continue with Google" back. Verify in `e2e/auth.spec.ts` with a phone's viewport
- [x] 1.6 "Continue with Google" shows it's loading from the press until Google's card or page. Verify in `e2e/auth.spec.ts` with Google's script held back

## 2. Screenshots and archive

- [x] 2.1 Take the login screenshots again (`npm run screenshots -- -g login`), phone and laptop, and the other ways (`login-other-ways`), on a phone too
- [ ] 2.2 When archiving, fold the decisions into `openspec/specs/device-login/design.md`, `openspec/specs/auth/design.md` and `openspec/specs/app-shell/design.md`
