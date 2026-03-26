import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGrid,
  getOrientation,
  getNeighbors,
  getDiagonalLine,
  findMatches,
  slideRow,
  slideDiagonal,
  removeMatched,
  applyGravity,
  spawnNewTiles,
  processMove,
  isGameOver,
} from './engine';
import type { GridData, TileColor } from './types';

const R = 4, C = 5;
const COLORS: TileColor[] = ['red', 'green', 'blue', 'yellow', 'purple'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mk = (): GridData => createGrid(R, C);

const tile = (color: string, r: number, c: number) => ({
  id: `${color}${r}${c}`,
  color: color as TileColor,
  row: r, col: c,
  orientation: getOrientation(r, c) as any,
  isMatched: false,
});

const T = (g: GridData, color: string, r: number, c: number): void => {
  g[r]![c] = tile(color, r, c) as any;
};

// ─── Orientation ───────────────────────────────────────────────────────────────

describe('getOrientation', () => {
  // (r+c) % 2 === 0 → 'up', else → 'down'
  it('(r+c) even → up, odd → down', () => {
    expect(getOrientation(0, 0)).toBe('up');   // 0 even
    expect(getOrientation(0, 1)).toBe('down'); // 1 odd
    expect(getOrientation(1, 0)).toBe('down'); // 1 odd
    expect(getOrientation(1, 1)).toBe('up');   // 2 even
    expect(getOrientation(2, 0)).toBe('up');   // 2 even ← was failing
    expect(getOrientation(2, 1)).toBe('down'); // 3 odd
  });
});

// ─── getNeighbors ─────────────────────────────────────────────────────────────

describe('getNeighbors', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('interior up-tile has 3 neighbors', () => {
    // (1,1): 1+1=2 even → up. neighbors: left (1,0), right (1,2), below (2,1)
    T(g, 'x', 1, 1); T(g, 'x', 1, 0); T(g, 'x', 1, 2); T(g, 'x', 2, 1);
    expect(getNeighbors(g, 1, 1)).toHaveLength(3);
    expect(getNeighbors(g, 1, 1)).toContainEqual({ r: 1, c: 0 });
    expect(getNeighbors(g, 1, 1)).toContainEqual({ r: 2, c: 1 });
  });

  it('interior down-tile has 3 neighbors', () => {
    // (1,2): 1+2=3 odd → down. neighbors: left (1,1), right (1,3), above (0,2)
    T(g, 'x', 1, 2); T(g, 'x', 1, 1); T(g, 'x', 1, 3); T(g, 'x', 0, 2);
    expect(getNeighbors(g, 1, 2)).toHaveLength(3);
    expect(getNeighbors(g, 1, 2)).toContainEqual({ r: 0, c: 2 }); // above
  });

  it('corner has 2 neighbors', () => {
    T(g, 'x', 0, 0); T(g, 'x', 0, 1); T(g, 'x', 1, 0);
    expect(getNeighbors(g, 0, 0)).toHaveLength(2);
  });
});

// ─── getDiagonalLine ─────────────────────────────────────────────────────────

