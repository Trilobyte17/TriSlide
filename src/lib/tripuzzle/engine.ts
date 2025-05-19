
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

// Foundational function for grid geometry
const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
}

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

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
    // Ensure cells outside visual bounds (if any from GRID_WIDTH_TILES) are null
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

// --- Path Tracing Helpers for Diagonal Slides ---
const getNextCoordOnDiagonalPath = (r: number, c: number, currentCellOrientation: 'up' | 'down', type: DiagonalType, numGridRows: number, numVisualCols: number): {r: number, c: number} | null => {
  let nextR = -1, nextC = -1;
  let expectedNextOrientation: 'up' | 'down' | null = null;

  if (type === 'sum') { // '/' diagonal, moving towards bottom-left
    if (currentCellOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentCellOrientation === 'down'
      nextR = r; nextC = c - 1; expectedNextOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards bottom-right (with experimental swap)
    if (currentCellOrientation === 'up') {
      // Experimental swap: if UP, next step along '\' is (r+1,c) and must be DOWN
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentCellOrientation === 'down'
      // Experimental swap: if DOWN, next step along '\' is (r,c+1) and must be UP
      nextR = r; nextC = c + 1; expectedNextOrientation = 'up';
    }
  }

  if (nextR >= 0 && nextR < numGridRows && nextC >= 0 && nextC < numVisualCols) {
    if (getExpectedOrientation(nextR, nextC) === expectedNextOrientation) {
      return { r: nextR, c: nextC };
    }
  }
  return null;
};

const getPrevCoordOnDiagonalPath = (r: number, c: number, currentCellOrientation: 'up' | 'down', type: DiagonalType, numGridRows: number, numVisualCols: number): {r: number, c: number} | null => {
  let prevR = -1, prevC = -1;
  let expectedPrevOrientation: 'up' | 'down' | null = null;

  if (type === 'sum') { // '/' diagonal, moving towards top-right
    if (currentCellOrientation === 'up') {
      prevR = r; prevC = c + 1; expectedPrevOrientation = 'down';
    } else { // currentCellOrientation === 'down'
      prevR = r - 1; prevC = c; expectedPrevOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards top-left (with experimental swap)
     if (currentCellOrientation === 'up') {
        // Experimental swap: if UP, prev step along '\' is (r,c-1) and must be DOWN
        prevR = r; prevC = c - 1; expectedPrevOrientation = 'down';
    } else { // currentCellOrientation === 'down'
        // Experimental swap: if DOWN, prev step along '\' is (r-1,c) and must be UP
        prevR = r - 1; prevC = c; expectedPrevOrientation = 'up';
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

  if (startR < 0 || startR >= numGridRows || startC < 0 || startC >= numVisualCols) {
    return []; // Start point is out of bounds
  }
  
  lineCoords.push({ r: startR, c: startC });

  // Trace forward
  let currR_fwd = startR;
  let currC_fwd = startC;
  while (true) {
    const currentOrientation = getExpectedOrientation(currR_fwd, currC_fwd);
    const nextCoord = getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, currentOrientation, type, numGridRows, numVisualCols);
    if (nextCoord && !lineCoords.some(lc => lc.r === nextCoord.r && lc.c === nextCoord.c)) {
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
    const currentOrientation = getExpectedOrientation(currR_bwd, currC_bwd);
    const prevCoord = getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, currentOrientation, type, numGridRows, numVisualCols);
    if (prevCoord && !lineCoords.some(lc => lc.r === prevCoord.r && lc.c === prevCoord.c)) {
      lineCoords.unshift(prevCoord); // Add to the beginning
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
    } else {
      break;
    }
  }
  
  lineCoords.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  return lineCoords;
};


export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const numCellsInLine = lineCoords.length;
  
  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
      const tileAtCoord = grid[coord.r]?.[coord.c]; // Use original grid to get tile data
      return tileAtCoord ? {...tileAtCoord} : null; 
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileData: Tile | null;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') {
      const sourceIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === 0) isNewlySpawned = true; 
    } else { // backward
      const sourceIndex = (i + 1) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === numCellsInLine - 1) isNewlySpawned = true; 
    }
    
    let tileToPlace: Tile | null;
    if (isNewlySpawned) {
      const isDiagonalSlide = !lineCoords.every(coord => coord.r === lineCoords[0].r);
      const virtualCol = slideDirection === 'forward' ? 
        (isDiagonalSlide ? -1 : targetCoord.c) : 
        (isDiagonalSlide ? numCellsInLine : targetCoord.c);
      
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, virtualCol),
        isNew: true,
        isMatched: false,
      };
    } else {
      if (sourceTileData) {
        tileToPlace = {
          ...sourceTileData, // Keep existing tile data (like ID, color)
          row: targetCoord.r, // Update position
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Update orientation for new position
          isNew: false, 
          isMatched: false, // Ensure not marked from previous state
        };
      } else {
        tileToPlace = null; // If source was null, target remains null (empty space slides)
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


// --- Matching Logic ---
export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows: numGridRows } = await getGridDimensions(grid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  const currentTile = grid[r]?.[c];
  if (!currentTile) return []; // No tile at (r,c) to find neighbors for

  const currentOrientation = getExpectedOrientation(r, c);

  // Potential neighbor configurations: [dr, dc, requiredNeighborOrientation]
  // For horizontal, requiredNeighborOrientation is opposite to current.
  // For vertical, it's specific (UP connects to DOWN below, DOWN connects to UP above).
  const neighborConfigs: { dr: number, dc: number, reqOrientation?: 'up' | 'down' }[] = [];

  // Horizontal Left
  neighborConfigs.push({ dr: 0, dc: -1 });
  // Horizontal Right
  neighborConfigs.push({ dr: 0, dc: 1 });
  
  // Vertical
  if (currentOrientation === 'up') {
    neighborConfigs.push({ dr: 1, dc: 0, reqOrientation: 'down' }); // UP connects to DOWN below it
  } else { // currentOrientation === 'down'
    neighborConfigs.push({ dr: -1, dc: 0, reqOrientation: 'up' });   // DOWN connects to UP above it
  }

  for (const config of neighborConfigs) {
    const nr = r + config.dr;
    const nc = c + config.dc;

    // Check bounds
    if (nr >= 0 && nr < numGridRows && nc >= 0 && nc < numVisualCols) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile) { // Check if a tile exists at the neighbor position
        const neighborOrientation = getExpectedOrientation(nr, nc);
        // Horizontal check: orientations must be opposite
        if (config.dr === 0 && neighborOrientation !== currentOrientation) {
          neighbors.push({ r: nr, c: nc });
        }
        // Vertical check: orientations must match specific requirement
        else if (config.dc === 0 && config.reqOrientation && neighborOrientation === config.reqOrientation) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => 
    row.map(tile => tile ? { ...tile, isMatched: false } : null) // Preserve isNew, only reset isMatched
  );
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
  let hasMatches = false;
  let totalMatchedTiles = 0;
  
  const visitedOverall = new Set<string>(); // Tracks "r,c" for tiles already processed in any BFS

  for (let r_start = 0; r_start < numRows; r_start++) {
    for (let c_start = 0; c_start < numVisualCols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      if (visitedOverall.has(startTileKey)) {
        continue;
      }

      const startTile = newGrid[r_start]?.[c_start];
      if (!startTile) { // No tile or already processed tile
        visitedOverall.add(startTileKey); // Mark as processed even if null
        continue;
      }

      const targetColor = startTile.color;
      const queue: { r: number, c: number }[] = [{ r: r_start, c: c_start }];
      const componentCoords: { r: number, c: number }[] = [];
      const visitedInThisBFS = new Set<string>(); // Tracks "r,c" for tiles in current BFS
      
      visitedInThisBFS.add(startTileKey);
      
      while (queue.length > 0) {
        const currentPos = queue.shift()!;
        componentCoords.push(currentPos);
        
        const neighbors = await getNeighbors(currentPos.r, currentPos.c, newGrid);
        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];

          if (neighborTile && 
              neighborTile.color === targetColor && 
              !visitedInThisBFS.has(neighborKey)) {
            visitedInThisBFS.add(neighborKey);
            queue.push(neighborPos);
          }
        }
      }
      
      // After exploring the component, add all its tiles to visitedOverall
      visitedInThisBFS.forEach(key => visitedOverall.add(key));

      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        componentCoords.forEach(pos => {
          const tileToMark = newGrid[pos.r]?.[pos.c];
          if (tileToMark && !tileToMark.isMatched) { 
             tileToMark.isMatched = true;
             totalMatchedTiles++;
          }
        });
      }
    }
  }
  return { newGrid, hasMatches, matchCount: totalMatchedTiles };
};


