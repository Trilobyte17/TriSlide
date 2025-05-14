
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Max columns in any row
  return { rows, cols };
};

// Determines if a tile at (r, c) should be up-pointing or down-pointing
// This creates the alternating pattern essential for tessellation.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; // col 0 is up, 1 is down, 2 is up...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // col 0 is down, 1 is up, 2 is down...
  }
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r = 0; r < rows; r++) {
    const row: (Tile | null)[] = new Array(cols).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]);
  const { rows, cols: maxCols } = getGridDimensions(newGrid);

  for (let r = 0; r < rows; r++) {
    // Number of visual tiles in this row. Odd rows have one less.
    const tilesInThisRow = (r % 2 === 0) ? maxCols : maxCols - 1;
    for (let c = 0; c < maxCols; c++) { // Iterate up to maxCols for data array consistency
      if (c < tilesInThisRow) {
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: getExpectedOrientation(r, c),
          isNew: true,
        };
      } else {
        newGrid[r][c] = null; // Explicitly null for positions outside the jagged edge
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

  // Sort for consistent sliding behavior
  if (type === 'sum') { // '/' diagonal, sort by increasing row (top to bottom-left)
    lineCoords.sort((a, b) => a.r - b.r);
  } else { // '\' diagonal, sort by increasing row (top to bottom-right)
    lineCoords.sort((a, b) => a.r - b.r);
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
    let sourceTileData: Tile | null;

    if (slideDirection === 'forward') { // Tiles move "down" or "right" along the diagonal/row
      if (i === 0) { // First tile in line gets a new random tile
        sourceTileData = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: targetCoord.r, // Temporary, will be updated
          col: targetCoord.c, // Temporary, will be updated
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Temp
          isNew: true,
        };
      } else {
        sourceTileData = originalTilesData[i - 1];
      }
    } else { // backward - Tiles move "up" or "left"
      if (i === numTilesInLine - 1) { // Last tile in line gets new random
        sourceTileData = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
          isNew: true,
        };
      } else {
        sourceTileData = originalTilesData[i + 1];
      }
    }

    if (sourceTileData) {
      newGrid[targetCoord.r][targetCoord.c] = {
        ...sourceTileData,
        id: sourceTileData.id, // Preserve ID if it's an existing tile moving
        color: sourceTileData.color,
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
        isNew: sourceTileData.isNew ?? false, // Only new if explicitly set
        isMatched: false,
      };
    } else {
      newGrid[targetCoord.r][targetCoord.c] = null;
    }
  }
  return newGrid;
};


