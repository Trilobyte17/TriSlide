
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

// Defines the canonical orientation of a tile based on its grid position
// For 12 rows, 11 triangles/row, no horizontal offsets:
// Even rows (0-indexed): UP, DOWN, UP...
// Odd rows (1-indexed): DOWN, UP, DOWN...
const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even row
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd row
    return c % 2 === 0 ? 'down' : 'up';
  }
};

export const getGridDimensions = async (grid: GridData): Promise<GridDimensions> => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
};

export const initializeGrid = async (rows: number, cols: number): Promise<GridData> => {
  const grid: GridData = [];
  for (let r_init = 0; r_init < rows; r_init++) {
    const row: (Tile | null)[] = new Array(cols).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = async (grid: GridData): Promise<GridData> => {
  const newGrid = grid.map(row => [...row]);
  const { rows } = await getGridDimensions(newGrid);

  for (let r_add = 0; r_add < rows; r_add++) {
    const numVisualTilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Should be 11

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
    // Ensure data array width matches visual width if they differ
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

// Helper function to determine the next coordinate in a diagonal path
const getNextCoordOnDiagonalPath = async (
    currR: number, currC: number,
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let nextR = -1, nextC = -1;
    let expectedNextOrientation: 'up' | 'down';
    const currentCellOrientation = getExpectedOrientation(currR, currC);

    if (type === 'diff') { // '\' diagonal, moving towards bottom-right
      if (currentCellOrientation === 'up') {
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        nextR = currR; nextC = currC + 1; expectedNextOrientation = 'up';
      }
    } else { // type === 'sum', '/' diagonal, moving towards bottom-left
      if (currentCellOrientation === 'up') {
        nextR = currR; nextC = currC - 1; expectedNextOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'up';
      }
    }

    if (nextR >= 0 && nextR < numGridRows && nextC >= 0 && nextC < numVisualCols) {
        if (getExpectedOrientation(nextR, nextC) === expectedNextOrientation) {
            return { r: nextR, c: nextC };
        }
    }
    return null;
};

// Helper function to determine the previous coordinate in a diagonal path
const getPrevCoordOnDiagonalPath = async (
    currR: number, currC: number,
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let prevR = -1, prevC = -1;
    let expectedPrevOrientation: 'up' | 'down';
    const currentCellOrientation = getExpectedOrientation(currR, currC);

    if (type === 'diff') { // '\' diagonal, moving towards top-left
      if (currentCellOrientation === 'up') {
        prevR = currR; prevC = currC - 1; expectedPrevOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up';
      }
    } else { // type === 'sum', '/' diagonal, moving towards top-right
      if (currentCellOrientation === 'up') {
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        prevR = currR; prevC = currC + 1; expectedPrevOrientation = 'up';
      }
    }
    
    if (prevR >= 0 && prevR < numGridRows && prevC >= 0 && prevC < numVisualCols) {
        if (getExpectedOrientation(prevR, prevC) === expectedPrevOrientation) {
            return { r: prevR, c: prevC };
        }
    }
    return null;
};


export const getTilesOnDiagonal = async (grid: GridData, startR: number, startC: number, type: DiagonalType): Promise<{r: number, c: number}[]> => {
  const { rows: numGridRows } = await getGridDimensions(grid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
  const lineCoords: {r: number, c: number}[] = [];

  // Add the starting tile itself
  if (startR >= 0 && startR < numGridRows && startC >= 0 && startC < numVisualCols) {
      lineCoords.push({ r: startR, c: startC });
  } else {
      return []; // Invalid start coordinate
  }

  // Trace forward
  let currR_fwd = startR;
  let currC_fwd = startC;
  while (true) {
    const nextCoord = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, type, numGridRows, numVisualCols);
    if (nextCoord) {
      lineCoords.push(nextCoord);
      currR_fwd = nextCoord.r;
      currC_fwd = nextCoord.c;
    } else {
      break;
    }
  }

  // Trace backward
  let currR_bwd = startR;
  let currC_bwd = startC;
  while (true) {
    const prevCoord = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, type, numGridRows, numVisualCols);
    if (prevCoord) {
      lineCoords.unshift(prevCoord); // Add to the beginning to maintain order
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
    } else {
      break;
    }
  }
  
  // Remove duplicates that might arise if startR,startC was added by both forward and backward trace (if it's a single tile line)
  // This method relies on string keys which is okay for small arrays.
  const uniqueCoordsMap = new Map<string, {r: number, c: number}>();
  lineCoords.forEach(coord => uniqueCoordsMap.set(`${coord.r},${coord.c}`, coord));
  
  const finalLineCoords = Array.from(uniqueCoordsMap.values());

  // Sort for consistent processing order by slideLine
  finalLineCoords.sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      return a.c - b.c;
  });

  return finalLineCoords;
};

export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
    const tile = grid[coord.r]?.[coord.c]; // Get tile from original grid
    return tile ? {...tile} : null; // Make a copy if it exists
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') { // Tiles move "up" or "right" along the line
      sourceTileIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      if (i === 0) isNewlySpawned = true; // New tile appears at the start of the line
    } else { // backward: Tiles move "down" or "left"
      sourceTileIndex = (i + 1) % numCellsInLine;
      if (i === numCellsInLine - 1) isNewlySpawned = true; // New tile appears at the end
    }

    let tileToPlace: Tile | null;

    if (isNewlySpawned) {
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Set orientation based on new position
        isNew: true, // It's a new tile
        isMatched: false,
      };
    } else {
      const existingTileData = originalTilesData[sourceTileIndex];
      if (existingTileData) {
        tileToPlace = {
          ...existingTileData,
          id: existingTileData.id, // Preserve ID
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Recalculate orientation for new position
          isNew: false, // Not new, it slid
          isMatched: false, // Reset matched state
        };
      } else {
        tileToPlace = null; // If source was null, target becomes null
      }
    }
    newGrid[targetCoord.r][targetCoord.c] = tileToPlace;
  }
  return newGrid;
};

