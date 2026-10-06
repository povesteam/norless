# Agent rules

Read by Claude Code (through `CLAUDE.md`), Cursor and GitHub Copilot.

## Workflow

- Behavior lives in `openspec/specs/<capability>/spec.md`, and why it works that way in the `design.md` beside it: the decisions in force with their reasons, and the alternatives rejected. Start behavior changes with an OpenSpec change (`/openspec-propose`); when it's archived, fold its lasting decisions into the capability's `design.md`, replacing any it overrides.
- Specs, `design.md` files and code comments state the rule and its reason: no dates, no change names, no people's names. A change's own files (proposal, design, tasks) may date its decisions.
- Before writing or starting a change, ask the maintainers every open question, round by round, until none remain, and record the answers as decisions in the change. Some changes list the questions to ask when they start.
- Don't ask which milestone a feature belongs to: place it in PLAN.md's build order (later, unless cutover needs it).
- A request that contradicts what's built: first check whether it fits as a setting, a personal preference or a feature switch; otherwise adopt it or reject it, and say which.
- Where to start: PLAN.md "Status" says what's next, and "Build order" the sequence. `ARCHITECTURE.md` says where the code lives, the patterns to copy and which tests to run; a change that adds or moves a pattern updates it.
- Before a commit: `npm run check` passes (lint, format, typecheck, OpenSpec, unit tests). Check its exit code; a pipe hides failures.
- Sign off every commit (`git commit -s`), because the repo uses the DCO.
- Every behavior change comes with a test: Vitest for logic, Playwright for user flows.
- A change that adds a view or changes how one looks adds or updates its shots in `e2e/screenshots/shots/` (a file per set of features), and takes those views again before it's archived (`npm run screenshots -- -g musicians`); a visual bug fix takes them too.

## Code

- TypeScript in strict mode.
- Stable dependencies only (1.0 or later, actively maintained). Ask before adding one, and prefer the platform or code already in the repo.
- Use Node 24 LTS (`.nvmrc`) with npm 11. `.npmrc` sets `min-release-age=2`, so npm installs only versions published at least two days ago (supply-chain safety), and `save-exact`. Install scripts are denied unless listed in `allowScripts`.
- `dependencies` are what the server needs at runtime. Client libraries go in `devDependencies`, because Vite bundles them into `dist/client` and the production image skips dev dependencies.
- No abstraction without a second real use.
- Files stay under 500 lines of code (ESLint's `max-lines`, blank lines and comments not counted) and folders under 40 entries (`src/structure.test.ts`; the locales are exempt): split a file along its seams (sub-components, hooks, route groups, tests by feature), nest a crowded folder by area.
- UI: HeroUI components (built on React Aria) and Tailwind utilities. Use React Aria directly where HeroUI has no component (e.g. `GridList` for sortable lists). Colors, fonts and spacing come from the theme's CSS variables, since each community has its own, and stage layouts and screens set their own scope.
  - Links are wouter's `Link` with HeroUI's `link` class, since HeroUI's `Link` doesn't route.
  - Comboboxes use `ComboBoxInput` and `FirstOptionSelected` from `src/client/ui/combobox.tsx`, so the first option stays selected and Enter picks it.
  - Icons come from Lucide (`lucide-react`): one before the text on every button, menu item, navigation link and layout choice, the same icon for the same action everywhere; icon-only buttons carry an `aria-label`, and their name in a `Tip` (`src/client/ui/tip.tsx`: hover, focus and long-press). Icons shared by several views (entry types, screen types, layouts, devices) are in `src/client/ui/icons.tsx`.
- Nothing jumps when a state changes (live, selected, focused, a label that changes, a line that may be empty): reserve the space with a transparent border, a fixed height, or both states stacked in one grid cell, and draw focus rings inside scrolling columns (`ring-inset`).
- No browser tooltips (`title` attributes): show the text where it's needed, or use a styled tooltip.
- Automate as much as is reasonable: every choice starts from a sensible default, so people do as little by hand as possible.
- Show the one way that fits the device and the moment, and the others a tap away: e.g. on a phone, logging in with Google first and email behind a link; a code to type only after "Can't scan?".
- Document-wide key listeners are added once (`useEffect(..., [])` calling a `useEffectEvent`), never re-added on every render: a key pressed between two renders, e.g. a clicker right after a live update, was lost.
- Views with several ways of use (controlling live, musicians, vocalists) offer named layouts per device type; add a layout to the view's list instead of branching inside one component.
- Every user-facing string goes through i18next (ro, uk, en).
- A view that shows data follows its changes without a reload (`live-updates` spec): give `useJson` the version `useChanges(slug, ...tables it shows)` from `src/client/data/changes.ts`; a form being typed in starts from the data once and keeps what's typed.
- Every view designs its empty, loading and error states (`app-shell` spec): empty states explain and offer the next step without looking like an error, placeholders show only after 300 ms, and audience screens never show spinners. The shared pieces are in `src/client/ui/states.tsx` (`Empty`, `Placeholder`, `ErrorNotice`, `usePending` and `ActionButton`), and `useJson` reports `failed` with a `retry`.
- Permissions follow the "Who can do what" matrix in the `members` spec; a change that adds an action adds its row there.
- Communities switch features on one by one (`feature-switches` spec): Classic's are always on, every other is off until an owner switches it on. Every new user-facing feature takes a key in `features` (`src/shared/features.ts`) with `added` (its day, so it's marked new), the feature it needs, its icon in `featureIcons` (`src/client/ui/icons.tsx`) and its branch in `branchOf` (`src/client/app/tree-layout.ts`); its entry points check it with `useShows()` or `<Shown>`. A planned feature in `planned` moves there once built.

## Data

- Every community-owned table has `community_id` (global tables such as `users` don't). Primary keys are 12-letter-and-digit ids from `newId()` in `src/server/ids.ts` (imported records get stable ones from `legacyId`), short in URLs. Synced tables have `updated_at` and `deleted_at`. Records store `created_by` and `updated_by`.
- Moments are UTC, stored and sent as ISO strings ending in `Z` (`toISOString()`), and local only on screen; a schedule's time of day and calendar dates are local, with the community's time zone (`database` spec).
- Until cutover from the old app, no backward compatibility: no legacy options, fallbacks for old values or migrations of local data; the development database is dropped and imported again.
- Rules live in code, not in the schema (`database` spec): migrations add no CHECK constraints or triggers (the search index is kept by `indexSongs`, which every write of a song's text calls); allowed values and ranges go in the route's schema or `src/shared`. A migration may rebuild any table: the runner turns foreign keys off around it and checks them before it commits.
- Terminology: **community** is the tenant, **language** is a language group (ro, uk, en). Never "congregation". Roles are **owner**, **editor** and **team** (operator and musician were merged into team).

## Public repo

- Never commit secrets, `.env` files, database files, dumps or user data.
