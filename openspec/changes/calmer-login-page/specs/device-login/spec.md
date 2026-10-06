## MODIFIED Requirements

### Requirement: Log in with your phone

The login page SHALL offer "Log in with your phone": a QR code that works once, within 5 minutes; the short code to type SHALL show only on asking ("Can't scan?"), and a two-digit number to compare SHALL show once a phone opened the code. On a laptop it SHALL be the page's main way in, in a card in the middle of the window, without a Log in button in the page's header, with Google and the email link behind "Other ways to log in", which SHALL take the QR's place in the card, with "Log in with your phone" to bring the QR back; on a phone or tablet, Google SHALL come first (the email link where Google isn't set up), with the email link and logging in from another phone behind "Other ways to log in". A logged-in member who opens it on their phone SHALL see the same number, and choose "Log in as me", "As the community's laptop" or "As a guest musician". The laptop SHALL then be logged in without reloading. A code typed or scanned SHALL work only while its login page still shows it; a closed page's code SHALL be refused.

#### Scenario: Sunday morning
- **WHEN** Pavel scans the laptop's QR code with his phone, sees the same number and chooses "As the community's laptop"
- **THEN** the laptop opens Unu-Unu logged in as the community's laptop, without his Google account

#### Scenario: A closed login page
- **WHEN** someone types the code of a login page that was closed a minute ago
- **THEN** Norless says no device shows that code

#### Scenario: One way first
- **WHEN** someone opens the login page on a laptop
- **THEN** they see the QR code in a card in the middle, without the code, the number or an email field, and "Other ways to log in"

#### Scenario: Other ways on a laptop
- **WHEN** someone on a laptop chooses "Other ways to log in"
- **THEN** Google and the email link replace the QR in the card, all within the window, and "Log in with your phone" brings the QR back
