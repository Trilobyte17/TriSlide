import { initializeGrid, addInitialTiles, findAndMarkMatches } from './engine';
import { GAME_SETTINGS } from './types';

describe('TriSlide Engine Tests', () => {
  test('initializeGrid creates correct grid structure', () => {
    const grid = initializeGrid(3, 5);
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(5);
    expect(grid[0][0]).toBeNull();
  });

  test('addInitialTiles populates grid with tiles', () => {
    const grid = initializeGrid(2, 3);
    const populatedGrid = addInitialTiles(grid);
    expect(populatedGrid[0][0]).not.toBeNull();
    expect(populatedGrid[0][0]?.color).toBeDefined();
  });

  test('findAndMarkMatches detects matches correctly', () => {
    const grid = initializeGrid(3, 3);
    // Manually set up a match
    grid[0][0] = { id: '1', color: 'red', row: 0, col: 0, orientation: 'up', isNew: false, isMatched: false };
    grid[0][1] = { id: '2', color: 'red', row: 0, col: 1, orientation: 'up', isNew: false, isMatched: false };
    grid[0][2] = { id: '3', color: 'red', row: 0, col: 2, orientation: 'up', isNew: false, isMatched: false };

    const result = findAndMarkMatches(grid);
    expect(result.hasMatches).toBe(true);
    expect(result.matchCount).toBe(3);
  });
});