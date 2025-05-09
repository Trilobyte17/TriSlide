export interface Tile {
  id: string;
  color: string; // Changed from value: number
  row: number;
  col: number;
  isNew?: boolean; // For animation purposes
  isMatched?: boolean; // For marking matched tiles for removal/animation
  // isMerging and isVanishing might be repurposed or removed if animations change
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

const TILE_SVG_BASE_WIDTH = 60; // px
// Use precise height for equilateral triangle: (sqrt(3)/2) * width
const TILE_SVG_HEIGHT = Math.round((Math.sqrt(3) / 2) * TILE_SVG_BASE_WIDTH); 

export const GAME_SETTINGS = {
  NUM_ROWS: 5,
  MIN_MATCH_LENGTH: 3, 
  COLORS: ['red', 'green', 'blue', 'yellow'] as const, // Changed to 4 colors
  INITIAL_TILES_COUNT: 5, 
  SCORE_PER_MATCHED_TILE: 10, 
  SLIDE_ANIMATION_DURATION: 200, 
  MATCH_ANIMATION_DURATION: 300, 
  SPAWN_ANIMATION_DURATION: 300,
  TILE_BASE_WIDTH: TILE_SVG_BASE_WIDTH, // For layout calculations
  TILE_HEIGHT: TILE_SVG_HEIGHT,     // For layout calculations
} as const;

export type TileColor = typeof GAME_SETTINGS.COLORS[number];

// Helper to get tile color style based on color string
// This maps color names to the existing HSL CSS variables for tiles (tile-0, tile-1, etc.)
export const getTileColorStyle = (color: TileColor): { backgroundColor: string, color: string } => {
  const colorIndex = GAME_SETTINGS.COLORS.indexOf(color);
  // Cycle through 0-3 for --tile-X theme vars.
  const tileThemeVarIndex = colorIndex !== -1 ? colorIndex % GAME_SETTINGS.COLORS.length : 0; 
  
  return { 
    backgroundColor: `hsl(var(--tile-${tileThemeVarIndex}))`, 
    // Text color is not directly used for SVG fill but kept for consistency if needed later
    color: `hsl(var(--tile-text))` 
  };
};

export const getRandomColor = (): TileColor => {
  return GAME_SETTINGS.COLORS[Math.floor(Math.random() * GAME_SETTINGS.COLORS.length)];
};

