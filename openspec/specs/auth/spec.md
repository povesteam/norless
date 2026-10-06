# auth Specification

## Purpose
Let people log in without passwords, with Google or an email link, and keep them logged in safely across services on shared church devices and personal phones.

## Requirements

### Requirement: Login with Google

A person SHALL be able to log in with a Google account. The system SHALL use the verified email address from Google to identify them. The login page's Google button SHALL have Google's look. Where Google's sign-in script loads, the login page SHALL show Google's own button, with the person's Google name and photo when they signed in with Google here before, and on phones and tablets Google's One Tap prompt; a tap SHALL log in without leaving the page. The server SHALL accept Google's token only when Google signed it, for Norless's client, carrying the nonce this browser was given. Where the script doesn't load, the button SHALL go through Google's login page instead. Only the login page SHALL load anything from Google.

#### Scenario: First login with Google
- **WHEN** an invited person logs in with Google using the invited email address
- **THEN** they are logged in as a member with the invited role

#### Scenario: Continue as
- **WHEN** someone who logged in with Google before opens the login page on a phone with Chrome
- **THEN** Google offers "Continue as" with their name and photo, and one tap logs them in

#### Scenario: A token from elsewhere
- **WHEN** a Google token issued for another site, or without this browser's nonce, is sent to Norless
- **THEN** it's refused and nobody is logged in

### Requirement: Login with an email link

A person SHALL be able to request a login link by email. The link SHALL be single-use and SHALL expire after 15 minutes. Requesting a link SHALL NOT reveal whether the email address belongs to a member.

#### Scenario: Link used twice
- **WHEN** a person opens a login link a second time
- **THEN** they are told the link has expired and can request a new one

#### Scenario: Unknown email
- **WHEN** someone requests a link for an address that isn't a member
- **THEN** they see the same "check your email" message as a member would

### Requirement: Sessions

A session SHALL be kept in an HTTP-only, secure cookie. It SHALL last 30 days and be renewed while in use. A person SHALL be able to log out, and to log out of all their devices. The account menu SHALL have My account and the device type. Logging out and deleting one's account SHALL be on the My account page, so they aren't chosen by accident; Log out SHALL ask first, with a choice to log out on the other devices too.

#### Scenario: Operator laptop between Sundays
- **WHEN** the operator uses the laptop every Sunday
- **THEN** they stay logged in without logging in again

#### Scenario: Lost phone
- **WHEN** a member logs out with "Also on my other devices" ticked
- **THEN** all their sessions end

### Requirement: Logged-in non-members

A person who logs in but isn't a member and has no pending invitation SHALL get the same public access as a visitor who isn't logged in, plus a note that they need an invitation to edit or control.

#### Scenario: Stranger logs in with Google
- **WHEN** someone who isn't invited logs in with Google
- **THEN** they can read songs and playlists as any visitor can, and see "ask your community for an invitation to edit"

### Requirement: Development login

When started with `DEV_LOGIN=1`, the server SHALL let anyone log in with any email address without verifying it, for development and automated tests. The login page SHALL look as in production, with stand-ins: asking for an email link SHALL show, on the page and marked as development, the link the email would carry; Google SHALL open a pretend account chooser, marked as development, listing the accounts and taking any address. The server SHALL refuse to start with `DEV_LOGIN=1` when `NODE_ENV` is `production`.

#### Scenario: Developer logs in as the owner
- **WHEN** a developer runs the app with `DEV_LOGIN=1` and logs in as an invited owner's email
- **THEN** they are logged in as that owner

#### Scenario: Never in production
- **WHEN** the server starts with `DEV_LOGIN=1` and `NODE_ENV=production`
- **THEN** it exits with an error instead of serving

#### Scenario: The pretend Google
- **WHEN** a developer without Google set up taps Continue with Google and picks Ana
- **THEN** they are logged in as Ana, after a page that says it isn't Google
