import type { GridData, Orientation, DiagonalType, SlideDirection, RowDirection, TileColor, MatchResult } from './types';
import { COLORS, MIN_MATCH, SCORE_PER_TILE } from './types';

// ─── Orientation ───────────────────────────────────────────────────────────────

export const getOrientation = (r: number, c: number): Orientation =>
  (r + c) % 2 === 0 ? 'up' : 'down';

// ─── Grid lifecycle ────────────────────────────────────────────────────────────

export const createGrid = (rows: number, cols: number): GridData =>
  Array.from({ length: rows }, () => Array(cols).fill(null));

let _id = 0;
const uid = (): string => `t${++_id}`;
const rngColor = (): TileColor =>
  COLORS[Math.floor(Math.random() * COLORS.length)];

export const fillGrid = (grid: GridData): GridData =>
  grid.map((row, r) =>
    row.map((_, c) => ({
      id: uid(),
      color: rngColor(),
      row: r, col: c,
      orientation: getOrientation(r, c) as Orientation,
      isMatched: false,
    }))
  );

export const cloneGrid = (grid: GridData): GridData =>
  grid.map(row => row.map(t => (t ? { ...t } : null)));

const nRows = (g: GridData) => g.length;
const nCols = (g: GridData) => g[0]?.length ?? 0;

// ─── Adjacency ────────────────────────────────────────────────────────────────

export const getNeighbors = (grid: GridData, r: number, c: number): { r: number; c: number }[] => {
  const rows = nRows(grid), cols = nCols(grid);
  const up = getOrientation(r, c) === 'up';
  const pts = [
    { r, c: c - 1 },
    { r, c: c + 1 },
    up ? { r: r + 1, c } : { r: r - 1, c },
  ];
  return pts.filter(({ r: nr, c: nc }) =>
    nr >= 0 && nr < rows && nc >= 0 && nc < cols
  );
};

// ─── Diagonal traversal ─────────────────────────────────────────────────────

const inBounds = (g: GridData, r: number, c: number) =>
  r >= 0 && r < nRows(g) && c >= 0 && c < nCols(g);

const stepDiag = (
  r: number, c: number,
  type: DiagonalType,
  dir: 'forward' | 'backward'
): { r: number; c: number } => {
  const up = getOrientation(r, c) === 'up';
  if (type === 'sum') {
    // `\` — alternates (r+1,c) and (r,c+1)
    if (dir === 'forward') return up ? { r: r + 1, c } : { r, c: c + 1 };
    return up ? { r, c: c - 1 } : { r: r - 1, c };
  }
  // `/` — alternates (r+1,c) and (r,c-1)
  if (dir === 'forward') return up ? { r: r + 1, c } : { r, c: c - 1 };
  return up ? { r, c: c + 1 } : { r: r - 1, c };
};

/**
 * Get all tile positions on a diagonal line through the grid.
 *
 * Walks geometric positions (including through null cells) but only
 * includes positions that have tiles. This correctly handles sparse rows
 * where the diagonal path passes through empty slots.
 *
 * `\` (sum) diagonal: geometric path alternates (r+1,c) and (r,c+1)
 * `/` (diff) diagonal: geometric path alternates (r+1,c) and (r,c-1)
 *
 * The returned array is ordered from "start of diagonal" to "end".
 */
export const getDiagonalLine = (
  grid: GridData,
  sr: number,
  sc: number,
  type: DiagonalType
): { r: number; c: number }[] => {
  const seen = new Set<string>();
  const line: { r: number; c: number }[] = [];

  // Forward walk (increasing row) — step through every position, include only tiles
  let fr = sr, fc = sc;
  while (inBounds(grid, fr, fc)) {
    const k = `${fr},${fc}`;
    if (!seen.has(k) && grid[fr]?.[fc] != null) {
      seen.add(k);
      line.push({ r: fr, c: fc });
    }
    ({ r: fr, c: fc } = stepDiag(fr, fc, type, 'forward'));
  }

  // Backward walk (decreasing row) — prepend tiles found going up-left
  let br = sr, bc = sc;
  ({ r: br, c: bc } = stepDiag(br, bc, type, 'backward'));
  while (inBounds(grid, br, bc)) {
    const k = `${br},${bc}`;
    if (!seen.has(k) && grid[br]?.[bc] != null) {
      seen.add(k);
      line.unshift({ r: br, c: bc });
    }
    ({ r: br, c: bc } = stepDiag(br, bc, type, 'backward'));
  }

  return line;
};

// ─── Matching ────────────────────────────────────────────────────────────────

export const findMatches = (grid: GridData): MatchResult => {
  const matched = new Set<string>();
  const visited = new Set<string>();
  const rows = nRows(grid), cols = nCols(grid);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const tile = grid[r]?.[c];
      if (!tile || visited.has(key)) continue;

      const comp: { r: number; c: number }[] = [];
      const queue = [{ r, c }];
      visited.add(key);

      while (queue.length) {
        const pos = queue.shift()!;
        comp.push(pos);
        for (const n of getNeighbors(grid, pos.r, pos.c)) {
          const nk = `${n.r},${n.c}`;
          if (visited.has(nk)) continue;
          const nt = grid[n.r]?.[n.c];
          if (nt && nt.color === tile.color) {
            visited.add(nk);
            queue.push(n);
          }
        }
      }

      if (comp.length >= MIN_MATCH)
        comp.forEach(p => matched.add(`${p.r},${p.c}`));
    }
  }

  return { positions: matched, count: matched.size };
};

// ─── Slides ─────────────────────────────────────────────────────────────────