export const slideRow = async (grid: GridData, rowIndex: number, direction: 'left' | 'right'): Promise<GridData> => {
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const numVisualTilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c_slide = 0; c_slide < numVisualTilesInThisRow; c_slide++) {
     rowCoords.push({ r: rowIndex, c: c_slide }); // Collect all cells, including nulls
  }
  
  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};

// Strict neighbor finding for matching.
export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows: numRows } = await getGridDimensions(grid);
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  const currentTile = grid[r]?.[c];
  if (!currentTile) {
    return []; // No tile at (r,c) to find neighbors for
  }

  const currentCanonicalOrientation = getExpectedOrientation(r, c);

  // Define potential neighbor positions relative to (r,c) and their required opposite orientation
  const neighborChecks = [
    // Horizontal Left
    { dr: 0, dc: -1, requiredOppositeOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' },
    // Horizontal Right
    { dr: 0, dc: 1, requiredOppositeOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' },
    // Vertical (depends on current tile's orientation)
    ...(currentCanonicalOrientation === 'up' ? 
      [{ dr: -1, dc: 0, requiredOppositeOrientation: 'down' as 'down' }] : // Above (must be down-pointing)
      [{ dr: 1, dc: 0, requiredOppositeOrientation: 'up' as 'up' }])     // Below (must be up-pointing)
  ];

  for (const check of neighborChecks) {
    const nr = r + check.dr;
    const nc = c + check.dc;

    // Check bounds
    if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
      const neighborTile = grid[nr]?.[nc];
      // Check if neighbor tile exists
      if (neighborTile) {
        // Check if neighbor's canonical orientation is the required opposite
        if (getExpectedOrientation(nr, nc) === check.requiredOppositeOrientation) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  let hasMatches = false;
  let totalMatchedTilesThisCycle = 0;
  const visitedOverall = new Set<string>(); // Tracks tiles already processed in any BFS

  for (let r_start = 0; r_start < numRows; r_start++) {
    for (let c_start = 0; c_start < numCols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      const startTile = newGrid[r_start]?.[c_start];

      if (!startTile || startTile.isMatched || visitedOverall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: {r: number, c: number}[] = [{r: r_start, c: c_start}];
      const componentCoords: {r: number, c: number}[] = [];
      const visitedInThisComponentSearch = new Set<string>(); 
      
      visitedInThisComponentSearch.add(startTileKey);

      while (queue.length > 0) {
        const currentPos = queue.shift()!;
        
        // Add to component and mark as visited globally *after* dequeuing and confirming it's part of this component
        componentCoords.push(currentPos);
        visitedOverall.add(`${currentPos.r},${currentPos.c}`); 

        const neighbors = await getNeighbors(currentPos.r, currentPos.c, newGrid);

        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];
          
          if (neighborTile && neighborTile.color === targetColor && !visitedInThisComponentSearch.has(neighborKey) ) {
            visitedInThisComponentSearch.add(neighborKey);
            queue.push(neighborPos);
          }
        }
      }
      
      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        let newlyMatchedInThisGroup = 0;
        componentCoords.forEach(posInMatch => {
          const tileToMark = newGrid[posInMatch.r]?.[posInMatch.c];
          if (tileToMark && !tileToMark.isMatched) { // Check !isMatched before marking
             tileToMark.isMatched = true;
             newlyMatchedInThisGroup++;
          }
        });
        if (newlyMatchedInThisGroup > 0) {
            hasMatches = true;
            totalMatchedTilesThisCycle += newlyMatchedInThisGroup;
        }
      }
    }
  }
  return { newGrid, hasMatches, matchCount: totalMatchedTilesThisCycle };
};

// DEBUG: Does not remove tiles, just passes grid through
export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  // Original line: return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
  return grid; 
};

