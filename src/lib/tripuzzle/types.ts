
export interface Tile {
  id: string;
  color: string; 
  row: number;
  col: number;
  orientation: 'up' | 'down'; // Added to define triangle orientation
  isNew?: boolean; 
  isMatched?: boolean;
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

// Adjusted for a rectangular grid that looks like the image
const TARGET_TILE_BASE_WIDTH = 40; // Smaller tiles to fit more
const TARGET_TILE_HEIGHT = Math.round((Math.sqrt(3) / 2) * TARGET_TILE_BASE_WIDTH);

export const GAME_SETTINGS = {
  // NUM_ROWS: 5, // Replaced by GRID_HEIGHT_TILES
  GRID_WIDTH_TILES: 11, // Number of horizontal tile "slots" for a rectangular layout
  GRID_HEIGHT_TILES: 8,  // Number of vertical tile "slots" / rows
  MIN_MATCH_LENGTH: 3,
  COLORS: ['red', 'green', 'blue', 'yellow', 'purple'] as const, // Added purple
  SCORE_PER_MATCHED_TILE: 10,
  SLIDE_ANIMATION_DURATION: 200,
  MATCH_ANIMATION_DURATION: 300,
  SPAWN_ANIMATION_DURATION: 300,
  TILE_BASE_WIDTH: TARGET_TILE_BASE_WIDTH,
  TILE_HEIGHT: TARGET_TILE_HEIGHT,
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
