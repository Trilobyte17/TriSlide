
export interface Tile {
  id: string;
  value: number;
  row: number;
  col: number;
  isNew?: boolean; // For animation purposes
  isMerging?: boolean; // For animation of merge target
  isVanishing?: boolean; // For animation of merged source tile
}

export type GridRow = (Tile | null)[];
export type GridData = GridRow[];

export interface GameState {
  grid: GridData;
  score: number;
  isGameOver: boolean;
  isGameStarted: boolean; // To differentiate between initial load and active game
  isLoading: boolean; // To manage loading state from localStorage
}

export const GAME_SETTINGS = {
  NUM_ROWS: 5,
  MAX_TILE_VALUE: 10,
  INITIAL_TILES_COUNT: 3,
  NEW_TILE_VALUE: 1, // Value of newly spawned tiles
  SCORE_MERGE_1_TO_0: 10,
  SCORE_MERGE_MAX_TO_0: 1000,
  SCORE_MERGE_N_TO_N1_BASE: 10, // Base points for N+N -> N+1, actual score is (Value) * this
} as const;

// Helper to get tile color based on value
export const getTileColorStyle = (value: number): React.CSSProperties => {
  if (value < 0 || value > GAME_SETTINGS.MAX_TILE_VALUE) {
    return { backgroundColor: `hsl(var(--tile-0))`, color: `hsl(var(--tile-text))` } as React.CSSProperties;
  }
  return { 
    backgroundColor: `hsl(var(--tile-${value}))`, 
    color: `hsl(var(--tile-text))` 
  } as React.CSSProperties;
};

    