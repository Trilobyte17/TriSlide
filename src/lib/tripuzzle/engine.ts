
"use client";

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor, getExpectedOrientation } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r_init = 0; r_init < rows; r_init++) {
    const row: (Tile | null)[] = new Array(cols).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]);
  const { rows } = getGridDimensions(newGrid);

  for (let r_add = 0; r_add < rows; r_add++) {
    const numVisualTilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; 

    for (let c_add = 0; c_add < numVisualTilesInThisRow; c_add++) {
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add),
          isNew: true,
          isMatched: false,
        };
    }
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

export const getNeighbors = (r: number, c: number, grid: GridData): { r: number; c: number }[] => {
    const tile = grid[r]?.[c];
    if (!tile) return [];

    const { rows } = getGridDimensions(grid);
    const cols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    const isValid = (nr: number, nc: number) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr]?.[nc] != null;
    
    const neighbors: { r: number; c: number }[] = [];
    
    if (isValid(r, c - 1)) neighbors.push({ r: r, c: c - 1 });
    if (isValid(r, c + 1)) neighbors.push({ r: r, c: c + 1 });
    
    if (tile.orientation === 'up') {
        if (isValid(r - 1, c)) neighbors.push({ r: r - 1, c: c });
    } else { // 'down'
        if (isValid(r + 1, c)) neighbors.push({ r: r + 1, c: c });
    }
    
    return neighbors;
};


export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): { r: number; c: number }[] => {
  const lineCoords: { r: number; c: number }[] = [];
  const { rows } = getGridDimensions(grid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  const startTile = grid[startR]?.[startC];
  if (!startTile) return [];

  // A visual diagonal is composed of tiles from two mathematical lines.
  // e.g., for 'sum' type, it's r+c=k and r+c=k-1
  const constant1 = type === 'sum' ? startR + startC : startR - startC;
  const constant2 = constant1 - 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < numVisualCols; c++) {
      if (grid[r][c] === null) continue;

      const currentConstant = type === 'sum' ? r + c : r - c;
      if (currentConstant === constant1 || currentConstant === constant2) {
        lineCoords.push({ r, c });
      }
    }
  }

  // Sort by row, then column to ensure a consistent order for sliding.
  lineCoords.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });

  return lineCoords;
};


export const slideLine = (
  grid: GridData,
  lineCoords: { r: number; c: number }[],
  slideDirection: SlideDirection,
  lineType: 'row' | DiagonalType
): GridData => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
      const tileAtCoord = grid[coord.r]?.[coord.c];
      return tileAtCoord ? {...tileAtCoord} : null;
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    
    const directionMultiplier = slideDirection === 'forward' ? -1 : 1;
    const sourceIndex = (i + directionMultiplier + numCellsInLine) % numCellsInLine;
    
    const sourceTileData = originalTilesData[sourceIndex];

    if (sourceTileData) {
      newGrid[targetCoord.r][targetCoord.c] = {
        ...sourceTileData,
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
        isNew: false,
        isMatched: false,
      };
    } else {
      newGrid[targetCoord.r][targetCoord.c] = null;
    }
  }
  return newGrid;
};