describe('getDiagonalLine', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('\\ diagonal through (0,0): all tiles on that geometric line', () => {
    // Geometric \ diagonal passes through (0,0),(1,0),(1,1),(2,1),(2,2)
    T(g, 'a', 0, 0); T(g, 'a', 1, 0); T(g, 'a', 1, 1); T(g, 'a', 2, 1); T(g, 'a', 2, 2);
    const line = getDiagonalLine(g, 0, 0, 'sum');
    const keys = new Set(line.map(p => `${p.r},${p.c}`));
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('1,0')).toBe(true);
    expect(keys.has('1,1')).toBe(true);
    expect(keys.has('2,1')).toBe(true);
    expect(keys.has('2,2')).toBe(true);
  });

  it('/ diagonal through (0,4): zigzag path', () => {
    // Geometric / diagonal at (r+c)=4: (0,4),(1,3),(2,2),(3,1) in 4×5 grid
    T(g, 'b', 0, 4); T(g, 'b', 1, 3); T(g, 'b', 2, 2); T(g, 'b', 3, 1);
    const line = getDiagonalLine(g, 0, 4, 'diff');
    const keys = new Set(line.map(p => `${p.r},${p.c}`));
    expect(keys.has('0,4')).toBe(true);
    expect(keys.has('1,3')).toBe(true);
    expect(keys.has('2,2')).toBe(true);
    expect(keys.has('3,1')).toBe(true);
  });

  it('starting from middle tile returns same full line', () => {
    T(g, 'c', 0, 0); T(g, 'c', 1, 0); T(g, 'c', 1, 1); T(g, 'c', 2, 1); T(g, 'c', 2, 2);
    const fromStart = getDiagonalLine(g, 0, 0, 'sum');
    const fromMiddle = getDiagonalLine(g, 1, 1, 'sum');
    expect(fromMiddle.length).toBe(fromStart.length);
  });
});

// ─── findMatches ───────────────────────────────────────────────────────────────

describe('findMatches', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('no matches when all colors differ', () => {
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        T(g, COLORS[(r + c) % COLORS.length], r, c);
    expect(findMatches(g).count).toBe(0);
  });

  it('horizontal row of 3 → match', () => {
    T(g, 'red', 0, 0); T(g, 'red', 0, 1); T(g, 'red', 0, 2);
    const { count, positions } = findMatches(g);
    expect(count).toBe(3);
    expect(positions.has('0,0')).toBe(true);
    expect(positions.has('0,1')).toBe(true);
    expect(positions.has('0,2')).toBe(true);
  });

  it('connected component of 3 → match via flood-fill', () => {
    // (0,0) up neighbors: (0,1) right, (1,0) below
    // (0,1) down neighbors: (0,0) left, (0,2) right, (-1,1) invalid
    // (0,2) up neighbors: (0,1) left, (0,3) right, (1,2) below
    // Three reds in a horizontal row: all adjacent → match
    T(g, 'red', 0, 0); T(g, 'red', 0, 1); T(g, 'red', 0, 2);
    expect(findMatches(g).count).toBe(3);
  });

  it('two disjoint groups of 3 → count 6', () => {
    T(g, 'red', 0, 0); T(g, 'red', 0, 1); T(g, 'red', 0, 2);
    T(g, 'blue', 2, 0); T(g, 'blue', 2, 1); T(g, 'blue', 2, 2);
    expect(findMatches(g).count).toBe(6);
  });

  it('2 tiles of same color → no match (need 3+)', () => {
    T(g, 'red', 0, 0); T(g, 'red', 0, 1);
    expect(findMatches(g).count).toBe(0);
  });

  it('only same-color tiles match, not different colors', () => {
    T(g, 'red', 0, 0); T(g, 'red', 0, 1); T(g, 'blue', 0, 2);
    expect(findMatches(g).count).toBe(0);
  });
});

// ─── slideRow ─────────────────────────────────────────────────────────────────

