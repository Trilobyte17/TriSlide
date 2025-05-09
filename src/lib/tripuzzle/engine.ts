
import type { GridData, GameState, Tile } from './types';
import { GAME_SETTINGS } from './types';

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
        value: GAME_SETTINGS.NEW_TILE_VALUE,
        row: pos.r,
        col: pos.c,
        isNew: true,
      };
    }
  }
  return newGrid;
};

export const spawnNewTile = (grid: GridData): GridData => {
  let newGrid = grid.map(row => row.map(tile => tile ? ({...tile, isNew: false}) : null)); // Reset isNew flag
  const pos = getRandomEmptyCell(newGrid);
  if (pos) {
    newGrid[pos.r][pos.c] = {
      id: generateUniqueId(),
      value: GAME_SETTINGS.NEW_TILE_VALUE,
      row: pos.r,
      col: pos.c,
      isNew: true,
    };
  }
  return newGrid;
};

export const performMerge = (
  grid: GridData,
  sourceTile: Tile,
  targetTile: Tile
): { newGrid: GridData; scoreBonus: number; merged: boolean } => {
  if (sourceTile.id === targetTile.id || sourceTile.value !== targetTile.value) {
    return { newGrid: grid, scoreBonus: 0, merged: false };
  }

  let newGrid = grid.map(row => row.map(t => t ? {...t} : null));
  let scoreBonus = 0;
  let newTargetValue: number;

  const sValue = sourceTile.value;
  if (sValue === 1) {
    newTargetValue = 0;
    scoreBonus = GAME_SETTINGS.SCORE_MERGE_1_TO_0;
  } else if (sValue === GAME_SETTINGS.MAX_TILE_VALUE) {
    newTargetValue = 0;
    scoreBonus = GAME_SETTINGS.SCORE_MERGE_MAX_TO_0;
  } else {
    newTargetValue = sValue + 1;
    scoreBonus = newTargetValue * GAME_SETTINGS.SCORE_MERGE_N_TO_N1_BASE;
  }

  // Update target tile
  const target = newGrid[targetTile.row][targetTile.col];
  if (target) {
    target.value = newTargetValue;
    target.isMerging = true; // For animation
  }
  
  // Remove source tile
  newGrid[sourceTile.row][sourceTile.col] = null;
  
  return { newGrid, scoreBonus, merged: true };
};

export const checkGameOver = (grid: GridData): boolean => {
  let hasEmptyCell = false;
  const tileValuesCount: { [key: number]: number } = {};

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const tile = grid[r][c];
      if (!tile) {
        hasEmptyCell = true;
      } else {
        tileValuesCount[tile.value] = (tileValuesCount[tile.value] || 0) + 1;
      }
    }
  }

  if (!hasEmptyCell) { // Grid is full
    // Check if any merges are possible
    for (const valueStr in tileValuesCount) {
      const value = parseInt(valueStr);
      if (value === 0) continue; // Zeros cannot be merged

      if (tileValuesCount[value] >= 2) {
        return false; // A merge is possible
      }
    }
    return true; // Grid is full and no merges are possible
  }

  return false; // There are empty cells, game is not over
};


// Simple gravity: new tiles are spawned in empty spots.
// More complex gravity (tiles falling) can be added later if needed.
// For now, spawnNewTile handles filling one empty spot.
// This function could be expanded for more complex fall logic.
// For now, it just ensures `isMerging` flags are cleared.
export const applyGravityAndSpawn = (grid: GridData): GridData => {
  // Currently, spawning is handled after a merge. If we need more complex gravity:
  // 1. Shift existing tiles down to fill empty spaces below them.
  // 2. Then, spawn new tiles at the top.
  // For simplicity, we'll stick to just spawning one new tile in a random empty spot.
  // This function can be a placeholder or evolve.
  // For now, it just ensures `isMerging` flags are cleared.
  const newGrid = grid.map(row => row.map(tile => tile ? ({...tile, isMerging: false, isVanishing: false, isNew: false}) : null));
  return spawnNewTile(newGrid);
};

    