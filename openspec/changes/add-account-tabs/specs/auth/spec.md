## MODIFIED Requirements

### Requirement: Sessions

A session SHALL be kept in an HTTP-only, secure cookie. It SHALL last 30 days and be renewed while in use. A person SHALL be able to log out, and to log out of all their devices. The person's photo or initials in the bar SHALL open My account, in tabs with their own addresses (`/account/<tab>`), as Settings, a list of them on a phone: Profile (the photo, counting usage, deleting the account), Music, Logins, This device (the device type, offline songs) and About (the app team's pages, About, Privacy, Install); a laptop's or a guest's login SHALL have Logins and This device only. Logins SHALL list where the person is logged in, this device first, each other place by its browser and system ("Chrome on Android") and when it was last used, with Log out for each; the laptops and guests they logged in; logging in another device or a guest; and Log out. A session SHALL keep the browser it was used from and when it was last used, at most once an hour, and no location. Logging out and deleting one's account SHALL be on My account, so they aren't chosen by accident; Log out SHALL ask first, with a choice to log out on the other devices too.

#### Scenario: Operator laptop between Sundays
- **WHEN** the operator uses the laptop every Sunday
- **THEN** they stay logged in without logging in again

#### Scenario: Lost phone
- **WHEN** a member logs out with "Also on my other devices" ticked
- **THEN** all their sessions end

#### Scenario: Correcting the device type
- **WHEN** a member whose tablet was taken for a laptop taps their photo
- **THEN** My account opens, and This device lets them choose Tablet

#### Scenario: A phone left at a friend's
- **WHEN** a member opens Logins on their laptop and presses Log out beside "Chrome on Android, used yesterday"
- **THEN** the phone is logged out, and the laptop stays logged in
