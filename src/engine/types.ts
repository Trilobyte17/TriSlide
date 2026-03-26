export type TileColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple';
export type Orientation = 'up' | 'down';
export type DiagonalType = 'sum' | 'diff';
export type SlideDirection = 'forward' | 'backward';
export type RowDirection = 'left' | 'right';

export interface Tile {
  id: string;
  color: TileColor;
  row: number;
  col: number;
  orientation: Orientation;
  isMatched: boolean;
}

export type GridRow = (Tile | null)[];
export type GridData = GridRow[];

export interface MatchResult {
  positions: Set<string>; // "r,c" keys
  count: number;
}

export interface GameResult {
  grid: GridData;
  scoreDelta: number;
  matchCount: number;
  hasMatches: boolean;
  isGameOver: boolean;
}

export const COLORS: TileColor[] = ['red', 'green', 'blue', 'yellow', 'purple'];
export const NUM_ROWS = 12;
export const NUM_COLS = 11;
export const MIN_MATCH = 3;
export const SCORE_PER_TILE = 10;
