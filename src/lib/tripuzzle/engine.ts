
import type { GridData, Tile, TileColor } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

// Utility to generate a unique ID for tiles
const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const initializeGrid = (numRows: number): GridData => {
  const grid: GridData = [];
  for (let r = 0; r < numRows; r++) {
    grid.push(new Array(r + 1).fill(null));
  }
  return grid;
};

const getRandomEmptyCell = (grid: GridData): { r: number; c: number } | null => {
  const emptyCells: { r: number; c: number }[] = [];
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) {
        emptyCells.push({ r, c });
      }
    });
  });
  if (emptyCells.length === 0) return null;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
};

export const addInitialTiles = (grid: GridData, count: number): GridData => {
  let newGrid = grid.map(row => [...row]);
  for (let i = 0; i < count; i++) {
    const pos = getRandomEmptyCell(newGrid);
    if (pos) {
      newGrid[pos.r][pos.c] = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: pos.r,
        col: pos.c,
        isNew: true,
      };
    }
  }
  return newGrid;
};

// Slides a row circularly
export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const newGrid = grid.map(r => r.map(t => t ? {...t, isNew: false, isMatched: false} : null)); // Deep copy and reset flags
  if (rowIndex < 0 || rowIndex >= newGrid.length) return newGrid;

  const row = newGrid[rowIndex];
  if (row.length <= 1) return newGrid; // Cannot slide a row with 0 or 1 tile

  if (direction === 'left') {
    const first = row.shift();
    if (first !== undefined) row.push(first);
  } else { // 'right'
    const last = row.pop();
    if (last !== undefined) row.unshift(last);
  }
  
  // Update col property for tiles in the slided row
  row.forEach((tile, c) => {
    if (tile) tile.col = c;
  });

  return newGrid;
};

// Finds and marks matches
export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false } : null));
  let hasMatches = false;
  let matchCount = 0;
  const numRows = newGrid.length;

  const markTile = (r: number, c: number) => {
    if (newGrid[r]?.[c] && !newGrid[r][c]!.isMatched) {
      newGrid[r][c]!.isMatched = true;
      matchCount++;
      hasMatches = true;
    }
  };

  // Check horizontal matches
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c <= newGrid[r].length - GAME_SETTINGS.MIN_MATCH_LENGTH; c++) {
      const firstTile = newGrid[r][c];
      if (!firstTile) continue;
      let match = true;
      for (let k = 1; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) {
        if (!newGrid[r][c + k] || newGrid[r][c + k]!.color !== firstTile.color) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let k = 0; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) markTile(r, c + k);
        // Extend match if longer
        let k = GAME_SETTINGS.MIN_MATCH_LENGTH;
        while (c + k < newGrid[r].length && newGrid[r][c+k] && newGrid[r][c+k]!.color === firstTile.color) {
          markTile(r, c+k);
          k++;
        }
      }
    }
  }

  // Check "vertical/diagonal" matches (simplified for this grid structure)
  // A tile at (r, c) has children at (r+1, c) and (r+1, c+1)
  // Check for matches along these lines
  // Pattern 1: (r,c), (r+1,c), (r+2,c) - "Left-leaning" vertical
  for (let r = 0; r <= numRows - GAME_SETTINGS.MIN_MATCH_LENGTH; r++) {
    for (let c = 0; c < newGrid[r].length; c++) {
      const firstTile = newGrid[r][c];
      if (!firstTile) continue;
      let match = true;
      for (let k = 1; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) {
        if (r + k >= numRows || c >= newGrid[r+k].length || !newGrid[r+k][c] || newGrid[r+k][c]!.color !== firstTile.color) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let k = 0; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) markTile(r+k, c);
         let k = GAME_SETTINGS.MIN_MATCH_LENGTH;
        while (r+k < numRows && c < newGrid[r+k].length && newGrid[r+k][c] && newGrid[r+k][c]!.color === firstTile.color) {
          markTile(r+k, c);
          k++;
        }
      }
    }
  }

  // Pattern 2: (r,c), (r+1,c+1), (r+2,c+2) - "Right-leaning" vertical
  for (let r = 0; r <= numRows - GAME_SETTINGS.MIN_MATCH_LENGTH; r++) {
    for (let c = 0; c < newGrid[r].length; c++) {
      const firstTile = newGrid[r][c];
      if (!firstTile) continue;
      let match = true;
      for (let k = 1; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) {
         if (r + k >= numRows || c + k >= newGrid[r+k].length || !newGrid[r+k][c+k] || newGrid[r+k][c+k]!.color !== firstTile.color) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let k = 0; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) markTile(r+k, c+k);
        let k = GAME_SETTINGS.MIN_MATCH_LENGTH;
        while (r+k < numRows && c+k < newGrid[r+k].length && newGrid[r+k][c+k] && newGrid[r+k][c+k]!.color === firstTile.color) {
          markTile(r+k, c+k);
          k++;
        }
      }
    }
  }
  
  return { newGrid, hasMatches, matchCount };
};

// Removes marked tiles
export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

// Applies gravity and spawns new tiles
export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false} : null)); // Deep copy
  const numRows = newGrid.length;

  // Gravity: very simplified - tiles fall "down" if space directly below or diagonally below-left is available.
  // This needs multiple passes to settle.
  for (let pass = 0; pass < numRows; pass++) { // Iterate enough times for tiles to fall
    for (let r = numRows - 2; r >= 0; r--) { // Iterate from bottom-up
      for (let c = 0; c < newGrid[r].length; c++) {
        const tile = newGrid[r][c];
        if (tile) {
          // Try to fall to (r+1, c) - "left child"
          if (newGrid[r+1][c] === null) {
            newGrid[r+1][c] = { ...tile, row: r + 1, col: c };
            newGrid[r][c] = null;
          } 
          // Try to fall to (r+1, c+1) - "right child"
          // Only if left child wasn't taken or original spot not emptied
          else if (newGrid[r][c] !== null && newGrid[r+1][c+1] === null) { 
            newGrid[r+1][c+1] = { ...tile, row: r + 1, col: c + 1 };
            newGrid[r][c] = null;
          }
        }
      }
    }
  }
  
  // Spawn new tiles in empty top-most cells for each conceptual "column"
  // More robust: fill all empty cells by spawning.
  let emptyCell = getRandomEmptyCell(newGrid);
  while(emptyCell) {
      newGrid[emptyCell.r][emptyCell.c] = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: emptyCell.r,
        col: emptyCell.c,
        isNew: true,
      };
      emptyCell = getRandomEmptyCell(newGrid); // find next for multiple spawns if needed, or just one per turn
      // For now, let's assume multiple tiles can spawn to fill up after matches
  }


  return newGrid;
};


export const checkGameOver = (grid: GridData): boolean => {
  // Check if grid is full
  let isFull = true;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) {
        isFull = false;
        break;
      }
    }
    if (!isFull) break;
  }

  // If not full, game is not over
  if (!isFull) return false;

  // If full, check if any slide can create a match
  // This is a simplified check: if current board has no matches, and it's full.
  // A more complex check would iterate all possible slides.
  const { hasMatches } = findAndMarkMatches(grid);
  if (isFull && !hasMatches) {
    // Try all possible slides to see if any can make a match
    for (let r = 0; r < grid.length; r++) {
      const slidedLeft = slideRow(grid, r, 'left');
      if (findAndMarkMatches(slidedLeft).hasMatches) return false;
      const slidedRight = slideRow(grid, r, 'right');
      if (findAndMarkMatches(slidedRight).hasMatches) return false;
    }
    return true; // Full and no slide creates a match
  }

  return false; // Has matches or not full
};
