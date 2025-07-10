
"use client";

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor, getExpectedOrientation } from './types';

// Creates a deep copy of the grid state to prevent mutation bugs.
// This is the most critical function for stability.
const deepCloneGrid = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile ? { ...tile } : null)));
};

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
  const newGrid = deepCloneGrid(grid);
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

    // All tiles have neighbors to the left and right on the same row.
    neighbors.push({ r, c: c - 1 }); 
    neighbors.push({ r, c: c + 1 }); 

    // The third neighbor depends on the tile's orientation.
    if (orientation === 'up') {
        // 'Up' triangles have a neighbor below them.
        neighbors.push({ r: r + 1, c }); 
    } else { // 'down'
        // 'Down' triangles have a neighbor above them.
        neighbors.push({ r: r - 1, c });
    }
    
    return neighbors.filter(pos => 
        pos.r >= 0 && pos.r < GAME_SETTINGS.GRID_HEIGHT_TILES &&
        pos.c >= 0 && pos.c < GAME_SETTINGS.VISUAL_TILES_PER_ROW
    );
};

// Helper function that was missing.
const getDiagonalTypeFromCoords = (lineCoords: { r: number; c: number }[]): DiagonalType | null => {
  if (lineCoords.length < 2) return null;
  const first = lineCoords[0];
  const second = lineCoords[1];

  const firstOrientation = getExpectedOrientation(first.r, first.c);
  if (firstOrientation === 'up') {
      if (second.r > first.r) { // Moved down
          return first.c === second.c ? 'sum' : 'diff'; // Simplified logic based on movement
      }
  } else { // 'down' orientation
      if (second.c !== first.c) { // Moved sideways
          return second.c > first.c ? 'sum' : 'diff';
      }
  }
  // Fallback for other cases, infer from general direction
  if ((second.r > first.r && second.c > first.c) || (second.r < first.r && second.c < first.c)) {
    return 'sum'; // '\'
  }
  if ((second.r > first.r && second.c < first.c) || (second.r < first.r && second.c > first.c)) {
    return 'diff'; // '/'
  }

  return 'sum'; // Default fallback
};


export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): { r: number; c: number }[] => {
    const lineCoords: { r: number; c: number }[] = [];
    const visited = new Set<string>();

    const getNextInWalk = (r: number, c: number, dir: 'forward' | 'backward', lineType: DiagonalType) => {
        const orientation = getExpectedOrientation(r, c);
        if (lineType === 'sum') { // '\' diagonal
             if (dir === 'forward') { // Moving "down-right" along the visual line
                return orientation === 'up' ? { r: r + 1, c: c } : { r: r, c: c + 1 };
             } else { // backward, moving "up-left"
                return orientation === 'up' ? { r: r, c: c - 1 } : { r: r - 1, c: c };
             }
        } else { // 'diff', '/' diagonal
            if (dir === 'forward') { // Moving "down-left" along the visual line
                return orientation === 'up' ? { r: r + 1, c: c } : { r: r, c: c - 1 };
            } else { // backward, moving "up-right"
                return orientation === 'up' ? { r: r, c: c + 1 } : { r: r - 1, c: c };
            }
        }
    };
    
    const isValid = (r: number, c: number) => 
        r >= 0 && r < GAME_SETTINGS.GRID_HEIGHT_TILES && 
        c >= 0 && c < GAME_SETTINGS.VISUAL_TILES_PER_ROW &&
        grid[r]?.[c] !== null;

    // Walk forward from the start point
    let currentR = startR;
    let currentC = startC;
    while (isValid(currentR, currentC)) {
        const key = `${currentR},${currentC}`;
        if (visited.has(key)) break;
        visited.add(key);
        lineCoords.push({ r: currentR, c: currentC });
        const next = getNextInWalk(currentR, currentC, 'forward', type);
        currentR = next.r;
        currentC = next.c;
    }

    // Walk backward from the start point
    let nextR = startR, nextC = startC;
    const { r: backR, c: backC } = getNextInWalk(nextR, nextC, 'backward', type);
    currentR = backR;
    currentC = backC;

    while (isValid(currentR, currentC)) {
        const key = `${currentR},${currentC}`;
        if (visited.has(key)) break;
        visited.add(key);
        lineCoords.unshift({ r: currentR, c: currentC }); // unshift to maintain order
        const next = getNextInWalk(currentR, currentC, 'backward', type);
        currentR = next.r;
        currentC = next.c;
    }

    return lineCoords;
};

