## MODIFIED Requirements

### Requirement: Source code link

Every page, except screens, SHALL link to the source code and the license (AGPL-3.0-or-later), through About. If the running version differs from the public repository, the link SHALL lead to the running version's source. About, Privacy and Install SHALL be in the app's menus or on My account, never in a footer, so the app doesn't look like a website: on a laptop in My account's About tab, or for visitors in a small ⋯ menu beside Log in; on a phone in a community's menu, and in My account's About.

#### Scenario: A user asks for the source
- **WHEN** a member opens "About"
- **THEN** it shows the license and a link to the source code of the running version

#### Scenario: About on a phone
- **WHEN** a singer opens a playlist on a phone
- **THEN** About and Privacy are in the menu, and not at the bottom of the page

#### Scenario: About on a laptop
- **WHEN** a member opens a playlist on a laptop
- **THEN** the page has no footer, and About and Privacy are in My account's About tab, which their photo opens

#### Scenario: A visitor on a laptop
- **WHEN** a visitor opens a playlist on a laptop
- **THEN** About and Privacy are in the ⋯ menu beside Log in
