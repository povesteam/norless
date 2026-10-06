# Design

## Decisions

- **`screen.isExtended` tells, without asking.** Chromium reports whether there's more than one display without the window-management permission; elsewhere it's undefined, and the button opens the window as before, since nothing can tell.
- **The message is a popover on the button.** It points at what was pressed, closes on Esc or a click elsewhere, and needs no new place on the page. Alternative: a toast, rejected as far from the button and easy to miss.
- **No full screen on the laptop's own display.** Without a display that isn't the laptop's (or one chosen before), the projector opens as a window: full screen there covered the controller, the very thing the operator needs.
