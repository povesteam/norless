# Tasks

## 1. Login page

- [ ] 1.1 Laptop: "Other ways to log in" replaces the QR in the card, with "Log in with your phone" back; update `e2e/auth.spec.ts`, `e2e/device-login.spec.ts` and `e2e/members.spec.ts` where they open the other ways on a laptop, plus a check that the QR comes back
- [ ] 1.2 Phone: keep Google's button space empty while One Tap's prompt may show, filled on its skipped or dismissed moment; at once where the script doesn't load
- [ ] 1.3 Google's button container takes `color-scheme: light`
- [ ] 1.4 No install suggestion on the login page (`App.tsx`)

## 2. Screenshots and archive

- [ ] 2.1 Take the login screenshots again (`npm run screenshots -- -g login`), phone and laptop
- [ ] 2.2 When archiving, fold the decisions into `openspec/specs/device-login/design.md`, `openspec/specs/auth/design.md` and `openspec/specs/app-shell/design.md`
