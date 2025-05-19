
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

// Foundational: Defines the UP/DOWN pattern for the grid
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
    // Ensure cells outside visual bounds (if any from GRID_WIDTH_TILES being > VISUAL_TILES_PER_ROW) are null
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};


// --- Path Tracing Helpers for Diagonal Slides (Restored Known Good Logic) ---
const getNextCoordOnDiagonalPath = async (
  r: number, c: number,
  grid: GridData, // Pass grid to get current tile's actual orientation if needed
  type: DiagonalType,
  numGridRows: number,
  numVisualCols: number
): Promise<{r: number, c: number} | null> => {
  let nextR = -1, nextC = -1;
  let expectedNextOrientation: 'up' | 'down' | null = null;
  // const currentTile = grid[r]?.[c];
  // if (!currentTile) return null; // Cannot trace from an empty cell for *this* specific path logic
  const currentCellOrientation = getExpectedOrientation(r,c);


  if (type === 'sum') { // '/' diagonal, moving towards bottom-left
    if (currentCellOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentCellOrientation === 'down'
      nextR = r; nextC = c - 1; expectedNextOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards bottom-right (with "experimental swap" that worked)
    if (currentCellOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentCellOrientation === 'down'
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
  grid: GridData, // Pass grid
  type: DiagonalType,
  numGridRows: number,
  numVisualCols: number
): Promise<{r: number, c: number} | null> => {
  let prevR = -1, prevC = -1;
  let expectedPrevOrientation: 'up' | 'down' | null = null;
  // const currentTile = grid[r]?.[c];
  // if (!currentTile) return null;
  const currentCellOrientation = getExpectedOrientation(r,c);

  if (type === 'sum') { // '/' diagonal, moving towards top-right
    if (currentCellOrientation === 'up') {
      prevR = r; prevC = c + 1; expectedPrevOrientation = 'down';
    } else { // currentCellOrientation === 'down'
      prevR = r - 1; prevC = c; expectedPrevOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards top-left (with "experimental swap" that worked)
     if (currentCellOrientation === 'up') {
        prevR = r; prevC = c - 1; expectedPrevOrientation = 'down';
    } else { // currentCellOrientation === 'down'
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

  // Trace forward
  let currR_fwd = startR;
  let currC_fwd = startC;
  // Check if the starting cell itself is valid for path tracing
  if (currR_fwd >= 0 && currR_fwd < numGridRows && currC_fwd >= 0 && currC_fwd < numVisualCols) {
    lineCoords.push({ r: currR_fwd, c: currC_fwd }); // Add starting cell

    let nextCoord = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, grid, type, numGridRows, numVisualCols);
    while(nextCoord) {
      lineCoords.push(nextCoord);
      currR_fwd = nextCoord.r;
      currC_fwd = nextCoord.c;
      nextCoord = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, grid, type, numGridRows, numVisualCols);
    }
  }


  // Trace backward (excluding the start tile, which is already added)
  let currR_bwd = startR;
  let currC_bwd = startC;
  if (currR_bwd >= 0 && currR_bwd < numGridRows && currC_bwd >= 0 && currC_bwd < numVisualCols) {
    let prevCoord = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, grid, type, numGridRows, numVisualCols);
    while(prevCoord) {
      lineCoords.unshift(prevCoord); // Add to the beginning
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
      prevCoord = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, grid, type, numGridRows, numVisualCols);
    }
  }
  
  // Deduplicate (in case start tile was somehow processed weirdly, though unshift/push should avoid this)
  // and sort for consistent processing by slideLine
  const uniqueCoordsMap = new Map<string, {r: number, c: number}>();
  lineCoords.forEach(coord => uniqueCoordsMap.set(`${coord.r},${coord.c}`, coord));
  const sortedUniqueCoords = Array.from(uniqueCoordsMap.values()).sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  
  // If the line identified by path tracing is empty, but the start cell was valid,
  // it means it's an isolated cell for that diagonal type. Fallback to mathematical.
  // However, for "full row" slide, path tracing is better.
  // The above logic should return at least the start cell if it's valid.
  // If sortedUniqueCoords is still empty, it means startR, startC was out of bounds initially.
   if (sortedUniqueCoords.length === 0 && startR >= 0 && startR < numGridRows && startC >= 0 && startC < numVisualCols) {
    // This case implies the start cell is valid but has no path connections.
    // For a "full row" slide effect, we might need to revert to mathematical if path is too short.
    // For now, the path tracer should provide the most accurate "connected" line.
    // If it results in just one tile, slideLine will still operate on that one tile.
    // Let's ensure the start tile is always included if valid.
     return [{r: startR, c: startC}]; // Fallback to at least the start tile if path tracing yields nothing from a valid start.
  }


  // The path tracing might not cover the entire mathematical diagonal if there are "breaks"
  // where tile orientations don't allow connection. For a "full row slide" feel, we
  // might need to use the mathematical definition. However, the bug was about not moving full *connected* row.
  // The current path tracing is designed to find the *connected* line.
  // If the "full row" implies visual extent regardless of connection, that's different.
  // The issue description "not moving the full row" implies the connected segment is not fully captured.
  // The logic above SHOULD capture the full CONNECTED segment.

  // If the problem is that the diagonal itself isn't visually contiguous due to grid layout
  // but we still want to slide all tiles on the mathematical line:
  const mathematicalLineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;
  for (let r_iter = 0; r_iter < numGridRows; r_iter++) {
    for (let c_iter = 0; c_iter < numVisualCols; c_iter++) {
      if (type === 'sum') {
        if (r_iter + c_iter === key) {
          mathematicalLineCoords.push({ r: r_iter, c: c_iter });
        }
      } else { // type === 'diff'
        if (r_iter - c_iter === key) {
          mathematicalLineCoords.push({ r: r_iter, c: c_iter });
        }
      }
    }
  }
  mathematicalLineCoords.sort((a,b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  // For now, returning the mathematical line to ensure "full row" extent.
  // This was the logic before path tracing was introduced to fix gappy slides.
  // If path tracing is the desired "connected components" slide, then sortedUniqueCoords is better.
  // Given "not moving the full row", this implies mathematical extent.
  return mathematicalLineCoords;
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

    if (slideDirection === 'forward') { // e.g. right for rows, or "down-right/down-left" for diagonals
      const sourceIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === 0 && lineCoords.length > 0) isNewlySpawned = true; 
    } else { // backward (e.g. left for rows, or "up-left/up-right" for diagonals)
      const sourceIndex = (i + 1) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === numCellsInLine - 1 && lineCoords.length > 0) isNewlySpawned = true; 
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
          id: sourceTileData.id, // Preserve ID of existing tile
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Recalculate orientation
          isNew: false, 
          isMatched: false,
        };
      } else {
        tileToPlace = null; // Preserve empty spots if source was empty
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

// --- Fresh Matching Logic ---
export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const currentTile = grid[r]?.[c];
  if (!currentTile) return [];

  const currentOrientation = getExpectedOrientation(r, c);

  // Potential neighbor relative coordinates and their required canonical orientation for a side-share
  const potentialNeighborDefs: { dr: number, dc: number, reqOppositeOrientation: 'up' | 'down' }[] = [];

  // Horizontal Left: tile at (r, c-1) must have opposite orientation
  if (c > 0) {
    potentialNeighborDefs.push({ dr: 0, dc: -1, reqOppositeOrientation: currentOrientation === 'up' ? 'down' : 'up' });
  }
  // Horizontal Right: tile at (r, c+1) must have opposite orientation
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1) {
    potentialNeighborDefs.push({ dr: 0, dc: 1, reqOppositeOrientation: currentOrientation === 'up' ? 'down' : 'up' });
  }
  // Vertical Connection (base-to-base)
  if (currentOrientation === 'up') { // Current is UP, so vertical neighbor is (r+1,c) and must be DOWN
    if (r + 1 < GAME_SETTINGS.GRID_HEIGHT_TILES) {
      potentialNeighborDefs.push({ dr: 1, dc: 0, reqOppositeOrientation: 'down' });
    }
  } else { // Current is DOWN, so vertical neighbor is (r-1,c) and must be UP
    if (r - 1 >= 0) {
      potentialNeighborDefs.push({ dr: -1, dc: 0, reqOppositeOrientation: 'up' });
    }
  }

  for (const def of potentialNeighborDefs) {
    const nr = r + def.dr;
    const nc = c + def.dc;

    const neighborTile = grid[nr]?.[nc];
    if (neighborTile) { // Check if a tile actually exists
      const neighborActualOrientation = getExpectedOrientation(nr, nc);
      if (neighborActualOrientation === def.reqOppositeOrientation) {
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const workingGrid = grid.map(row =>
    row.map(tile => (tile ? { ...tile, isMatched: false } : null))
  );
  const { rows } = await getGridDimensions(workingGrid);
  const cols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  let hasMatches = false;
  let matchCount = 0;
  const visitedForThisCall = new Set<string>();

  for (let r_start = 0; r_start < rows; r_start++) {
    for (let c_start = 0; c_start < cols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      const startTile = workingGrid[r_start]?.[c_start];

      if (!startTile || startTile.isMatched || visitedForThisCall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: { r: number; c: number }[] = [{ r: r_start, c: c_start }];
      const componentCoords: { r: number; c: number }[] = [];
      const visitedForCurrentComponent = new Set<string>();
      visitedForCurrentComponent.add(startTileKey);

      while (queue.length > 0) {
        const currentPos = queue.shift()!;
        componentCoords.push(currentPos);
        // Important: Add to visitedForThisCall here, after processing,
        // to correctly handle components that don't form matches.
        // visitedForThisCall.add(`${currentPos.r},${currentPos.c}`);

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
      
      // After BFS for a component is done, mark all its tiles as visited for this call
      // to prevent re-processing them as start points for new BFS, even if they didn't form a match.
      for(const coord of componentCoords){
          visitedForThisCall.add(`${coord.r},${coord.c}`);
      }


      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        for (const pos of componentCoords) {
          if (workingGrid[pos.r]?.[pos.c]) {
             if(!workingGrid[pos.r][pos.c]!.isMatched) {
                 workingGrid[pos.r][pos.c]!.isMatched = true;
                 matchCount++;
             }
          }
        }
      }
    }
  }
  return { newGrid: workingGrid, hasMatches, matchCount };
};
// --- End Fresh Matching Logic ---


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
        break; 
      }
    }

    if (emptySlotR !== -1) {
      for (let r_grav_fill = emptySlotR - 1; r_grav_fill >= 0; r_grav_fill--) {
        if (newGrid[r_grav_fill][c_grav] !== null) { 
          const tileToFall = newGrid[r_grav_fill][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            id: tileToFall.id, 
            row: emptySlotR,
            col: c_grav,
            orientation: getExpectedOrientation(emptySlotR, c_grav), 
            isNew: false, 
          };
          newGrid[r_grav_fill][c_grav] = null; 
          emptySlotR--; 
          if (emptySlotR < 0) break; 
        }
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

    