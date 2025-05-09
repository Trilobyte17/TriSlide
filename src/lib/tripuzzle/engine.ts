
import type { GridData, Tile } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r = 0; r < rows; r++) {
    // Each row in gridData will correspond to a visual row of triangles
    grid.push(new Array(cols).fill(null));
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]); // Deep copy
  const rows = newGrid.length;
  const cols = newGrid[0]?.length || 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Determine orientation for a tessellated rectangular grid
      // (r,c) is up if (r is even and c is even) OR (r is odd and c is odd)
      // (r,c) is down if (r is even and c is odd) OR (r is odd and c is even)
      // Simplified: (r+c) % 2 === 0 -> up, (r+c) % 2 === 1 -> down for one convention
      // To match image more closely (top-left often UP):
      // Row 0: U D U D ...
      // Row 1: D U D U ...
      const orientation = ((r % 2 === 0 && c % 2 === 0) || (r % 2 !== 0 && c % 2 !== 0)) ? 'up' : 'down';
      
      newGrid[r][c] = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: r,
        col: c,
        orientation: orientation,
        isNew: true,
      };
    }
  }
  return newGrid;
};

// Slides a row circularly - REMAINS DEACTIVATED FOR NOW
export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const newGrid = grid.map(r => r.map(t => t ? {...t, isNew: false, isMatched: false} : null)); 
  if (rowIndex < 0 || rowIndex >= newGrid.length) return newGrid;

  // This slide logic is for simple array rows, not complex tessellated ones.
  // Needs significant rework for Trism-like sliding.
  const row = newGrid[rowIndex];
  if (row.length <= 1) return newGrid;

  if (direction === 'left') {
    const first = row.shift();
    if (first !== undefined) row.push(first);
  } else { 
    const last = row.pop();
    if (last !== undefined) row.unshift(last);
  }
  
  row.forEach((tile, c) => {
    if (tile) tile.col = c; // This col update might be misleading for tessellated grid display
  });

  return newGrid;
};

// Finds and marks matches - NEEDS REWORK for tessellated grid adjacencies
export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false } : null));
  let hasMatches = false;
  let matchCount = 0;
  
  // Simplified match finding - placeholder, needs proper adjacency logic for tessellated grid
  // This current version will likely not find many valid Trism-style matches.
  const numRows = newGrid.length;
  if (numRows === 0) return { newGrid, hasMatches, matchCount };
  const numCols = newGrid[0].length;

  const markTile = (r: number, c: number) => {
    if (newGrid[r]?.[c] && !newGrid[r][c]!.isMatched) {
      newGrid[r][c]!.isMatched = true;
      matchCount++;
      hasMatches = true;
    }
  };

  // Horizontal check (crude, only checks 3 in a data row)
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c <= numCols - GAME_SETTINGS.MIN_MATCH_LENGTH; c++) {
      const firstTile = newGrid[r][c];
      if (!firstTile) continue;
      let match = true;
      for (let k = 1; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) {
        if (!newGrid[r][c+k] || newGrid[r][c+k]!.color !== firstTile.color || newGrid[r][c+k]!.orientation === firstTile.orientation) { // Added orientation check to prevent simple line matches
          match = false;
          break;
        }
      }
      if (match) {
        for (let k = 0; k < GAME_SETTINGS.MIN_MATCH_LENGTH; k++) markTile(r, c+k);
      }
    }
  }
  // TODO: Implement proper diagonal/adjacent match finding for tessellated triangles

  return { newGrid, hasMatches, matchCount };
};

export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
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

export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false} : null));
  const rows = newGrid.length;
  if (rows === 0) return newGrid;
  const cols = newGrid[0].length;

  // Simplified gravity: fill from bottom up, direct fall. Needs rework for tessellation.
  for (let c = 0; c < cols; c++) {
    let emptySlotInCol = -1;
    for (let r = rows - 1; r >= 0; r--) {
      if (newGrid[r][c] === null && emptySlotInCol === -1) {
        emptySlotInCol = r;
      } else if (newGrid[r][c] !== null && emptySlotInCol !== -1) {
        newGrid[emptySlotInCol][c] = { ...newGrid[r][c]!, row: emptySlotInCol, col: c };
        newGrid[r][c] = null;
        emptySlotInCol--; 
      }
    }
  }
  
  // Spawn new tiles in empty cells at the top
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (newGrid[r][c] === null) {
        const orientation = ((r % 2 === 0 && c % 2 === 0) || (r % 2 !== 0 && c % 2 !== 0)) ? 'up' : 'down';
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: orientation,
          isNew: true,
        };
      }
    }
  }
  return newGrid;
};

export const checkGameOver = (grid: GridData): boolean => {
  // Placeholder: game over if no matches and grid is full (or no possible slides make matches)
  const { hasMatches } = findAndMarkMatches(grid);
  if (hasMatches) return false;

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
  if (!isFull) return false; // Can still spawn

  // TODO: Check if any possible slide can create a match
  // For now, if full and no matches, assume game over if sliding is not implemented
  return true; 
};
