export interface Tile {
  id: string;
  color: string;
  row: number;
  col: number;
  orientation: 'up' | 'down';
  isNew?: boolean;
  isMatched?: boolean;
}

export type GridRow = (Tile | null)[];
export type GridData = GridRow[];

export type DiagonalType = 'sum' | 'diff'; // 'sum' for r+c=k (like '/'), 'diff' for r-c=k (like '\')
export type SlideDirection = 'forward' | 'backward';


export interface GameState {
  grid: GridData;
  score: number;
  isGameOver: boolean;
  isGameStarted: boolean;
  isLoading: boolean;
}

export interface GridDimensions {
  rows: number;
  cols: number;
}

const TARGET_TILE_BASE_WIDTH = 40; 
const PRECISE_TILE_HEIGHT = (Math.sqrt(3) / 2) * TARGET_TILE_BASE_WIDTH;

export const GAME_SETTINGS = {
  GRID_WIDTH_TILES: 11, // Data array width, same as visual for this layout
  GRID_HEIGHT_TILES: 12, // Number of rows
  VISUAL_TILES_PER_ROW: 11, // Visual tiles in ALL rows for this layout
  MIN_MATCH_LENGTH: 3,
  COLORS: ['red', 'green', 'blue', 'yellow', 'purple'] as const,
  SCORE_PER_MATCHED_TILE: 10,
  SLIDE_ANIMATION_DURATION: 150, // ms
  MATCH_ANIMATION_DURATION: 300,
  SPAWN_ANIMATION_DURATION: 300,
  DRAG_THRESHOLD: TARGET_TILE_BASE_WIDTH / 3,
  TILE_BASE_WIDTH: TARGET_TILE_BASE_WIDTH,
  TILE_HEIGHT: PRECISE_TILE_HEIGHT,
  TILE_BORDER_WIDTH: 1,
  TILE_BORDER_COLOR_HSL: "0 0% 0%", // Black border
  getExpectedOrientation: (r: number, c: number): 'up' | 'down' => {
    if (r % 2 === 0) { // Even rows
      return c % 2 === 0 ? 'up' : 'down';
    } else { // Odd rows
      return c % 2 === 0 ? 'down' : 'up';
    }
  }
} as const;

export type TileColor = typeof GAME_SETTINGS.COLORS[number];

export const getTileColorStyle = (color: TileColor): { backgroundColor: string, color: string } => {
  const colorIndex = GAME_SETTINGS.COLORS.indexOf(color);
  const tileThemeVarIndex = colorIndex !== -1 ? colorIndex % GAME_SETTINGS.COLORS.length : 0;

  return {
    backgroundColor: `hsl(var(--tile-${tileThemeVarIndex}))`,
    color: `hsl(var(--tile-text))`
  };
};

export const getRandomColor = (): TileColor => {
  return GAME_SETTINGS.COLORS[Math.floor(Math.random() * GAME_SETTINGS.COLORS.length)];
};