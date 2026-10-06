## MODIFIED Requirements

### Requirement: Song revisions

Every save SHALL keep the previous version of the song's fields and texts, with who saved it and when, so versions can be compared later. Members SHALL see them in the song's history while the Chords mode is switched on (`chord-editing` spec); whatever is switched on, members see who added the song and who last edited it.

#### Scenario: Revision kept
- **WHEN** an editor fixes a word in verse 2 and saves
- **THEN** the text before the fix is still stored, with the editor's name and the time
