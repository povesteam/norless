# feedback Specification

## Purpose
Let members send ideas and feedback from inside Norless, and get them to the community's owners in one place, kept and answerable.

## Requirements

### Requirement: Send an idea or feedback

Every logged-in member, with any role or none, SHALL find "Ideas and feedback" in the menu, whatever is switched on. It SHALL open a text box (up to 5,000 characters) with Send and Cancel, and a choice of who it's for: the community's owners (the default), or the Norless app team. Sending an empty message SHALL NOT be possible. After sending, the member SHALL see a thank-you that says the owners will read it. Visitors who aren't logged in SHALL NOT see the entry, and the server SHALL refuse their messages. Owners SHALL find "Ideas and feedback" once in the menu: it opens their Ideas page, which has a Send an idea button that opens the same box.

#### Scenario: A singer suggests a feature
- **WHEN** a member without a role writes "Could the vocalists view show the next song's key?" and sends it
- **THEN** the message is stored and the member sees the thank-you

#### Scenario: Owner's menu
- **WHEN** an owner opens the menu
- **THEN** "Ideas and feedback" is listed once and opens the Ideas page, where Send an idea opens the text box

#### Scenario: Visitor
- **WHEN** a visitor who isn't logged in opens the menu
- **THEN** there is no "Ideas and feedback" entry, and a message sent to the API is refused

### Requirement: Messages reach the owners

Each message SHALL be stored with the sender, the time, the page they were on and their device type. When email is configured, each owner of the community SHALL get the message by email, with the sender's name in the subject and the sender's email as Reply-To. A failed email SHALL NOT lose the message or show an error to the sender.

#### Scenario: Answer from the inbox
- **WHEN** Ana sends an idea and Pavel, an owner, replies to the email
- **THEN** the reply goes to Ana's email address

#### Scenario: Email not set up yet
- **WHEN** a member sends feedback while email isn't configured
- **THEN** the message is stored and listed on the owners' Ideas page

### Requirement: Ideas for the Norless app team

The app team SHALL be the email addresses the server is set up with. An idea sent to them SHALL be kept, emailed to each of them with the sender as Reply-To, and listed on the app team's own Ideas page, with the community it came from, where they archive and restore ideas as owners do. The app team SHALL find that page in their account menu. Owners SHALL NOT see ideas sent to the app team, and nobody else SHALL see the app team's page.

#### Scenario: An idea for the app itself
- **WHEN** a member of Unu-Unu sends "a mode for concerts" to the Norless app team
- **THEN** the app team gets it by email and on their page, marked Unu-Unu, and Unu-Unu's owners don't

### Requirement: The owners' Ideas page

Owners SHALL have an Ideas page listing the messages, newest first, each with its text, sender, time, page and device type. An owner SHALL be able to archive a message; archived messages SHALL be hidden behind a "Show archived" switch, and can be restored. Nobody else SHALL see the page or the messages.

#### Scenario: Handled idea
- **WHEN** Pavel archives an idea he turned into an OpenSpec change
- **THEN** it leaves the list, and shows again with "Show archived"

#### Scenario: Team member
- **WHEN** a member with the team role opens the Ideas page's address
- **THEN** they are told it's for owners, and the server refuses the list
