# host-view Specification

## Purpose
Give the host of a service their own words around each entry, in each language, and a view that follows the live entry with what comes next.

## Requirements

### Requirement: Host's words per entry

The team SHALL be able to write host's words on any playlist entry, one plain text of up to 2,000 characters per community language, from the entry's actions; empty texts SHALL be dropped. The server SHALL refuse them from anyone else and in a language the community doesn't have. They SHALL NOT be shown on screens, the stage monitor, prints or exports.

#### Scenario: Before the offering
- **WHEN** a team member writes "Acum strângem darurile" in Romanian and "Зараз збираємо пожертви" in Ukrainian on the divider "Colecta"
- **THEN** the divider keeps both, and the projectors don't show them

### Requirement: Host view

Members SHALL be able to open a Host view, linked as Host in the community's bar, that follows the live entry: its title and its host's words in large text, then the next entry's title and host's words, smaller. A switch SHALL show one of the community's languages or all of them; it SHALL start on the member's interface language when the community has it. With nothing live, it SHALL say so.

#### Scenario: Announcing the next song
- **WHEN** the reading is live and the next entry, "Har minunat", has host's words in both languages
- **THEN** the Host view shows the reading with its words, and "Next: Har minunat" with its words in the chosen language
