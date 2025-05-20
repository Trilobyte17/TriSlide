
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

// Foundational: Defines the UP/DOWN pattern for the grid
// This is the correct version for: 12 rows, 11 triangles/row, NO horizontal offsets, alternating row orientations
const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
}

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
    // Ensure cells outside visual bounds (if any from GRID_WIDTH_TILES being > VISUAL_TILES_PER_ROW) are null
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

// --- Path Tracing Helpers for Diagonals ---
const getNextCoordOnDiagonalPath = async (
  r: number, c: number,
  currentTileOrientation: 'up' | 'down',
  type: DiagonalType,
  numGridRows: number,
  numVisualCols: number
): Promise<{r: number, c: number} | null> => {
  let nextR = -1, nextC = -1;
  let expectedNextOrientation: 'up' | 'down';

  if (type === 'sum') { // '/' diagonal, moving towards bottom-left
    if (currentTileOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      nextR = r; nextC = c - 1; expectedNextOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards bottom-right (with "experimental swap" logic)
    if (currentTileOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentTileOrientation === 'down'
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

const getPrevCoordOnDiagonalPath = async (
  r: number, c: number,
  currentTileOrientation: 'up' | 'down',
  type: DiagonalType,
  numGridRows: number,
  numVisualCols: number
): Promise<{r: number, c: number} | null> => {
  let prevR = -1, prevC = -1;
  let expectedPrevOrientation: 'up' | 'down';

  if (type === 'sum') { // '/' diagonal, moving towards top-right
    if (currentTileOrientation === 'up') {
      prevR = r; prevC = c + 1; expectedPrevOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      prevR = r - 1; prevC = c; expectedPrevOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards top-left (with "experimental swap" logic)
    if (currentTileOrientation === 'up') {
      prevR = r; prevC = c - 1; expectedPrevOrientation = 'down';
    } else { // currentTileOrientation === 'down'
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
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Should be 11

  const lineCoords: {r: number, c: number}[] = [];
  
  // Add starting tile if it exists (it should, as drag starts on a tile)
  // We add all cells on the path, even if they are null, to represent the full line.
  lineCoords.push({ r: startR, c: startC });

  // Trace "forward"
  let currR_fwd = startR;
  let currC_fwd = startC;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const currentCellOrientation = getExpectedOrientation(currR_fwd, currC_fwd);
    const nextPos = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, currentCellOrientation, type, numGridRows, numVisualCols);
    if (nextPos) {
      lineCoords.push(nextPos);
      currR_fwd = nextPos.r;
      currC_fwd = nextPos.c;
    } else {
      break;
    }
  }

  // Trace "backward"
  let currR_bwd = startR;
  let currC_bwd = startC;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const currentCellOrientation = getExpectedOrientation(currR_bwd, currC_bwd);
    const prevPos = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, currentCellOrientation, type, numGridRows, numVisualCols);
    if (prevPos) {
      lineCoords.unshift(prevPos); // Add to the beginning
      currR_bwd = prevPos.r;
      currC_bwd = prevPos.c;
    } else {
      break;
    }
  }
  
  // Sort for consistent processing order by slideLine - essential for slideLine logic
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
      if (i === 0 && lineCoords.length > 0) isNewlySpawned = true; // Spawn at the "entry" point
    } else { // backward
      const sourceIndex = (i + 1) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === numCellsInLine - 1 && lineCoords.length > 0) isNewlySpawned = true; // Spawn at the "entry" point
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
          ...sourceTileData,
          id: sourceTileData.id, // Preserve ID for existing tiles
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Crucial: update orientation based on new position
          isNew: false, // It's an existing tile being moved
          isMatched: false,
        };
      } else {
        tileToPlace = null; // Preserve empty spots
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

// --- Matching Logic (Fresh Start) ---
export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const currentTile = grid[r]?.[c];
  if (!currentTile) return []; // No tile at (r,c)

  const currentOrientation = getExpectedOrientation(r, c);

  // Array of potential neighbor configurations: {dr, dc, requiredOppositeOrientation}
  const potentialSideSharingConfigs: { dr: number; dc: number; reqOppositeOrientation: 'up' | 'down'; }[] = [];

  // Horizontal Left
  potentialSideSharingConfigs.push({ dr: 0, dc: -1, reqOppositeOrientation: currentOrientation === 'up' ? 'down' : 'up' });
  // Horizontal Right
  potentialSideSharingConfigs.push({ dr: 0, dc: 1, reqOppositeOrientation: currentOrientation === 'up' ? 'down' : 'up' });
  
  // Vertical (Base-to-Base)
  if (currentOrientation === 'up') { // Current is UP, its base is at the bottom, shares with a DOWN tile below it
    potentialSideSharingConfigs.push({ dr: 1, dc: 0, reqOppositeOrientation: 'down' });
  } else { // Current is DOWN, its base is at the top, shares with an UP tile above it
    potentialSideSharingConfigs.push({ dr: -1, dc: 0, reqOppositeOrientation: 'up' });
  }

  for (const config of potentialSideSharingConfigs) {
    const nr = r + config.dr;
    const nc = c + config.dc;

    if (nr >= 0 && nr < GAME_SETTINGS.GRID_HEIGHT_TILES && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile) { // Check if a tile exists at the potential neighbor position
        const neighborCanonicalOrientation = getExpectedOrientation(nr, nc);
        if (neighborCanonicalOrientation === config.reqOppositeOrientation) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const workingGrid = grid.map(row =>
    row.map(tile => (tile ? { ...tile, isMatched: false } : null)) // Reset isMatched, preserve isNew
  );
  const { rows } = await getGridDimensions(workingGrid);
  const cols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  let hasMatches = false;
  let matchCount = 0;
  const visitedForThisCall = new Set<string>(); // Tracks "r,c" for tiles processed in *any* BFS during this call

  for (let r_start = 0; r_start < rows; r_start++) {
    for (let c_start = 0; c_start < cols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      const startTile = workingGrid[r_start]?.[c_start];

      // If no tile, or already matched in this pass, or already processed by a previous BFS in this call, skip.
      if (!startTile || startTile.isMatched || visitedForThisCall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: { r: number; c: number }[] = [{ r: r_start, c: c_start }];
      const componentCoords: { r: number; c: number }[] = [];
      // visitedForCurrentComponent tracks tiles for the component being built by *this specific BFS*
      const visitedForCurrentComponent = new Set<string>();
      visitedForCurrentComponent.add(startTileKey);

      while (queue.length > 0) {
        const currentPos = queue.shift()!;
        componentCoords.push(currentPos);
        // Add to global visited set *after* taking it from queue and adding to current component
        visitedForThisCall.add(`${currentPos.r},${currentPos.c}`); 

        const neighbors = await getNeighbors(currentPos.r, currentPos.c, workingGrid);
        for (const neighborPos of neighbors) {
          const neighborTile = workingGrid[neighborPos.r]?.[neighborPos.c];
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;

          if ( neighborTile &&
               neighborTile.color === targetColor &&
               !visitedForCurrentComponent.has(neighborKey) ) {
            visitedForCurrentComponent.add(neighborKey);
            queue.push(neighborPos);
          }
        }
      }

      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        for (const pos of componentCoords) {
          const tileToMark = workingGrid[pos.r]?.[pos.c];
          if (tileToMark && !tileToMark.isMatched) { 
            tileToMark.isMatched = true;
            matchCount++;
          }
        }
      }
    }
  }
  return { newGrid: workingGrid, hasMatches, matchCount };
};


// --- Game State Management ---

export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c_grav = 0; c_grav < numVisualCols; c_grav++) {
    let emptySlotR = -1;
    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      if (newGrid[r_grav][c_grav] === null) {
        emptySlotR = r_grav;
        // Continue searching upwards in the same column to find the *highest* tile that can fall into this specific emptySlotR later.
        // No, this is wrong. Find the *lowest* empty slot first.
        break; 
      }
    }

    if (emptySlotR !== -1) { // If there's an empty slot in this column
      // Start from just above the empty slot and pull down tiles
      for (let r_grav_fill = emptySlotR - 1; r_grav_fill >= 0; r_grav_fill--) {
        if (newGrid[r_grav_fill][c_grav] !== null) {
          const tileToFall = newGrid[r_grav_fill][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            id: tileToFall.id, // Preserve ID
            row: emptySlotR,
            col: c_grav,
            orientation: getExpectedOrientation(emptySlotR, c_grav), // Recalculate orientation
            isNew: false, // Not new, it fell
          };
          newGrid[r_grav_fill][c_grav] = null; // Vacate the original spot
          emptySlotR--; // The new lowest empty slot is now one row above
          if (emptySlotR < 0) break; // No more empty slots above this point in the column
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
          orientation: getExpectedOrientation(r_spawn, c_spawn), // Set orientation for new tile
          isNew: true, // It's a new tile
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
  if (initialCheckHasMatches) return false; // Should not happen if called after processing

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
        // Using path tracing for getTilesOnDiagonal to define the line
        const lineCoords = await getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue;
        
        // Create a canonical key for the line based on its sorted coordinates to avoid redundant checks
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

    