# live-updates Specification

## Purpose
Keep every open view in step with the data it shows, so nobody has to reload a page to see what others changed.

## Requirements

### Requirement: Open views follow changes

Every view that shows a community's data SHALL show changes to it made on other devices without a reload, within a few seconds: lists, counts, settings, a song's page, statistics, the change log, recordings and the screens. When the live connection comes back after a break, open views SHALL load their data again. A member whose roles change SHALL see the controls of their new roles without a reload. A form being filled in SHALL keep what was typed.

#### Scenario: A screen added elsewhere
- **WHEN** an owner adds a screen from her laptop while another owner has the screens settings open
- **THEN** the new screen appears in the other owner's list without a reload

#### Scenario: Back online
- **WHEN** a phone's connection drops for a minute, during which a playlist is renamed, and comes back
- **THEN** the phone shows the new name without a reload

#### Scenario: A new role
- **WHEN** an owner gives Ioana the editor role while Ioana has a song open
- **THEN** Ioana sees Edit song without a reload
