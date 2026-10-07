## MODIFIED Requirements

### Requirement: Login with Google

A person SHALL be able to log in with a Google account. The system SHALL use the verified email address from Google to identify them. The login page's Google button SHALL have Google's look, and the login page SHALL load nothing from Google until it's pressed. Pressed, the button SHALL show that it's loading until Google's prompt or page comes, and Google's sign-in script SHALL open its "Continue as" prompt on the page, and a tap SHALL log in without leaving the page. The server SHALL accept Google's token only when Google signed it, for Norless's client, carrying the nonce this browser was given. Where the script doesn't load, or its prompt is closed or doesn't come, the button SHALL go through Google's login page instead. Only the login page SHALL load anything from Google.

#### Scenario: First login with Google
- **WHEN** an invited person logs in with Google using the invited email address
- **THEN** they are logged in as a member with the invited role

#### Scenario: Continue as
- **WHEN** someone who logged in with Google before presses "Continue with Google" on a phone with Chrome
- **THEN** Google offers "Continue as" with their name and photo, and one tap logs them in

#### Scenario: Waiting for Google
- **WHEN** someone presses "Continue with Google" on a phone on a slow connection
- **THEN** the button shows that it's loading until Google's card appears

#### Scenario: Nothing from Google before choosing it
- **WHEN** someone opens the login page
- **THEN** nothing is loaded from Google, and no cookie is set for it, until they press "Continue with Google"

#### Scenario: A token from elsewhere
- **WHEN** a Google token issued for another site, or without this browser's nonce, is sent to Norless
- **THEN** it's refused and nobody is logged in