export const slideLine = (
  grid: GridData,
  lineCoords: { r: number; c: number }[],
  slideDirection: SlideDirection
): GridData => {
  if (!lineCoords || lineCoords.length < 2) return grid;

  const newGrid = deepCloneGrid(grid); // Critical: Prevents state mutation.
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
      const tileAtCoord = grid[coord.r]?.[coord.c];
      return tileAtCoord ? {...tileAtCoord} : null;
  });

  // Determine if this is a diagonal slide and what type
  const isDiagonalSlide = !lineCoords.every(coord => coord.r === lineCoords[0].r);
  const diagonalType = isDiagonalSlide ? getDiagonalTypeFromCoords(lineCoords) : null;

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
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Correctly update orientation on move
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
  
  const newGrid = deepCloneGrid(grid); // Critical: Prevents state mutation.
  const originalRowData = newGrid[rowIndex].map(tile => tile ? {...tile} : null);
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c = 0; c < numCols; c++) {
    const sourceCol = direction === 'right' ? (c - 1 + numCols) % numCols : (c + 1) % numCols;
    const sourceTile = originalRowData[sourceCol];
    if (sourceTile) {
        newGrid[rowIndex][c] = {
            ...sourceTile,
            row: rowIndex,
            col: c,
            orientation: getExpectedOrientation(rowIndex, c) // Correctly update orientation on move
        }
    } else {
        newGrid[rowIndex][c] = null;
    }
  }

  return newGrid;
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
    const workingGrid = deepCloneGrid(grid); // Use a clean copy
    const { rows } = getGridDimensions(workingGrid);
    const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    let hasMatches = false;
    let totalMatchCount = 0;
    const matchedTiles = new Set<string>(); // Use a set to store coords of matched tiles

    // This set prevents re-checking a component of same-colored tiles
    const checkedForMatches = new Set<string>();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < numVisualCols; c++) {
            const startTile = workingGrid[r]?.[c];
            if (!startTile || checkedForMatches.has(`${r},${c}`)) continue;

            const component: { r: number, c: number }[] = [];
            const queue: { r: number; c: number }[] = [{ r, c }];
            const visitedForThisComponent = new Set<string>([`${r},${c}`]);
            
            let head = 0;
            while (head < queue.length) {
                const currentPos = queue[head++];
                component.push(currentPos);
                checkedForMatches.add(`${currentPos.r},${currentPos.c}`);
                
                const neighbors = getNeighbors(currentPos.r, currentPos.c);

                for (const neighborPos of neighbors) {
                    const neighborKey = `${neighborPos.r},${neighborPos.c}`;
                    if (visitedForThisComponent.has(neighborKey)) continue;

                    const neighborTile = workingGrid[neighborPos.r]?.[neighborPos.c];

                    if (neighborTile && neighborTile.color === startTile.color) {
                        visitedForThisComponent.add(neighborKey);
                        queue.push(neighborPos);
                    }
                }
            }

            if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
                hasMatches = true;
                for (const {r: matchR, c: matchC} of component) {
                    matchedTiles.add(`${matchR},${matchC}`);
                }
            }
        }
    }

    if (hasMatches) {
        matchedTiles.forEach(key => {
            const [r_str, c_str] = key.split(',');
            const r = parseInt(r_str, 10);
            const c = parseInt(c_str, 10);
            if (workingGrid[r]?.[c]) {
                workingGrid[r][c]!.isMatched = true;
            }
        });
        totalMatchCount = matchedTiles.size;
    }

    return { newGrid: workingGrid, hasMatches, matchCount: totalMatchCount };
};

export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => {
    if (tile && tile.isMatched) {
      return null;
    }
    // Return a clean copy of the non-matched tile
    return tile ? { ...tile, isNew: false, isMatched: false } : null;
  }));
};

export const applyGravityAndSpawn = (grid: GridData): GridData => {
  const newGrid = deepCloneGrid(grid); // Critical: Start with a deep copy.
  const { rows: numRows } = getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  // Apply gravity column by column
  for (let c = 0; c < numVisualCols; c++) {
    let emptyRow = numRows - 1; // Start checking for empty spots from the bottom
    // Iterate upwards from the bottom of the column
    for (let r = numRows - 1; r >= 0; r--) {
      if (newGrid[r][c] !== null) {
        if (r !== emptyRow) {
          // If there's a tile and it's not where it should be, move it down
          const tileToMove = newGrid[r][c]!;
          newGrid[emptyRow][c] = {
            ...tileToMove,
            row: emptyRow, // Update row
            // col remains 'c'
            orientation: getExpectedOrientation(emptyRow, c), // Update orientation for new position
            isNew: false, 
          };
          newGrid[r][c] = null; // Vacate the old spot
        }
        emptyRow--; // Move up to the next spot to fill
      }
    }
  }

  // Spawn new tiles in any remaining empty spots at the top
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numVisualCols; c++) {
      if (newGrid[r][c] === null) {
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: getExpectedOrientation(r, c),
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

  // If the board already has matches, it's not game over.
  if (findAndMarkMatches(grid).hasMatches) {
    return false;
  }

  // Check all possible row slides
  for (let r = 0; r < numRows; r++) {
    const tempGridRight = slideRow(grid, r, 'right');
    if (findAndMarkMatches(tempGridRight).hasMatches) {
      return false; // Found a possible move
    }
  }

  // Check all possible diagonal slides
  const checkedDiagonals = new Set<string>();
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c++) {
      if (!grid[r][c]) continue;

      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        const lineCoords = getTilesOnDiagonal(grid, r, c, type);
        
        if (lineCoords.length < GAME_SETTINGS.MIN_MATCH_LENGTH) continue;
        const canonicalKey = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('|');
        if (checkedDiagonals.has(`${type}-${canonicalKey}`)) continue;
        checkedDiagonals.add(`${type}-${canonicalKey}`);

        const tempGridForward = slideLine(grid, lineCoords, 'forward');
        if (findAndMarkMatches(tempGridForward).hasMatches) {
          return false; // Found a possible move
        }
      }
    }
  }

  return true;
};
