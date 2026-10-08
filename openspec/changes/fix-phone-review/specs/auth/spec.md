## MODIFIED Requirements

### Requirement: Sessions

A session SHALL be kept in an HTTP-only, secure cookie. It SHALL last 30 days and be renewed while in use. A person SHALL be able to log out, and to log out of all their devices. The person's photo or initials in the bar SHALL open My account, which SHALL hold the device type in its This device section. Logging out and deleting one's account SHALL be on the My account page, so they aren't chosen by accident; Log out SHALL ask first, with a choice to log out on the other devices too.

#### Scenario: Operator laptop between Sundays
- **WHEN** the operator uses the laptop every Sunday
- **THEN** they stay logged in without logging in again

#### Scenario: Lost phone
- **WHEN** a member logs out with "Also on my other devices" ticked
- **THEN** all their sessions end

#### Scenario: Correcting the device type
- **WHEN** a member whose tablet was taken for a laptop taps their photo
- **THEN** My account opens, and This device lets them choose Tablet