describe('slideRow', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('left: tiles shift left, last wraps to first', () => {
    // Row 0 has 5 slots (C=5), fill all 5
    T(g, 'a', 0, 0); T(g, 'b', 0, 1); T(g, 'c', 0, 2); T(g, 'd', 0, 3); T(g, 'e', 0, 4);
    const r = slideRow(g, 0, 'left');
    expect(r[0]![0]!.color).toBe('b');
    expect(r[0]![1]!.color).toBe('c');
    expect(r[0]![2]!.color).toBe('d');
    expect(r[0]![3]!.color).toBe('e');
    expect(r[0]![4]!.color).toBe('a');
  });

  it('right: tiles shift right, first wraps to last', () => {
    T(g, 'a', 0, 0); T(g, 'b', 0, 1); T(g, 'c', 0, 2);
    const r = slideRow(g, 0, 'right');
    expect(r[0]![0]!.color).toBe('c');
    expect(r[0]![1]!.color).toBe('a');
    expect(r[0]![2]!.color).toBe('b');
  });

  it('recalculates orientation at new position', () => {
    // Row 0: (0,0)='up', (0,1)='down', (0,2)='up'
    T(g, 'a', 0, 0); T(g, 'b', 0, 1); T(g, 'c', 0, 2);
    const r = slideRow(g, 0, 'right');
    // After right: (0,0)←c('up' at 0,2), (0,1)←a('up' at 0,0), (0,2)←b('down' at 0,1)
    // (0,0)='up' → c's orientation stays 'up'
    // (0,1)='down' → a's orientation changes from 'up'→'down'
    // (0,2)='up' → b's orientation stays 'down'... wait
    // b was at (0,1)='down', moves to (0,2)='up' → should change to 'up'
    expect(r[0]![0]!.orientation).toBe('up');   // c was 'up' at (0,2), now at (0,0)='up' ✓
    expect(r[0]![1]!.orientation).toBe('down'); // a was 'up' at (0,0), now at (0,1)='down' ← WRONG, test fails
    // Actually: a was at (0,0)='up'. After right shift, a goes to (0,1).
    // (0,1)='down'. So a's orientation should be 'down'. Test expects 'down'. ✓
    // b was at (0,1)='down'. After right shift, b goes to (0,2).
    // (0,2)='up'. So b's orientation should be 'up'. ✓
    expect(r[0]![2]!.orientation).toBe('up');
  });
});

// ─── slideDiagonal ────────────────────────────────────────────────────────────

describe('slideDiagonal', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('forward: each position gets tile from previous position in line', () => {
    // \ diagonal (0,0),(1,0),(1,1),(2,1),(2,2)
    T(g, 'a', 0, 0); T(g, 'b', 1, 0); T(g, 'c', 1, 1); T(g, 'd', 2, 1); T(g, 'e', 2, 2);
    const line = getDiagonalLine(g, 0, 0, 'sum');
    const r = slideDiagonal(g, line, 'forward');
    // Forward (offset=1): pos[i] ← pos[i-1]
    // (0,0)←(2,2)=e, (1,0)←(0,0)=a, (1,1)←(1,0)=b, (2,1)←(1,1)=c, (2,2)←(2,1)=d
    expect(r[0]![0]!.color).toBe('e');
    expect(r[1]![0]!.color).toBe('a');
    expect(r[1]![1]!.color).toBe('b');
    expect(r[2]![1]!.color).toBe('c');
    expect(r[2]![2]!.color).toBe('d');
  });

  it('backward: each position gets tile from next position in line', () => {
    T(g, 'a', 0, 0); T(g, 'b', 1, 0); T(g, 'c', 1, 1); T(g, 'd', 2, 1); T(g, 'e', 2, 2);
    const line = getDiagonalLine(g, 0, 0, 'sum');
    const r = slideDiagonal(g, line, 'backward');
    // Backward (offset=-1): pos[i] ← pos[i+1]
    // (0,0)←(1,0)=b, (1,0)←(1,1)=c, (1,1)←(2,1)=d, (2,1)←(2,2)=e, (2,2)←(0,0)=a
    expect(r[0]![0]!.color).toBe('b');
    expect(r[1]![0]!.color).toBe('c');
    expect(r[1]![1]!.color).toBe('d');
    expect(r[2]![1]!.color).toBe('e');
    expect(r[2]![2]!.color).toBe('a');
  });

  it('orientation recalculates at new diagonal position', () => {
    // (0,0)='up', (1,0)='down', (1,1)='up'
    T(g, 'a', 0, 0); T(g, 'b', 1, 0); T(g, 'c', 1, 1);
    const line = getDiagonalLine(g, 0, 0, 'sum');
    const r = slideDiagonal(g, line, 'forward');
    // c was at (1,1)='up', moves to (0,0)='up' → stays 'up' ✓
    expect(r[0]![0]!.orientation).toBe('up');
  });
});

