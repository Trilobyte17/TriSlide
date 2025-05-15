
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Max columns in any row
  return { rows, cols };
};

// Determines if a tile at (r, c) should be up-pointing or down-pointing.
// This is critical for the tessellation.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; // Pattern: UP, DOWN, UP...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // Pattern: DOWN, UP, DOWN... (inverted/mirrored from even rows)
  }
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
  const { rows, cols: maxCols } = getGridDimensions(newGrid); 

  for (let r_add = 0; r_add < rows; r_add++) {
    const tilesInThisRowVisual = (r_add % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_add = 0; c_add < maxCols; c_add++) { 
      if (c_add < tilesInThisRowVisual) { 
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add), // Correctly set orientation
          isNew: true,
        };
      } else {
        newGrid[r_add][c_add] = null;
      }
    }
  }
  return newGrid;
};

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
  const { rows, cols } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  for (let r_iter = 0; r_iter < rows; r_iter++) {
    const tilesInCurrentRow = (r_iter % 2 === 0) ? cols : cols - 1;
    for (let c_iter = 0; c_iter < tilesInCurrentRow; c_iter++) {
      if (grid[r_iter][c_iter]) {
        if (type === 'sum' && r_iter + c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        } else if (type === 'diff' && r_iter - c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        }
      }
    }
  }

  // Sort to ensure consistent order for 'forward'/'backward' sliding
  if (type === 'sum') { 
    lineCoords.sort((a, b) => a.r - b.r || b.c - a.c); // Primary sort by row (top to bottom), secondary by col (right to left for sum)
  } else { // 'diff'
    lineCoords.sort((a, b) => a.r - b.r || a.c - b.c); // Primary sort by row (top to bottom), secondary by col (left to right for diff)
  }
  return lineCoords;
};

export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length < 2) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; 
  const numTilesInLine = lineCoords.length;
  const originalTilesData = lineCoords.map(coord => grid[coord.r][coord.c]);

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') { // Tiles shift "down" or "right" along the line
      sourceTileIndex = (i - 1 + numTilesInLine) % numTilesInLine;
      if (i === 0) isNewlySpawned = true; // New tile appears at the start of the line
    } else { // 'backward' - Tiles shift "up" or "left" along the line
      sourceTileIndex = (i + 1) % numTilesInLine;
      if (i === numTilesInLine - 1) isNewlySpawned = true; // New tile appears at the end of the line
    }

    let tileToPlace: Tile | null;

    if (isNewlySpawned) {
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Critical: use target position
        isNew: true,
        isMatched: false,
      };
    } else {
      const existingTile = originalTilesData[sourceTileIndex];
      if (existingTile) {
        tileToPlace = {
          ...existingTile,
          id: existingTile.id, // Retain ID of shifted tile
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Critical: update orientation for new position
          isNew: false,
          isMatched: false,
        };
      } else {
        tileToPlace = null; // Should not happen if lineCoords are valid
      }
    }
    newGrid[targetCoord.r][targetCoord.c] = tileToPlace;
  }
  return newGrid;
};


export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const { cols } = getGridDimensions(grid);
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const tilesInThisRowVisual = (rowIndex % 2 === 0) ? cols : cols - 1;

  for (let c_slide = 0; c_slide < tilesInThisRowVisual; c_slide++) {
    if (grid[rowIndex][c_slide]) { 
      rowCoords.push({ r: rowIndex, c: c_slide });
    }
  }
  
  if (rowCoords.length < 2) return grid; 

  // For horizontal rows: 'left' drag means tiles move "forward" (0th tile replaced)
  // 'right' drag means tiles move "backward" (last tile replaced)
  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';

  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols: maxCols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const deltas = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  if (tile.orientation === 'up') {
     deltas.push({ dr: -1, dc: 0 }); 
  } else { // 'down'
     deltas.push({ dr: 1, dc: 0 });  
  }

  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < maxCols) {
      const neighborTile = grid[nr]?.[nc];
      const tilesInNeighborRow = (nr % 2 === 0) ? maxCols : maxCols - 1;

      if (neighborTile && nc < tilesInNeighborRow) {
        if (neighborTile.orientation !== tile.orientation) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  return neighbors;
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows, cols: maxCols } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  const visitedForMatchFinding = new Set<string>();

  for (let r_find = 0; r_find < rows; r_find++) {
    const tilesInThisRow = (r_find % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_find = 0; c_find < tilesInThisRow; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = [];
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}];
        visitedForMatchFinding.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR][currC]!;
          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
              component.push(neighborPos);
              q.push(neighborPos);
            }
          }
        }

        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r][pos.c] && !newGrid[pos.r][pos.c]!.isMatched) {
               newGrid[pos.r][pos.c]!.isMatched = true;
               totalMatchedTiles++;
            }
          });
        }
      }
    }
  }
  return { newGrid, hasMatches, matchCount: totalMatchedTiles };
};

