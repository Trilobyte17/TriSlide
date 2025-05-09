
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

export const GAME_SETTINGS = {
  NUM_ROWS: 5,
  // MAX_TILE_VALUE: 10, // No longer applicable for color matching
  MIN_MATCH_LENGTH: 3, // Minimum number of tiles in a sequence to form a match
  COLORS: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] as const, // Define available tile colors
  INITIAL_TILES_COUNT: 5, // Initial number of tiles on the grid
  // NEW_TILE_VALUE: 1, // Replaced by random color spawning
  SCORE_PER_MATCHED_TILE: 10, // Points awarded per tile in a match
  // SCORE_MERGE_1_TO_0: 10, // No longer applicable
  // SCORE_MERGE_MAX_TO_0: 1000, // No longer applicable
  // SCORE_MERGE_N_TO_N1_BASE: 10, // No longer applicable
  SLIDE_ANIMATION_DURATION: 200, // ms for slide animation
  MATCH_ANIMATION_DURATION: 300, // ms for match/disappear animation
  SPAWN_ANIMATION_DURATION: 300, // ms for new tiles appearing
} as const;

export type TileColor = typeof GAME_SETTINGS.COLORS[number];

// Helper to get tile color style based on color string
// This maps color names to the existing HSL CSS variables for tiles (tile-0, tile-1, etc.)
export const getTileColorStyle = (color: TileColor): React.CSSProperties => {
  const colorIndex = GAME_SETTINGS.COLORS.indexOf(color);
  const tileThemeVarIndex = colorIndex !== -1 ? colorIndex % 6 : 0; // Cycle through 0-5 for theme vars
  
  return { 
    backgroundColor: `hsl(var(--tile-${tileThemeVarIndex}))`, 
    color: `hsl(var(--tile-text))` 
  } as React.CSSProperties;
};

export const getRandomColor = (): TileColor => {
  return GAME_SETTINGS.COLORS[Math.floor(Math.random() * GAME_SETTINGS.COLORS.length)];
};
