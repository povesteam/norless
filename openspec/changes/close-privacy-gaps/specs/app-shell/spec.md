## MODIFIED Requirements

### Requirement: Privacy notice

The app SHALL have a privacy page, linked from every page except screens, from the app's menus (`Source code link`). It SHALL say what personal data is stored (name, email, Google profile picture, sessions, who did what, usage, recordings, server logs, backups), why and on what legal basis, for how long, who is responsible, and how to get one's data or delete one's account. The responsible party SHALL be the community, set with its contact in the community settings (for Unu-Unu: the church). The notice SHALL also name the service operator, who processes the data on the community's behalf, and the services it uses (hosting, email, login with Google, the browsers' push services), and say what leaves the EU and under what safeguard. It SHALL name the rights to see, correct, delete and take one's data, to limit its use and to object to it, exercised by writing to the community, and the right to complain to the Romanian data protection authority (ANSPDCP); and it SHALL say that people under 16 join with a parent's or guardian's agreement. Every period it gives SHALL be what the server does: backups 14 days on the server, while the copies the operator pulls to their own computer are kept; server logs until they fill their size limit or a new version replaces the server's container. A member SHALL be able to delete their own account; their past contributions then stay without a name, their recordings stay for the team without a name (`rehearsal-recordings` spec), and the login links sent to their address are deleted. The app SHALL set only the cookies it needs to log people in (the session, and two short-lived ones while logging in with Google), each named on the page, so no cookie banner is needed.

#### Scenario: Member deletes their account
- **WHEN** a member deletes their account on My account
- **THEN** their email, name and picture are removed, and songs and playlists they added stay without a name
- **AND** the login links sent to their address are deleted, and their recordings stay for the team without their name

#### Scenario: How long backups last
- **WHEN** someone reads the privacy page
- **THEN** it says backups stay 14 days on the server and that the operator keeps the copies on their own computer

#### Scenario: Where to complain
- **WHEN** a member thinks their data is mishandled
- **THEN** the privacy page names their rights, the community's contact to write to, and ANSPDCP