export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  // Debug mode: Keep matched tiles for inspection, but ensure their isMatched is false for next round
  // return grid.map(row => row.map(tile => tile ? {...tile, isMatched: tile.isMatched ? false : false} : null ));

  // Normal mode:
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  // Gravity pass: Iterate columns, then rows from bottom up
  for (let c_grav = 0; c_grav < numVisualCols; c_grav++) {
    let emptySlotR = -1; // Tracks the lowest empty slot found in the current column
    
    // Find the lowest empty slot in this column
    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      if (newGrid[r_grav][c_grav] === null) {
        emptySlotR = r_grav;
        break; // Found the lowest empty slot, move to filling it
      }
    }

    // If an empty slot was found, try to fill it from above
    if (emptySlotR !== -1) {
      for (let r_grav_fill = emptySlotR - 1; r_grav_fill >= 0; r_grav_fill--) {
        if (newGrid[r_grav_fill][c_grav] !== null) { // If there's a tile above
          const tileToFall = newGrid[r_grav_fill][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            id: tileToFall.id, 
            row: emptySlotR,
            col: c_grav,
            orientation: getExpectedOrientation(emptySlotR, c_grav), 
            isNew: false, 
          };
          newGrid[r_grav_fill][c_grav] = null; // Vacate the original spot
          emptySlotR--; // Move to the next empty slot above
          if (emptySlotR < 0) break; // Column is filled from this point up
        }
      }
    }
  }

  // Spawn pass: Fill remaining nulls from the top
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


