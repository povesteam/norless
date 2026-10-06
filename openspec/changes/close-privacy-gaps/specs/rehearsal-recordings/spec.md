## MODIFIED Requirements

### Requirement: Who can listen

A recording SHALL belong to the member who made it, who can always play it; one made from a laptop or a guest's phone belongs to the member who logged that device in. Other members with the owner or team role SHALL see that it exists, with who made it, when, its length and its songs, and SHALL be able to ask for access. The member who made it SHALL see the requests in the app, and SHALL be able to grant or refuse each, and to withdraw access later. Only members with access SHALL be able to play or download it. When the member it belongs to deletes their account, the recording SHALL stay for the team: nothing SHALL link it to them any more (neither the member nor the device that recorded), and every member with the owner or team role SHALL be able to play and download it without asking.

#### Scenario: Ask for access
- **WHEN** the drummer asks for access to the guitarist's recording
- **THEN** the guitarist sees the request and can grant it
- **AND** after granting, the drummer can play the recording

#### Scenario: No access yet
- **WHEN** a member without access opens the recording
- **THEN** they see its songs and length, and a button to ask for access, but no playback

#### Scenario: The guitarist leaves
- **WHEN** the guitarist deletes their account
- **THEN** their recordings stay in the list without their name, and the drummer can play them without asking

### Requirement: Keep and delete

Recordings SHALL be kept until they are deleted. The member who made a recording and the community's owners SHALL be able to delete it, which SHALL remove its audio from the server; the owners SHALL be able to delete one whose maker deleted their account.

#### Scenario: Owner frees space
- **WHEN** an owner deletes a recording from last year
- **THEN** its audio is removed from the server, and it disappears from the list

#### Scenario: A recording nobody owns
- **WHEN** an owner deletes a recording whose maker deleted their account
- **THEN** its audio is removed from the server, and it disappears from the list