export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows, cols: maxCols } = getGridDimensions(newGrid);

  // Simplified vertical gravity: tiles fall straight down if space below is compatible and empty.
  for (let c_grav = 0; c_grav < maxCols; c_grav++) {
    for (let r_grav = numRows - 2; r_grav >= 0; r_grav--) { // Start from second to last row, check downwards
      const currentTile = newGrid[r_grav][c_grav];
      if (currentTile) {
        // Try to move this tile down as far as possible in its column
        let lowestPossibleR = r_grav;
        for (let r_check_below = r_grav + 1; r_check_below < numRows; r_check_below++) {
          const tilesInRowBelow = (r_check_below % 2 === 0) ? maxCols : maxCols - 1;
          if (c_grav < tilesInRowBelow && newGrid[r_check_below][c_grav] === null) {
            // Also need to check if orientations are compatible if we were doing complex gravity.
            // For simple straight fall, we just need space.
            lowestPossibleR = r_check_below;
          } else {
            break; // Obstacle or end of grid
          }
        }

        if (lowestPossibleR !== r_grav) {
          newGrid[lowestPossibleR][c_grav] = {
            ...currentTile,
            row: lowestPossibleR,
            col: c_grav,
            orientation: getExpectedOrientation(lowestPossibleR, c_grav), // Update orientation for new position
            isNew: false,
          };
          newGrid[r_grav][c_grav] = null;
        }
      }
    }
  }

  // Spawn new tiles in any remaining empty spots (top-down)
  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    const tilesInThisRow = (r_spawn % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_spawn = 0; c_spawn < tilesInThisRow; c_spawn++) {
      if (newGrid[r_spawn][c_spawn] === null) {
        newGrid[r_spawn][c_spawn] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_spawn,
          col: c_spawn,
          orientation: getExpectedOrientation(r_spawn, c_spawn), // Correctly set orientation for new tile
          isNew: true,
        };
      }
    }
  }
  return newGrid;
};


export const checkGameOver = (grid: GridData): boolean => {
  const { rows: numRows, cols: maxCols } = getGridDimensions(grid);

  if (findAndMarkMatches(grid).hasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tilesInThisDataRow = grid[r_slide].filter(tile => tile !== null).length;
    if (tilesInThisDataRow > 1) { 
        const tempGridLeft = JSON.parse(JSON.stringify(grid));
        const gridAfterLeftSlide = slideRow(tempGridLeft, r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

        const tempGridRight = JSON.parse(JSON.stringify(grid));
        const gridAfterRightSlide = slideRow(tempGridRight, r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    const tilesInThisRow = (r_diag % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_diag = 0; c_diag < tilesInThisRow; c_diag++) {
      if (grid[r_diag][c_diag]) { 
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r_diag + c_diag : r_diag - c_diag;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue; 

          const lineCoords = getTilesOnDiagonal(grid, r_diag, c_diag, type);
          if (lineCoords.length > 1) { 
            checkedDiagonals.add(diagonalKey); 

            const tempGridForward = JSON.parse(JSON.stringify(grid));
            const gridAfterForwardSlide = slideLine(tempGridForward, lineCoords, 'forward');
            if (findAndMarkMatches(gridAfterForwardSlide).hasMatches) return false;

            const tempGridBackward = JSON.parse(JSON.stringify(grid));
            const gridAfterBackwardSlide = slideLine(tempGridBackward, lineCoords, 'backward');
            if (findAndMarkMatches(gridAfterBackwardSlide).hasMatches) return false;
          }
        }
      }
    }
  }
  return true; 
};
