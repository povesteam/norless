## MODIFIED Requirements

### Requirement: Live chord

A team member SHALL be able to share the chord played with the other musicians from the musicians view: from a MIDI piano, from the mixer's input or from a microphone, until they stop or leave. When several devices share, members SHALL see the best source's chord: a MIDI piano, then the mixer, then a microphone, the latest among equals; a device that stops sending for 15 seconds stops counting. The musicians view SHALL offer a Live chord layout: the chord played now, big, in the color of its degree in the played key, with whose and what source it comes from, and the circle of fifths; with nobody sharing, it SHALL say how a team member shares. A practice room's chord SHALL be its own. The server SHALL refuse sharing from anyone but the team, and following from anyone but members.

#### Scenario: The piano wins
- **WHEN** a guitarist shares from a microphone and the pianist from a MIDI piano
- **THEN** musicians in the Live chord layout see the pianist's chord, marked as from the piano

#### Scenario: The pianist stops
- **WHEN** the pianist stops sharing
- **THEN** the layout shows the guitarist's microphone's chord
