
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

// Gets the coordinates of the 3 tiles that share a side with the given tile.
export const getNeighbors = (r: number, c: number, grid: GridData): { r: number; c: number }[] => {
    const tile = grid[r]?.[c];
    if (!tile) return [];

    const neighbors: { r: number; c: number }[] = [];
    const { rows } = getGridDimensions(grid);
    const cols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    const isValid = (nr: number, nc: number) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr]?.[nc] != null;
    
    const potentialNeighbors: { r: number; c: number }[] = [];
    
    // Horizontal neighbors (always share a side)
    potentialNeighbors.push({ r: r, c: c - 1 });
    potentialNeighbors.push({ r: r, c: c + 1 });

    // Vertical neighbor depends on orientation
    if (tile.orientation === 'up') {
        potentialNeighbors.push({ r: r - 1, c: c }); // Above
    } else { // 'down'
        potentialNeighbors.push({ r: r + 1, c: c }); // Below
    }

    for (const p of potentialNeighbors) {
        if (isValid(p.r, p.c)) {
            neighbors.push(p);
        }
    }
    return neighbors;
};


// Helper for getTilesOnDiagonal. Defines the path of tiles touching at vertices.
const getNextInWalk = (grid: GridData, r: number, c: number, type: DiagonalType, direction: 'forward' | 'backward'): { r: number; c: number } | null => {
    const tile = grid[r]?.[c];
    if (!tile) return null;

    const isForward = direction === 'forward';

    if (type === 'diff') { // '\' diagonal: TL to BR is forward
        if (isForward) { // Moving right/down
            return tile.orientation === 'up' ? { r: r, c: c + 1 } : { r: r + 1, c: c };
        } else { // Moving left/up
            return tile.orientation === 'up' ? { r: r - 1, c: c } : { r: r, c: c - 1 };
        }
    } else { // type === 'sum', '/' diagonal: TR to BL is forward
        if (isForward) { // Moving left/down
            return tile.orientation === 'up' ? { r: r + 1, c: c } : { r: r, c: c - 1 };
        } else { // Moving right/up
            return tile.orientation === 'up' ? { r: r, c: c + 1 } : { r: r - 1, c: c };
        }
    }
};

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): { r: number; c: number }[] => {
  const { rows: numGridRows } = getGridDimensions(grid);
  const lineCoords: { r: number; c: number }[] = [];
  const visited = new Set<string>();

  const isValid = (r: number, c: number) =>
    r >= 0 && r < numGridRows && c >= 0 && c < GAME_SETTINGS.VISUAL_TILES_PER_ROW && grid[r]?.[c] !== null;

  if (!isValid(startR, startC)) return [];
  
  let r = startR;
  let c = startC;

  // Traverse to the start of the line by going backward.
  while (true) {
    const prev = getNextInWalk(grid, r, c, type, 'backward');
    if (prev && isValid(prev.r, prev.c)) {
      const key = `${prev.r},${prev.c}`;
      if(visited.has(key)) break; // Prevent infinite loops
      visited.add(key);
      r = prev.r;
      c = prev.c;
    } else {
      break;
    }
  }
  
  visited.clear(); // Clear visited for the forward pass

  // Now at the start, traverse to the end by going forward.
  while (isValid(r, c)) {
    const key = `${r},${c}`;
    if (visited.has(key)) break;
    visited.add(key);
    lineCoords.push({ r, c });

    const next = getNextInWalk(grid, r, c, type, 'forward');
    if (next && isValid(next.r, next.c)) {
      r = next.r;
      c = next.c;
    } else {
      break;
    }
  }
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
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // This is crucial
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
    let hasMatches = false;
    let totalMatchCount = 0;
    const visitedForAnyMatch = new Set<string>();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c++) {
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
    // Collect all non-null tiles in the current column, from the bottom up
    for (let r = numRows - 1; r >= 0; r--) {
        if(newGrid[r][c]) {
            columnTiles.push(newGrid[r][c]!);
        }
    }

    // Place the collected tiles at the bottom of the column
    for (let r = numRows - 1; r >= 0; r--) {
        const tile = columnTiles.shift(); // Take from the start of the collected (bottom of grid)
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

  // Spawn new tiles in any remaining empty slots
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
