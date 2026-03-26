# TriSlide — Spec

## Game

A match-3 puzzle game on a triangular lattice. The player slides rows or diagonals to connect 3+ adjacent tiles of the same color. Matched tiles are removed, gravity pulls tiles down, new tiles spawn at top. Game ends when no valid moves remain.

---

## Grid Geometry

### Coordinate System

- 2D array `GridData: (Tile | null)[][]`
- `NUM_ROWS = 12`, `NUM_COLS = 11`
- Each position `(r, c)` has a tile or `null`

### Triangle Orientation

```
orientation(r, c) = (r + c) % 2 === 0 ? 'up' : 'down'
```

- `'up'`: point faces up, flat base at bottom
- `'down'`: point faces down, flat base at top
- Adjacent tiles (sharing an edge) always have **opposite** orientations

### Visual Layout (CSS)

```
HALF_TILE = TILE_WIDTH / 2
TILE_HEIGHT = sqrt(3) / 2 * TILE_WIDTH

x(r, c) = c * HALF_TILE + (r % 2 === 1 ? HALF_TILE : 0) + BORDER
y(r, c) = r * TILE_HEIGHT + BORDER
```

Even rows start tiles at x=0. Odd rows are offset by HALF_TILE — this creates the tessellated triangular pattern.

### Adjacency (3 neighbors per tile)

**`'up'` at (r, c):**
- Left: `(r, c-1)`
- Right: `(r, c+1)`
- Below: `(r+1, c)`

**`'down'` at (r, c):**
- Left: `(r, c-1)`
- Right: `(r, c+1)`
- Above: `(r-1, c)`

### Diagonal Lines

**`\` (backslash) diagonal:** positions alternate `(r+1, c)`, `(r, c+1)` — a zigzag path through the lattice. All tiles on the same `\` diagonal share the same `r - c` parity pattern.

**`/` (forward slash) diagonal:** positions alternate `(r+1, c)`, `(r, c-1)` — the mirror image path.

---

## Core Engine API

```typescript
// Types
type TileColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple'
type DiagonalType = 'sum' | 'diff'  // 'sum' = '\', 'diff' = '/'
type SlideDirection = 'forward' | 'backward'
type RowDirection = 'left' | 'right'

interface Tile { id, color, row, col, orientation, isMatched }
type GridData = (Tile | null)[][]

// Grid lifecycle
initializeGrid(rows, cols): GridData
addInitialTiles(grid): GridData  // fills row 0 with random tiles
deepCloneGrid(grid): GridData

// Queries
getNeighbors(r, c): {r, c}[]
getTilesOnDiagonal(grid, startR, startC, type): {r, c}[]
findMatches(grid): { positions: Set<string>, count: number }
checkGameOver(grid): boolean

// Transformations
slideRow(grid, rowIndex, direction): GridData
slideDiagonal(grid, lineCoords, direction): GridData
removeMatchedTiles(grid): GridData
applyGravity(grid): GridData  // tiles fall down in their column
spawnNewTiles(grid): GridData  // fill empty top slots with new random tiles

// Game loop
processMove(grid, lineType, identifier, direction, steps): GridData
  // 1. Apply slide N times
  // 2. Find matches
  // 3. If no matches → return grid unchanged
  // 4. Remove matched, gravity, spawn
  // 5. Repeat until no matches
  // 6. Return final grid + score delta
```

---

## Slide Mechanics

### Row Slide
- Rotate all tiles in the row by 1 position in the direction of drag
- Wrapping: tiles slide off one end and appear at the other
- Orientation is recalculated for each tile's new position using `orientation(newR, newC)`

### Diagonal Slide
- Rotate tiles along the diagonal line by 1 position
- `lineCoords` = ordered list of all tiles on that diagonal (backward walk from start + start + forward walk from start)
- Forward: each position receives the tile from the previous position (shift toward end of array)
- Backward: each position receives the tile from the next position (shift toward start of array)
- Only committed if the slide creates at least one match

---

## Matching

- Use flood-fill BFS from each unmatched tile
- Check all 3 neighbors recursively for same color
- If connected component size >= 3 → all tiles in component are `isMatched`
- Process all matches simultaneously, then remove + gravity + spawn in one pass
- Chain reactions: after gravity + spawn, re-check for new matches

---

## Scoring

- `SCORE_PER_TILE = 10`
- Score delta = `matchedTiles * SCORE_PER_TILE`
- Chain bonus: each cascade level adds no additional multiplier (keep it simple)

---

## Drag Input

- Player drags on a tile
- Drag distance > threshold (TILE_WIDTH / 3) → lock axis
- Angle determines axis:
  - Row: drag along 0° (left/right)
  - `\` diagonal: drag at ~60°
  - `/` diagonal: drag at ~120°
- Snap-back: if release creates no match, tiles animate back to original positions

---

## Android / Capacitor

- PWA first: `npm run build` → static site
- Capacitor for Android: `npx cap add android`
- APK built with `npx cap build android`
- Target: Android 8.0+
- Store: F-Droid or direct APK download (avoid Play Store for now)

---

## Test Coverage

Engine (`engine.test.ts`) must have:
- [ ] `getNeighbors` for all 6 edge/corner cases
- [ ] `getTilesOnDiagonal` for both diagonal types, both directions
- [ ] Row slide left/right, including wrap-around
- [ ] Diagonal slide forward/backward, multi-step
- [ ] `findMatches` for: no match, single match, multiple disjoint matches, chain
- [ ] `removeMatchedTiles`
- [ ] `applyGravity`
- [ ] `spawnNewTiles`
- [ ] `processMove` full loop (slide → match → gravity → cascade)
- [ ] `checkGameOver` (no moves, one move available, many moves available)
