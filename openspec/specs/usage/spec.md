# usage Specification

## Purpose
Know how the app is used, so unused or misused features stand out, without a tracker or third party.

## Requirements

### Requirement: Usage events

The app SHALL record an event each time a measured feature is used: how an entry or part went live (Go live, double-click, Enter, a part button, a clicker key, a key on the projector's window, a media key), which layout a view shows on which device type, a search and the result added from it, and an error notice shown. Each event SHALL have its time, community, device type, layout when there is one, and the member's id unless they switched counting off. Recording SHALL NOT slow down what was used, and SHALL never send events anywhere but Norless's own server.

#### Scenario: Double-click or the button
- **WHEN** the operator sends a song live with a double-click on Sunday
- **THEN** an event "live.go" with "via: double-click" is kept with the time, the community and "laptop"

#### Scenario: An error notice
- **WHEN** a save fails and a member sees "That didn't go through"
- **THEN** an "error.shown" event names the page it happened on

### Requirement: Counting can be switched off

My account SHALL have a switch "Help improve Norless: count how I use it", on by default. With it off, the member's events SHALL carry no member id. Deleting an account SHALL remove its id from every event it has. The privacy notice SHALL say what is counted, that the counts stay in Norless, and how to switch it off.

#### Scenario: Ana switches it off
- **WHEN** Ana switches counting off and then sends a song live
- **THEN** the event is kept without her id

### Requirement: The app team reads usage

Only the Norless app team SHALL see usage: a timeline per feature (per day or week, services marked), the events of one service in order, the ways nobody used in the last 30 days per community, leaving out the ways that only show with a feature it hasn't switched on, and a CSV export of the events. Owners and other members SHALL NOT see usage. Events SHALL be kept for good.

#### Scenario: Unused feature
- **WHEN** Unu-Unu has the laptop layouts switched on and nobody used the part buttons for 30 days
- **THEN** the app team's page lists the part buttons under the features not used there
