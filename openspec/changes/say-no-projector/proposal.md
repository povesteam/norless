# Proposal

## Why

On a laptop without a projector attached, "Projector RO" opened the projector full screen on the laptop's own display: a black window over the controller, with no word on why. Decided with the maintainer on 2026-10-06: say that no projector is attached, and let the operator open it anyway.

## What Changes

- Where the browser can tell there is one display (Chromium's `screen.isExtended`), a projector button opens a small message by it, "No projector is attached", with "Open anyway".
- "Open anyway", and any projector opened while only the laptop's display is known, opens in a window the operator moves, never full screen over the laptop.
- A projector window already open comes forward, as before, without the message.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `classic-layout`: Projecting from Classic says when no projector is attached.

## Impact

- `src/client/live/ClassicBottomBar.tsx` (the projector buttons), `src/client/live/windows.ts` (`oneDisplay`, `isOpen`, no full screen on the laptop's own display), the `classic` strings in en, ro and uk.
- A new e2e test in `e2e/projector-buttons.spec.ts`.
