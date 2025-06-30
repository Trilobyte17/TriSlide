import { GAME_SETTINGS } from './types';

export const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // For a triangular grid pattern, we need to handle the orientation properly
  // Check if this row has fewer triangles than the maximum (indicating a diagonal edge)
  const currentRowTriangles = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
  const maxTriangles = GAME_SETTINGS.MAX_TRIANGLES_PER_ROW;
  
  // If this row has fewer than the maximum triangles, it's a "short" diagonal row
  const isShortRow = currentRowTriangles < maxTriangles;
  
  if (isShortRow) {
    // For short diagonal rows, flip the orientation pattern
    if (r % 2 === 0) { // Even rows
      return c % 2 === 0 ? 'down' : 'up'; // Flipped
    } else { // Odd rows
      return c % 2 === 0 ? 'up' : 'down'; // Flipped
    }
  } else {
    // For full rows, use standard alternating pattern
    if (r % 2 === 0) { // Even rows
      return c % 2 === 0 ? 'up' : 'down';
    } else { // Odd rows
      return c % 2 === 0 ? 'down' : 'up';
    }
  }
};