// ─── applyGravity + spawnNewTiles ─────────────────────────────────────────────

describe('applyGravity', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('tiles fall to fill empty slots below', () => {
    // Column 0: row0=red, row2=blue, rows1,3=null
    T(g, 'red', 0, 0); T(g, 'blue', 2, 0);
    const r = applyGravity(g);
    // Squeeze: r=3='blue'→place at write=3→write=2; r=2='red'→place at write=2→write=1
    // Result: row2=red, row3=blue (order preserved, blue ends at bottom)
    expect(r[2]![0]!.color).toBe('red');
    expect(r[3]![0]!.color).toBe('blue');
  });

  it('squeezes tiles to bottom, preserving insertion order (first-touched lands at bottom)', () => {
    // Tiles in rows: 3='bot', 1='mid', 0='top'. Squeeze from bottom:
    // r=3: place bot at row3, write=2; r=1: place mid at row2, write=1; r=0: place top at row1
    T(g, 'top', 0, 0); T(g, 'mid', 1, 0); T(g, 'bot', 3, 0);
    const r = applyGravity(g);
    expect(r[3]![0]!.color).toBe('bot');  // first-touched (row3) ends at bottom
    expect(r[2]![0]!.color).toBe('mid');
    expect(r[1]![0]!.color).toBe('top');
  });

  it('orientation updates to match new row', () => {
    // (0,0)='up' falls to bottom row 3: (3,0)='down'
    T(g, 'x', 0, 0);
    const r = applyGravity(g);
    expect(r[3]![0]!.orientation).toBe('down');
  });
});

describe('spawnNewTiles', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('fills all nulls with new random tiles', () => {
    T(g, 'orig', 2, 0);
    const r = spawnNewTiles(g);
    expect(r[0]![0]).not.toBeNull();
    expect(r[1]![0]).not.toBeNull();
    expect(r[2]![0]!.color).toBe('orig'); // existing preserved
  });
});

// ─── processMove ──────────────────────────────────────────────────────────────

describe('processMove', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('slide that creates no match → grid unchanged, zero score', () => {
    // Heterogeneous row — no 3-in-a-row possible
    T(g, 'red', 0, 0); T(g, 'blue', 0, 1); T(g, 'green', 0, 2); T(g, 'yellow', 0, 3); T(g, 'purple', 0, 4);
    const { grid: result, scoreDelta } = processMove(g, 'row', 0, 'left', 1);
    expect(scoreDelta).toBe(0);
    // Grid should be unchanged
    expect(result[0]![0]!.color).toBe('red');
    expect(result[0]![1]!.color).toBe('blue');
  });

  it('slide that creates match → removes tiles + cascade + score', () => {
    // 3 red tiles at col 0,1,2 — sliding left keeps them at 0,1,2 → match
    T(g, 'red', 0, 0); T(g, 'red', 0, 1); T(g, 'red', 0, 2);
    T(g, 'blue', 1, 0); // below, not part of match
    const { grid: result, scoreDelta } = processMove(g, 'row', 0, 'left', 1);
    expect(scoreDelta).toBeGreaterThan(0);
    // After removal+cascade, the board should have no active matches
    expect(findMatches(result).count).toBe(0);
  });
});

// ─── isGameOver ─────────────────────────────────────────────────────────────

describe('isGameOver', () => {
  let g: GridData;
  beforeEach(() => { g = mk(); });

  it('true when no three-in-a-row exists anywhere', () => {
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        T(g, COLORS[(r + c) % COLORS.length], r, c);
    expect(isGameOver(g)).toBe(true);
  });

  it('false when a row slide creates a match', () => {
    // Row 0 has 3 reds
    T(g, 'red', 0, 0); T(g, 'red', 0, 1); T(g, 'red', 0, 2);
    for (let r = 1; r < R; r++)
      for (let c = 0; c < C; c++)
        T(g, COLORS[(r + c + 1) % COLORS.length], r, c);
    expect(isGameOver(g)).toBe(false);
  });
});
