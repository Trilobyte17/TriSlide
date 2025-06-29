export const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export function getExpectedOrientation(r: number, c: number): 'up' | 'down' {
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
}