export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;
  
  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const originalRowData = [...newGrid[rowIndex]];
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c = 0; c < numCols; c++) {
    const sourceCol = direction === 'right' ? (c - 1 + numCols) % numCols : (c + 1) % numCols;
    const sourceTile = originalRowData[sourceCol];
    if (sourceTile) {
        newGrid[rowIndex][c] = {
            ...sourceTile,
            row: rowIndex,
            col: c,
            orientation: getExpectedOrientation(rowIndex, c)
        }
    } else {
        newGrid[rowIndex][c] = null;
    }
  }

  return newGrid;
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
    const workingGrid = grid.map(row => row.map(tile => (tile ? { ...tile, isMatched: false } : null)));
    const { rows } = getGridDimensions(workingGrid);
    const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    let hasMatches = false;
    let totalMatchCount = 0;
    const visitedForAnyMatch = new Set<string>();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < numVisualCols; c++) {
            const startKey = `${r},${c}`;
            if (visitedForAnyMatch.has(startKey)) {
                continue;
            }

            const startTile = workingGrid[r]?.[c];
            if (!startTile) {
                continue;
            }

            const component: { r: number, c: number }[] = [];
            const queue: { r: number; c: number }[] = [{ r, c }];
            const visitedForThisComponent = new Set<string>([startKey]);
            
            while (queue.length > 0) {
                const currentPos = queue.shift()!;
                component.push(currentPos);
                
                const neighbors = getNeighbors(currentPos.r, currentPos.c, workingGrid);

                for (const neighborPos of neighbors) {
                    const neighborKey = `${neighborPos.r},${neighborPos.c}`;
                    const neighborTile = workingGrid[neighborPos.r]?.[neighborPos.c];

                    if (neighborTile && !visitedForThisComponent.has(neighborKey) && neighborTile.color === startTile.color) {
                        visitedForThisComponent.add(neighborKey);
                        queue.push(neighborPos);
                    }
                }
            }

            if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
                hasMatches = true;
                totalMatchCount += component.length;
                for (const {r: matchR, c: matchC} of component) {
                    if (workingGrid[matchR]?.[matchC]) {
                        workingGrid[matchR][matchC]!.isMatched = true;
                        visitedForAnyMatch.add(`${matchR},${matchC}`);
                    }
                }
            }
        }
    }
    return { newGrid: workingGrid, hasMatches, matchCount: totalMatchCount };
};

export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row =>
    row.map(t => (t ? { ...t, isMatched: false } : null))
  );
  const { rows: numRows } = getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c = 0; c < numVisualCols; c++) {
    const columnTiles = [];
    for (let r = numRows - 1; r >= 0; r--) {
        if(newGrid[r][c]) {
            columnTiles.push(newGrid[r][c]!);
        }
    }

    for (let r = numRows - 1; r >= 0; r--) {
        const tile = columnTiles.shift();
        if(tile) {
            newGrid[r][c] = {
                ...tile,
                row: r,
                col: c,
                orientation: getExpectedOrientation(r, c),
                isNew: false
            };
        } else {
            newGrid[r][c] = null;
        }
    }
  }

  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    for (let c_spawn = 0; c_spawn < numVisualCols; c_spawn++) {
      if (newGrid[r_spawn][c_spawn] === null) {
        newGrid[r_spawn][c_spawn] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_spawn,
          col: c_spawn,
          orientation: getExpectedOrientation(r_spawn, c_spawn),
          isNew: true,
          isMatched: false,
        };
      }
    }
  }
  return newGrid;
};

export const checkGameOver = (grid: GridData): boolean => {
  const { rows: numRows } = getGridDimensions(grid);

  const { hasMatches: initialCheckHasMatches } = findAndMarkMatches(grid);
  if (initialCheckHasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    let tempGridLeft = slideRow(JSON.parse(JSON.stringify(grid)), r_slide, 'left');
    if (findAndMarkMatches(tempGridLeft).hasMatches) return false;

    let tempGridRight = slideRow(JSON.parse(JSON.stringify(grid)), r_slide, 'right');
    if (findAndMarkMatches(tempGridRight).hasMatches) return false;
  }

  const checkedDiagonals = new Set<string>();
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    for (let c_diag_start = 0; c_diag_start < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {

        const lineCoords = getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue;

        const canonicalLineKeyCoords = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('|');
        const canonicalLineKey = `${type}-${canonicalLineKeyCoords}`;

        if (checkedDiagonals.has(canonicalLineKey)) continue;
        checkedDiagonals.add(canonicalLineKey);

        let tempGridForward = slideLine(JSON.parse(JSON.stringify(grid)), lineCoords, 'forward', type);
        if (findAndMarkMatches(tempGridForward).hasMatches) return false;

        let tempGridBackward = slideLine(JSON.parse(JSON.stringify(grid)), lineCoords, 'backward', type);
        if (findAndMarkMatches(tempGridBackward).hasMatches) return false;
      }
    }
  }
  return true;
};
