# Feedback design

Why ideas and feedback are kept in Norless and also emailed, and who sees them.

## Decisions

- **Stored first, then emailed**: the message is saved before anything is sent, so it isn't lost while email isn't set up or fails. The email goes out after the insert without the response waiting for it, and a failure shows the sender nothing. Owners also get one overview page, which email alone doesn't give.
- **Reply-To is the sender**: each message sets it, overriding the server's default, so an owner answers from their own inbox and no reply tool is needed. Owners get it by email each, read from their accounts at send time, so a changed address is picked up.
- **Members only**: the site is public, and a form open to visitors would attract spam, so the server refuses their messages. A member can send one message per community every 10 seconds, so a flood can't fill an inbox. The text is up to 5,000 characters.
- **To the owners or the app team, chosen by the sender**: the app team are the addresses in the server's `APP_TEAM_EMAILS`. They get ideas by email and read every community's on a page in their account menu, marked with its community. Owners never see those. One column (`sent_to`) tells the two apart.
- **Archive, not statuses**: one `archived_at`, with Restore, and no states, votes or comments. Owners decide what to build and answer by email.
- **Page and device type are kept** with each message, so an idea can be read where it was made.
- **Always available**: it is one of Classic's always-on features, so the team can say what they think from their first Sunday, whatever else is switched on.
- **A deleted account deletes its messages**: the sender is personal data.

## Rejected

- Email only: least code, but messages are lost until a sending key is set, and there is no overview.
- GitHub issues, by hand or automatic: the repository is public, members have no GitHub account, and messages may name people or church matters.
- WhatsApp: there is no free way to send into a chat.
- Visitors sending feedback: spam.
- Votes, comments, statuses or a public roadmap: owners decide and answer by email.
- Attachments and screenshots.
