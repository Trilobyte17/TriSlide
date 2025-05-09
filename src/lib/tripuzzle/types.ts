
export interface Tile {
  id: string;
  color: string; 
  row: number;
  col: number;
  orientation: 'up' | 'down'; // Added to define triangle orientation
  isNew?: boolean; 
  isMatched?: boolean;
  isSelected?: boolean; // Added for UI indication of selected tile
}

export type GridRow = (Tile | null)[];
export type GridData = GridRow[];

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
// Precise height for an equilateral triangle based on its base width
const PRECISE_TILE_HEIGHT = (Math.sqrt(3) / 2) * TARGET_TILE_BASE_WIDTH;

export const GAME_SETTINGS = {
  GRID_WIDTH_TILES: 11, 
  GRID_HEIGHT_TILES: 8,  
  MIN_MATCH_LENGTH: 3,
  COLORS: ['red', 'green', 'blue', 'yellow', 'purple'] as const, 
  SCORE_PER_MATCHED_TILE: 10,
  SLIDE_ANIMATION_DURATION: 200, // ms
  MATCH_ANIMATION_DURATION: 300, // ms
  SPAWN_ANIMATION_DURATION: 300, // ms
  SWAP_ANIMATION_DURATION: 150, // ms for tile swap visual
  TRIAD_ROTATE_ANIMATION_DURATION: 250, // ms for triad rotation visual
  TILE_BASE_WIDTH: TARGET_TILE_BASE_WIDTH, // Use integer for base width
  TILE_HEIGHT: PRECISE_TILE_HEIGHT,      // Use precise float for height
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

