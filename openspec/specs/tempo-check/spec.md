# tempo-check Specification

## Purpose
Tell the band, quietly, when they drift clearly faster or slower than a song's target tempo, since they play without a click.

## Requirements

### Requirement: Target tempo per song

A song SHALL be able to have a target tempo in beats per minute, typed or tapped by a team member, an editor or an owner (built with chord editing). The song page SHALL suggest the median of the song's last three tempo checks when it differs from the target by 2 BPM or more, which they can accept.

#### Scenario: Accept a measured tempo
- **WHEN** the last three checks of a song measured about 70 BPM and its target is 76
- **THEN** the song page suggests 70, and the target stays 76 until someone accepts it

### Requirement: Listening device and input

Each room SHALL be able to have one listening device, switched on by a member of the team from the live bar or the musicians view, while its feature (`tempoCheck`) is switched on, which uses either its microphone or a chosen audio input, such as a feed from the mixer. The input SHALL be asked for the first time on a device and remembered there; a small arrow beside the button SHALL open the choice again. Switching it on on another device SHALL take over. While it listens, the button SHALL show a small level of what the input hears and the tempo it detects, also while no song with a target tempo is live. The audio SHALL be analyzed on that device and SHALL NOT be uploaded for this feature. A reading of half or double the target tempo SHALL count as the target's.

#### Scenario: Mixer feed
- **WHEN** the operator connects the mixer's USB audio to the laptop and picks the kick channel as the input
- **THEN** the laptop listens to the kick channel while songs are live

#### Scenario: The input once
- **WHEN** the operator chose the mixer's input last Sunday and taps Listen for tempo today
- **THEN** the laptop listens to the mixer's input at once, without asking

#### Scenario: See that it hears
- **WHEN** the laptop listens while the band plays at 72 BPM between songs
- **THEN** the button's level moves with the music and it shows about 72 BPM

### Requirement: Drift hint on stage

While a song with a target tempo is live, the listening device SHALL measure the band's tempo. When the measured tempo stays more than 4% faster or slower than the target for 8 seconds (owners SHALL be able to change both numbers in the community settings), every stage monitor and musicians layout in the room SHALL show "speeding up" or "dragging", with the measured and the target tempo. The hint SHALL disappear once the tempo is back within 4%. Nothing SHALL be shown for songs without a target tempo, while the input is silent, or on projector screens and the broadcast overlay.

#### Scenario: The band speeds up
- **WHEN** a song's target is 72 BPM and the band plays at 77 for 10 seconds
- **THEN** the stage monitor shows "speeding up · 77 → 72"

#### Scenario: A short push doesn't count
- **WHEN** the band plays 6% faster for 4 seconds during a build-up and then settles
- **THEN** no hint is shown

#### Scenario: Song without a target
- **WHEN** a song without a target tempo is live
- **THEN** no tempo hint is shown
