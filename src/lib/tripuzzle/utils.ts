export const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // Flip the orientation pattern for all triangles to fix diagonal alignment
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'down' : 'up'; // Flipped from original
  } else { // Odd rows
    return c % 2 === 0 ? 'up' : 'down'; // Flipped from original
  }
};