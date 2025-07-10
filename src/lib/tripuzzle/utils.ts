export const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // Standard triangular tessellation pattern
  // This creates a proper triangular grid where adjacent triangles share edges
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
};