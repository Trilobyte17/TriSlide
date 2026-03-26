# TriSlide — Next Milestone

## Current milestone
Playable MVP

## Definition of forward progress
A task only counts as progress if it lands in git as a commit or identifies a concrete blocker.

Every status update must include:
- latest commit SHA
- what was completed
- blocker, if any
- next bounded step

No vague "still working on it" updates.

## Acceptance criteria for MVP
- playable board renders correctly
- drag input reliably triggers row and diagonal moves
- score updates from real engine results
- matches and cascades are visible to the player
- no-moves / game-over state is visible and restart works
- one runnable build target exists

## Current known good state
- latest landed commit: `cbaef6a`
- engine tests: `27/27` passing
- playable canvas prototype exists
- no new landed work beyond `cbaef6a`

## Next 3 tasks only
1. Land move + cascade animation in the canvas renderer
   - done when player can visually follow slide, match, clear, gravity, and refill
2. Fix hit-testing / drag reliability
   - done when row, `\\`, and `/` gestures consistently target the intended line
3. Finish MVP shell polish
   - no-moves / game-over overlay, restart/new game flow, clear status feedback

## Blocked / unblocked
- currently unblocked
- if no commit lands after a work block, report that explicitly instead of implying progress

## Status update rule
Send updates only when one of these is true:
1. a commit lands
2. blocked for more than 30 minutes
3. a decision is needed from Greg

## Immediate next bounded step
Implement move + cascade animation and do not report success until it lands in a commit.
