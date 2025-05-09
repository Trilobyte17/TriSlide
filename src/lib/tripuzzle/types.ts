
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

export interface GridDimensions {
  rows: number;
  cols: number;
}

const TARGET_TILE_BASE_WIDTH = 40; 
const TARGET_TILE_HEIGHT = Math.round((Math.sqrt(3) / 2) * TARGET_TILE_BASE_WIDTH);

export const GAME_SETTINGS = {
  GRID_WIDTH_TILES: 11, 
  GRID_HEIGHT_TILES: 8,  
  MIN_MATCH_LENGTH: 3,
  // Using 5 colors as per existing CSS variables (--tile-0 to --tile-4)
  COLORS: ['red', 'green', 'blue', 'yellow', 'purple'] as const, 
  SCORE_PER_MATCHED_TILE: 10,
  SLIDE_ANIMATION_DURATION: 200, // ms
  MATCH_ANIMATION_DURATION: 300, // ms
  SPAWN_ANIMATION_DURATION: 300, // ms
  TILE_BASE_WIDTH: TARGET_TILE_BASE_WIDTH,
  TILE_HEIGHT: TARGET_TILE_HEIGHT,
} as const;

export type TileColor = typeof GAME_SETTINGS.COLORS[number];

export const getTileColorStyle = (color: TileColor): { backgroundColor: string, color: string } => {
  const colorIndex = GAME_SETTINGS.COLORS.indexOf(color);
  // Use modulo to cycle through available tile theme variables if more colors than themes
  const tileThemeVarIndex = colorIndex !== -1 ? colorIndex % GAME_SETTINGS.COLORS.length : 0; 
  
  return { 
    backgroundColor: `hsl(var(--tile-${tileThemeVarIndex}))`, 
    color: `hsl(var(--tile-text))` 
  };
};

export const getRandomColor = (): TileColor => {
  return GAME_SETTINGS.COLORS[Math.floor(Math.random() * GAME_SETTINGS.COLORS.length)];
};
