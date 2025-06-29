// Utility functions for TriPuzzle game
// Separated to avoid any Server Action inference issues

/**
 * Determines the expected orientation of a triangle tile based on its position
 * @param r Row index
 * @param c Column index
 * @returns 'up' or 'down' orientation
 */
export function getExpectedOrientation(r: number, c: number): 'up' | 'down' {
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
}

/**
 * Generates a unique ID for tiles
 */
export const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);