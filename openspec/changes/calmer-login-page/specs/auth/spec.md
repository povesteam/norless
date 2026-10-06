## MODIFIED Requirements

### Requirement: Login with Google

A person SHALL be able to log in with a Google account. The system SHALL use the verified email address from Google to identify them. The login page's Google button SHALL have Google's look. Where Google's sign-in script loads, the login page SHALL show Google's own button, with the person's Google name and photo when they signed in with Google here before, and on phones and tablets Google's One Tap prompt, alone: the button SHALL show only once the prompt is closed or doesn't come, in the space kept for it; a tap SHALL log in without leaving the page. Google's button SHALL sit on the page's own background, in dark mode too. The server SHALL accept Google's token only when Google signed it, for Norless's client, carrying the nonce this browser was given. Where the script doesn't load, the button SHALL go through Google's login page instead. Only the login page SHALL load anything from Google.

#### Scenario: First login with Google
- **WHEN** an invited person logs in with Google using the invited email address
- **THEN** they are logged in as a member with the invited role

#### Scenario: Continue as
- **WHEN** someone who logged in with Google before opens the login page on a phone with Chrome
- **THEN** Google offers "Continue as" with their name and photo, and one tap logs them in

#### Scenario: The prompt alone
- **WHEN** Google's One Tap prompt opens on a phone's login page
- **THEN** Google's button doesn't show behind it, and shows in its place once the prompt is closed

#### Scenario: A token from elsewhere
- **WHEN** a Google token issued for another site, or without this browser's nonce, is sent to Norless
- **THEN** it's refused and nobody is logged in