export const checkGameOver = async (grid: GridData): Promise<boolean> => {
  const { rows: numRows } = await getGridDimensions(grid);

  const { hasMatches: initialCheckHasMatches } = await findAndMarkMatches(grid);
  if (initialCheckHasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    let tempGridLeft = JSON.parse(JSON.stringify(grid));
    tempGridLeft = await slideRow(tempGridLeft, r_slide, 'left');
    const { hasMatches: leftSlideHasMatches } = await findAndMarkMatches(tempGridLeft);
    if (leftSlideHasMatches) return false;

    let tempGridRight = JSON.parse(JSON.stringify(grid));
    tempGridRight = await slideRow(tempGridRight, r_slide, 'right');
    const { hasMatches: rightSlideHasMatches } = await findAndMarkMatches(tempGridRight);
    if (rightSlideHasMatches) return false;
  }
  
  const checkedDiagonals = new Set<string>(); 
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    for (let c_diag_start = 0; c_diag_start < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        const lineCoords = await getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue;
        
        const canonicalLineKeyCoords = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('|');
        const canonicalLineKey = `${type}-${canonicalLineKeyCoords}`;

        if (checkedDiagonals.has(canonicalLineKey)) continue;
        checkedDiagonals.add(canonicalLineKey);

        let tempGridForward = JSON.parse(JSON.stringify(grid));
        tempGridForward = await slideLine(tempGridForward, lineCoords, 'forward');
        const { hasMatches: forwardSlideHasMatches } = await findAndMarkMatches(tempGridForward);
        if (forwardSlideHasMatches) return false;

        let tempGridBackward = JSON.parse(JSON.stringify(grid));
        tempGridBackward = await slideLine(tempGridBackward, lineCoords, 'backward');
        const { hasMatches: backwardSlideHasMatches } = await findAndMarkMatches(tempGridBackward);
        if (backwardSlideHasMatches) return false;
      }
    }
  }
  return true;
};
