# Proposal

## Why

A recording records everyone in the room: the band, the singers, anyone near the microphone. Until now the only notice was the recording mark on the stage screens, once recording had started. Decided with the maintainer on 2026-10-06: the person recording is told, just before the first recording on a device, to let everyone know.

## What Changes

- The first time Record is pressed on a device (or its input chosen), a dialog says everyone in the room is recorded and to tell them first; Continue goes on to the input and the recording, Close records nothing.
- The device remembers it, so later recordings start at once.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rehearsal-recordings`: a notice before the first recording on a device.

## Impact

- `src/client/stage/Recorder.tsx` (`RecordButton`), the `recordings` strings in en, ro and uk, `e2e/files/recordings.spec.ts`.
