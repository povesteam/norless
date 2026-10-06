# Design

## Decisions

- **Once per device, kept in the browser.** The person recording on a device is who must tell the room; a laptop that records every Sunday needn't ask every Sunday. Alternatives: every time (rejected by the maintainer as a click each service), or each member agreeing to be recorded on their account (the people recorded aren't all members).
- **Before the input, as the first step.** Record and the input's arrow both go through it, so nothing is asked of the browser (the microphone) before the person knows what recording means here.
- **"Continue", not "Start recording".** The input dialog that may follow already has Start recording; one name per action.
