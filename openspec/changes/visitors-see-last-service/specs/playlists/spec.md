## MODIFIED Requirements

### Requirement: Current playlist and permalinks

Every playlist SHALL have a permanent URL. Opening the app without a playlist URL SHALL open, for members, the playlist of the service under way or next (`service-schedule` spec), and for visitors the playlist of the service under way or, between services, of the last one held; without one, the most recently created playlist. The list of playlists SHALL be ordered newest first, each with how many songs it has and when it was created, said as such, and the playlist of the service under way or next SHALL be marked.

#### Scenario: Share a playlist link
- **WHEN** an operator copies the URL of a playlist and a musician opens it on a phone
- **THEN** the musician sees that playlist

#### Scenario: Default playlist
- **WHEN** a member of a community without a service schedule opens the app's home URL
- **THEN** the newest playlist is shown

#### Scenario: The next service's playlist first
- **WHEN** Sunday's playlist exists, someone creates another playlist on Wednesday, and a member opens the home URL
- **THEN** Sunday's playlist is shown, until Sunday's service ends

#### Scenario: A visitor between services
- **WHEN** Sunday's service has ended, next Sunday's playlist is being prepared, and a visitor opens the home URL on Wednesday
- **THEN** last Sunday's playlist is shown, while members see next Sunday's