// DEBUG: Does not apply gravity or spawn new tiles.
export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  // This function would normally handle falling tiles and spawning new ones.
  // For debug mode, we just return the grid to see highlights.
  return grid; 
  /*
  // The actual gravity and spawn logic would be more complex:
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false } : null)); // Reset isNew
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  // Gravity pass (simplified example)
  for (let c = 0; c < numCols; c++) {
    let emptySlotR = -1;
    for (let r = numRows - 1; r >= 0; r--) {
      if (newGrid[r][c] === null) {
        emptySlotR = r;
      } else if (emptySlotR !== -1) {
        newGrid[emptySlotR][c] = { ...newGrid[r][c]!, row: emptySlotR, col: c, orientation: getExpectedOrientation(emptySlotR, c), isNew: false };
        newGrid[r][c] = null;
        emptySlotR--;
      }
    }
  }

  // Spawn pass
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (newGrid[r][c] === null) {
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: getExpectedOrientation(r,c),
          isNew: true,
          isMatched: false,
        };
      }
    }
  }
  return newGrid;
  */
};

export const checkGameOver = async (grid: GridData): Promise<boolean> => {
  const { rows: numRows } = await getGridDimensions(grid);
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Using visual tiles for checks

  // Check current grid for matches (should be processed already, but as a safeguard)
  const initialCheck = await findAndMarkMatches(grid);
  if (initialCheck.hasMatches) return false;

  // Check horizontal slides for potential matches
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    // Test sliding left
    const tempGridLeft = JSON.parse(JSON.stringify(grid)); // Deep copy
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    const leftSlideMatches = await findAndMarkMatches(gridAfterLeftSlide);
    if (leftSlideMatches.hasMatches) return false;

    // Test sliding right
    const tempGridRight = JSON.parse(JSON.stringify(grid)); // Deep copy
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    const rightSlideMatches = await findAndMarkMatches(gridAfterRightSlide);
    if (rightSlideMatches.hasMatches) return false;
  }

  // Check diagonal slides for potential matches
  const checkedDiagonals = new Set<string>(); // To avoid re-checking the same diagonal
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    for (let c_diag_start = 0; c_diag_start < numCols; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        
        const lineCoords = await getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue; // Skip if line is empty or invalid

        // Create a canonical key for the line to avoid re-checking
        const canonicalLineKey = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('-');
        if (checkedDiagonals.has(canonicalLineKey)) continue;
        
        checkedDiagonals.add(canonicalLineKey);

        // Test sliding forward
        const tempGridForward = JSON.parse(JSON.stringify(grid));
        const gridAfterForwardSlide = await slideLine(tempGridForward, lineCoords, 'forward');
        const forwardSlideMatches = await findAndMarkMatches(gridAfterForwardSlide);
        if (forwardSlideMatches.hasMatches) return false;

        // Test sliding backward
        const tempGridBackward = JSON.parse(JSON.stringify(grid));
        const gridAfterBackwardSlide = await slideLine(tempGridBackward, lineCoords, 'backward');
        const backwardSlideMatches = await findAndMarkMatches(gridAfterBackwardSlide);
        if (backwardSlideMatches.hasMatches) return false;
      }
    }
  }
  // If no moves lead to a match, it's game over
  return true;
};