export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const { cols } = getGridDimensions(grid);
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const tilesInThisRow = (rowIndex % 2 === 0) ? cols : cols - 1;

  for (let c = 0; c < tilesInThisRow; c++) {
    if (grid[rowIndex][c]) {
      rowCoords.push({ r: rowIndex, c });
    }
  }

  if (rowCoords.length < 2) return grid;

  // For horizontal rows: 'left' slide means tiles move to the left (forward in 0-indexed columns)
  // 'right' slide means tiles move to the right (backward in 0-indexed columns)
  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';

  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols: maxCols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const deltasBase = [
    // Potential neighbors based on shared edges in a tessellated grid
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  if (tile.orientation === 'up') {
    // Up-pointing triangle also connects to the one "above" it (base of a down-pointing triangle)
    deltasBase.push({ dr: -1, dc: 0 });
  } else { // 'down'
    // Down-pointing triangle also connects to the one "below" it (tip of an up-pointing triangle)
    deltasBase.push({ dr: 1, dc: 0 });
  }

  for (const delta of deltasBase) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    // Check bounds
    if (nr >= 0 && nr < rows && nc >= 0 && nc < maxCols) {
      const neighborTile = grid[nr]?.[nc];
      // A valid neighbor must exist, have the opposite orientation, and be within the actual tile area of its row
      const tilesInNeighborRow = (nr % 2 === 0) ? maxCols : maxCols - 1;
      if (neighborTile && nc < tilesInNeighborRow && neighborTile.orientation !== tile.orientation) {
        neighbors.push({ r: nr, c: nc });
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

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          component.push({r: currR, c: currC});
          const tileForBFS = newGrid[currR][currC]!;

          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
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

  // Tiles fall column by column (conceptual columns of the bounding box)
  for (let C = 0; C < maxCols; C++) {
    let emptySlotR = -1;

    // Find the lowest empty slot in this conceptual column C
    for (let R = numRows - 1; R >= 0; R--) {
        const tilesInRowR = (R % 2 === 0) ? maxCols : maxCols - 1;
        if (C < tilesInRowR) {
            if (newGrid[R][C] === null) {
                emptySlotR = R;
                break;
            }
        }
    }

    if (emptySlotR !== -1) {
        for (let R_above = emptySlotR - 1; R_above >= 0; R_above--) {
            const tilesInRowRAbove = (R_above % 2 === 0) ? maxCols : maxCols - 1;
            if (C < tilesInRowRAbove && newGrid[R_above][C] !== null) {
                const tileToFall = newGrid[R_above][C]!;
                newGrid[emptySlotR][C] = {
                    ...tileToFall,
                    row: emptySlotR,
                    col: C,
                    orientation: getExpectedOrientation(emptySlotR, C),
                    isNew: false,
                };
                newGrid[R_above][C] = null;

                // Find next empty slot above the one just filled
                let nextEmptyR = -1;
                for(let rCheck = emptySlotR - 1; rCheck >= R_above; rCheck--) {
                    const tilesInRowRCheck = (rCheck % 2 === 0) ? maxCols : maxCols - 1;
                    if (C < tilesInRowRCheck && newGrid[rCheck][C] == null) {
                        nextEmptyR = rCheck;
                        break;
                    }
                }
                if (nextEmptyR !== -1) {
                    emptySlotR = nextEmptyR;
                } else {
                    // If no more empty slots directly above in this column segment, break to re-scan column
                    break;
                }
            }
        }
    }
  }

  // Spawn new tiles in any remaining empty spots from the top
  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    const tilesInThisRow = (r_spawn % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_spawn = 0; c_spawn < tilesInThisRow; c_spawn++) {
      if (newGrid[r_spawn][c_spawn] === null) {
        newGrid[r_spawn][c_spawn] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_spawn,
          col: c_spawn,
          orientation: getExpectedOrientation(r_spawn, c_spawn),
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

  // Test horizontal slides
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tilesInThisDataRow = grid[r_slide].filter(tile => tile !== null).length;
    if (tilesInThisDataRow > 1) { // Only slideable if more than 1 tile
        const gridAfterLeftSlide = slideRow(JSON.parse(JSON.stringify(grid)), r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

        const gridAfterRightSlide = slideRow(JSON.parse(JSON.stringify(grid)), r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  // Test diagonal slides
  const checkedDiagonals = new Set<string>();
  for (let r = 0; r < numRows; r++) {
    const tilesInThisRow = (r % 2 === 0) ? maxCols : maxCols - 1;
    for (let c = 0; c < tilesInThisRow; c++) {
      if (grid[r][c]) {
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r + c : r - c;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue;

          const lineCoords = getTilesOnDiagonal(grid, r, c, type);
          if (lineCoords.length > 1) {
            checkedDiagonals.add(diagonalKey);
            const gridAfterForwardSlide = slideLine(JSON.parse(JSON.stringify(grid)), lineCoords, 'forward');
            if (findAndMarkMatches(gridAfterForwardSlide).hasMatches) return false;

            const gridAfterBackwardSlide = slideLine(JSON.parse(JSON.stringify(grid)), lineCoords, 'backward');
            if (findAndMarkMatches(gridAfterBackwardSlide).hasMatches) return false;
          }
        }
      }
    }
  }
  return true;
};

    