export const slideRow = (
  grid: GridData,
  ri: number,
  dir: RowDirection
): GridData => {
  const newGrid = cloneGrid(grid);
  const row = newGrid[ri]!;

  // Collect non-null tiles with their column indices
  type Slot = { col: number; tile: NonNullable<typeof row[0]> };
  const slots: Slot[] = [];
  row.forEach((t, c) => { if (t !== null) slots.push({ col: c, tile: t }); });

  if (slots.length > 1) {
    const vals = slots.map(s => s.tile);
    // Rotate tile values: left=[a,b,c]→[b,c,a], right=[a,b,c]→[c,a,b]
    const rotated = dir === 'left'
      ? [...vals.slice(1), vals[0]]
      : [vals[vals.length - 1], ...vals.slice(0, -1)];
    slots.forEach((s, i) => {
      newGrid[ri]![s.col] = {
        ...rotated[i],
        row: ri, col: s.col,
        orientation: getOrientation(ri, s.col) as Orientation,
      };
    });
  }

  return newGrid;
};

export const slideDiagonal = (
  grid: GridData,
  coords: { r: number; c: number }[],
  dir: SlideDirection
): GridData => {
  if (coords.length < 2) return grid;
  const newGrid = cloneGrid(grid);

  // Snapshot tiles at each position
  const snap = coords.map(({ r, c }) =>
    grid[r]?.[c] ? { ...grid[r]![c]! } : null
  );
  const n = coords.length;
  // lineCoords = [backTiles..., start, forwardTiles...]
  // forward: each position gets the tile from the position BEFORE it → shift toward END
  // backward: each position gets the tile from the position AFTER it → shift toward START
  const off = dir === 'forward' ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const si = (i + off + n) % n;
    const { r, c } = coords[i];
    const src = snap[si];
    if (src) {
      newGrid[r]![c] = {
        ...src, row: r, col: c,
        orientation: getOrientation(r, c) as Orientation,
      };
    } else {
      newGrid[r]![c] = null;
    }
  }
  return newGrid;
};

// ─── Removal / gravity / spawn ─────────────────────────────────────────────────

export const removeMatched = (grid: GridData, positions: Set<string>): GridData =>
  grid.map(row =>
    row.map(t =>
      t && positions.has(`${t.row},${t.col}`) ? null
        : t ? { ...t, isMatched: false } : null
    )
  );

/**
 * Gravity: tiles fall down to fill empty slots below.
 * Uses a squeeze approach — writeRow tracks the next free slot from bottom.
 * Tiles maintain their relative order (first-tile-in-column lands at bottom).
 */
export const applyGravity = (grid: GridData): GridData => {
  const rows = nRows(grid), cols = nCols(grid);
  const out: GridData = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r]?.[c] != null) {
        const t = grid[r]![c]!;
        out[write]![c] = { ...t, row: write, orientation: getOrientation(write, c) as Orientation };
        write--;
      }
    }
  }
  return out;
};

export const spawnNewTiles = (grid: GridData): GridData => {
  const out = cloneGrid(grid);
  for (let r = 0; r < nRows(grid); r++)
    for (let c = 0; c < nCols(grid); c++)
      if (!out[r]![c])
        out[r]![c] = {
          id: uid(), color: rngColor(),
          row: r, col: c,
          orientation: getOrientation(r, c) as Orientation,
          isMatched: false,
        };
  return out;
};

// ─── Full move processor ──────────────────────────────────────────────────────

export const processMove = (
  grid: GridData,
  lineType: 'row' | DiagonalType,
  id: number | { r: number; c: number },
  dir: SlideDirection | RowDirection,
  steps = 1
): { grid: GridData; scoreDelta: number } => {
  let work = cloneGrid(grid);
  let delta = 0;

  for (let s = 0; s < Math.abs(steps); s++) {
    let after: GridData;
    if (lineType === 'row' && typeof id === 'number') {
      after = slideRow(work, id, dir as RowDirection);
    } else if (typeof id === 'object') {
      const line = getDiagonalLine(work, id.r, id.c, lineType as DiagonalType);
      after = slideDiagonal(work, line, dir as SlideDirection);
    } else {
      return { grid, scoreDelta: 0 };
    }
    if (findMatches(after).count === 0) return { grid, scoreDelta: 0 };
    work = after;
  }

  let loops = 0;
  while (true) {
    const { positions, count } = findMatches(work);
    if (count === 0) break;
    delta += count * SCORE_PER_TILE;
    work = removeMatched(work, positions);
    work = applyGravity(work);
    work = spawnNewTiles(work);
    if (++loops > 200) break;
  }

  return { grid: work, scoreDelta: delta };
};

// ─── Game over ────────────────────────────────────────────────────────────────

export const hasValidMove = (grid: GridData): boolean => {
  const rows = nRows(grid), cols = nCols(grid);
  const g = cloneGrid(grid);

  for (let r = 0; r < rows; r++) {
    if (findMatches(slideRow(g, r, 'left')).count > 0) return true;
    if (findMatches(slideRow(g, r, 'right')).count > 0) return true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!g[r]?.[c]) continue;
      for (const type of ['sum', 'diff'] as DiagonalType[]) {
        const line = getDiagonalLine(g, r, c, type);
        if (line.length < MIN_MATCH) continue;
        if (findMatches(slideDiagonal(cloneGrid(g), line, 'forward')).count > 0) return true;
        if (findMatches(slideDiagonal(cloneGrid(g), line, 'backward')).count > 0) return true;
      }
    }
  }

  return false;
};

export const isGameOver = (grid: GridData): boolean => !hasValidMove(grid);
