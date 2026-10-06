# device-login Specification

## Purpose
Log a shared laptop, or a new device, into Norless from a phone that's already logged in, without typing a password on it.

## Requirements

### Requirement: Log in with your phone

The login page SHALL offer "Log in with your phone": a QR code that works once, within 5 minutes; the short code to type SHALL show only on asking ("Can't scan?"), and a two-digit number to compare SHALL show once a phone opened the code. On a laptop it SHALL be the page's main way in, in a card in the middle of the window, without a Log in button in the page's header, with Google and the email link behind "Other ways to log in"; on a phone or tablet, Google SHALL come first (the email link where Google isn't set up), with the email link and logging in from another phone behind "Other ways to log in". A logged-in member who opens it on their phone SHALL see the same number, and choose "Log in as me", "As the community's laptop" or "As a guest musician". The laptop SHALL then be logged in without reloading. A code typed or scanned SHALL work only while its login page still shows it; a closed page's code SHALL be refused.

#### Scenario: Sunday morning
- **WHEN** Pavel scans the laptop's QR code with his phone, sees the same number and chooses "As the community's laptop"
- **THEN** the laptop opens Unu-Unu logged in as the community's laptop, without his Google account

#### Scenario: A closed login page
- **WHEN** someone types the code of a login page that was closed a minute ago
- **THEN** Norless says no device shows that code

#### Scenario: One way first
- **WHEN** someone opens the login page on a laptop
- **THEN** they see the QR code in a card in the middle, without the code, the number or an email field, and "Other ways to log in"

### Requirement: The nearby offer

When a member of the team of the laptop's community has Norless open on a phone connected from the same internet address as the laptop's login page, the phone SHALL offer "Log in the laptop at <community>?" without scanning; reviewing it SHALL show the number on the phone and on the laptop, to compare. Elsewhere, the QR code SHALL still work.

#### Scenario: Church wifi
- **WHEN** the laptop opens the login page on the church wifi and Ioana's phone on the same wifi has Norless open
- **THEN** Ioana's phone offers to log the laptop in

### Requirement: Laptop sessions

A session "as the community's laptop" SHALL have the team role in that community only, whatever the approver's roles, and SHALL end when the laptop's browser closes, or after 12 hours. Its changes SHALL show in who did what as "Laptop (<approver>)". Any team member or owner SHALL be able to approve one, and end it from My account. A session "as me" SHALL be the member's own, like any login.

#### Scenario: A guest bass player
- **WHEN** Mihai scans the QR on Vlad's phone and chooses "As a guest musician" with the name Vlad
- **THEN** Vlad's phone has the team role for 4 hours, and his changes show "Vlad (guest of Mihai)"; Vlad could also scan a guest QR shown on Mihai's phone

#### Scenario: An editor approves the laptop
- **WHEN** Maria, editor and team, approves the laptop as the community's laptop
- **THEN** the laptop can control live and change playlists, but not edit songs, and its changes show "Laptop (Maria)"

### Requirement: Guest QR

A band member SHALL be able to show a QR on their phone that logs a guest musician's phone in for 4 hours, with the team role, named after the guest. The QR SHALL work for 5 minutes, and only for the first phone that opens it: another phone SHALL find it run out, and the first phone SHALL keep it across a reload. The band member's page SHALL follow the pass without a reload: once a phone opens it, the QR SHALL disappear and the page say it's waiting for the guest; once the guest logs in, the page SHALL say they're in and until when, and list them among the devices the member logged in; after 5 minutes unused, the page SHALL offer a new QR.

#### Scenario: Vlad scans Dan's QR
- **WHEN** Vlad's phone opens the QR shown on Dan's phone
- **THEN** the QR disappears from Dan's phone, which says it's waiting for Vlad to log in

#### Scenario: Someone else scans it too
- **WHEN** another phone opens the same QR after Vlad's
- **THEN** it finds the QR run out

#### Scenario: Vlad is in
- **WHEN** Vlad logs in
- **THEN** Dan's phone says "Vlad (guest of Dan) is in, until" a time 4 hours later, and lists Vlad among his devices
