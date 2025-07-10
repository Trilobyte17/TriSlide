
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

export const getNeighbors = (r: number, c: number): { r: number; c: number }[] => {
    const orientation = getExpectedOrientation(r, c);
    const neighbors: { r: number; c: number }[] = [];

    // Horizontal neighbors are always the same
    neighbors.push({ r: r, c: c - 1 });
    neighbors.push({ r: r, c: c + 1 });

    // Vertical neighbor depends on orientation
    if (orientation === 'up') {
        neighbors.push({ r: r - 1, c: c });
    } else { // 'down'
        neighbors.push({ r: r + 1, c: c });
    }
    
    // Filter out invalid coordinates
    return neighbors.filter(pos => 
        pos.r >= 0 && pos.r < GAME_SETTINGS.GRID_HEIGHT_TILES &&
        pos.c >= 0 && pos.c < GAME_SETTINGS.VISUAL_TILES_PER_ROW
    );
};

// New robust diagonal finding logic
export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): { r: number; c: number }[] => {
    const lineCoords: { r: number; c: number }[] = [];
    const visited = new Set<string>();

    const getNext = (r: number, c: number, dir: 'forward' | 'backward') => {
        const orientation = getExpectedOrientation(r, c);
        if (type === 'sum') { // '\' diagonal
            if (orientation === 'up') {
                return dir === 'forward' ? { r: r - 1, c: c + 1 } : { r: r + 1, c: c };
            } else { // down
                return dir === 'forward' ? { r: r, c: c + 1 } : { r: r - 1, c: c };
            }
        } else { // 'diff' diagonal, '/'
            if (orientation === 'up') {
                return dir === 'forward' ? { r: r - 1, c: c - 1 } : { r: r + 1, c: c };
            } else { // down
                return dir === 'forward' ? { r: r, c: c - 1 } : { r: r - 1, c: c };
            }
        }
    };
    
    const isValid = (r: number, c: number) => 
        r >= 0 && r < GAME_SETTINGS.GRID_HEIGHT_TILES && 
        c >= 0 && c < GAME_SETTINGS.VISUAL_TILES_PER_ROW &&
        grid[r]?.[c] !== null;

    // Walk forward
    let currentR = startR;
    let currentC = startC;
    while (isValid(currentR, currentC)) {
        const key = `${currentR},${currentC}`;
        if (visited.has(key)) break;
        visited.add(key);
        lineCoords.push({ r: currentR, c: currentC });
        const next = getNext(currentR, currentC, 'forward');
        currentR = next.r;
        currentC = next.c;
    }

    // Walk backward from the start
    const next = getNext(startR, startC, 'backward');
    currentR = next.r;
    currentC = next.c;
    while (isValid(currentR, currentC)) {
        const key = `${currentR},${currentC}`;
        if (visited.has(key)) break;
        visited.add(key);
        lineCoords.push({ r: currentR, c: currentC });
        const next = getNext(currentR, currentC, 'backward');
        currentR = next.r;
        currentC = next.c;
    }
    
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
                
                const neighbors = getNeighbors(currentPos.r, currentPos.c);

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
