## MODIFIED Requirements

### Requirement: Keeping songs on a device

A member SHALL be able to switch on "Keep songs for offline" per device, in the This device section of My account, for the community the device opened last (named in the switch), off by default. While it's on and the device is online, the device SHALL keep every song as projectors read it and the 5 newest playlists, with the pages of their slides entries at the screens' size, the community's name and languages, and keep them again when songs or playlists change, at most every 10 minutes; it SHALL say how many songs it kept and when. It SHALL keep no names, emails, likes or history. Switching it off SHALL drop what was kept; without internet, it SHALL first warn that the songs can't be kept again until the internet is back. It SHALL be the feature `offline`, off until switched on.

#### Scenario: Kept before camp
- **WHEN** the operator switches on "Keep Unu-Unu's songs for offline" on My account on the laptop the evening before camp
- **THEN** the laptop says how many songs it kept, and keeps them again after an editor fixes a song

#### Scenario: Slides at camp
- **WHEN** a kept playlist has a slides entry with the camp's program, and the camp has no internet
- **THEN** the offline page projects its pages like songs

#### Scenario: Switched off at camp
- **WHEN** the operator switches "Keep songs for offline" off on a laptop with no internet
- **THEN** Norless warns that the kept songs can't come back until the internet does, and keeps them unless the operator confirms
