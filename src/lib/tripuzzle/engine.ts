
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, ...)
    return c % 2 === 0 ? 'up' : 'down'; // UP, DOWN, UP...
  } else { // Odd rows (1, 3, ...)
    return c % 2 === 0 ? 'down' : 'up'; // DOWN, UP, DOWN...
  }
};

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = async (grid: GridData): Promise<GridDimensions> => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Should be GAME_SETTINGS.GRID_WIDTH_TILES
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

export const addInitialTiles = async (gridData: GridData): Promise<GridData> => {
  const newGrid = gridData.map(row => [...row]); // Operate on a copy
  const { rows } = await getGridDimensions(newGrid);

  for (let r_add = 0; r_add < rows; r_add++) {
    const numVisualTilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Always 11 for this layout
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
    // Ensure cells outside visual bounds are null if GRID_WIDTH_TILES > VISUAL_TILES_PER_ROW
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};


const getNextCoordOnDiagonalPath = (r: number, c: number, currentCellOrientation: 'up' | 'down', type: DiagonalType, numGridRows: number, numVisualCols: number): {r: number, c: number} | null => {
  let nextR = -1, nextC = -1;
  let expectedNextCellOrientation: 'up' | 'down' | null = null;

  if (type === 'diff') { // '\' diagonal, moving towards bottom-right
    if (currentCellOrientation === 'up') { // Current is UP, next step is horizontal
      nextR = r; nextC = c + 1; expectedNextCellOrientation = 'down';
    } else { // currentCellOrientation === 'down', next step is vertical
      nextR = r + 1; nextC = c; expectedNextCellOrientation = 'up';
    }
  } else { // type === 'sum', '/' diagonal, moving towards bottom-left
    if (currentCellOrientation === 'up') { // Current is UP, next step is vertical
      nextR = r + 1; nextC = c; expectedNextCellOrientation = 'down';
    } else { // currentCellOrientation === 'down', next step is horizontal
      nextR = r; nextC = c - 1; expectedNextCellOrientation = 'up';
    }
  }

  if (nextR >= 0 && nextR < numGridRows && nextC >= 0 && nextC < numVisualCols) {
    if (getExpectedOrientation(nextR, nextC) === expectedNextCellOrientation) {
      return { r: nextR, c: nextC };
    }
  }
  return null;
};

const getPrevCoordOnDiagonalPath = (r: number, c: number, currentCellOrientation: 'up' | 'down', type: DiagonalType, numGridRows: number, numVisualCols: number): {r: number, c: number} | null => {
  let prevR = -1, prevC = -1;
  let expectedPrevCellOrientation: 'up' | 'down' | null = null;

  if (type === 'diff') { // '\' diagonal, moving towards top-left
     // This was the "experimental swap" logic that worked for 'diff'
    if (currentCellOrientation === 'up') { // Current is UP, prev step is horizontal
      prevR = r; prevC = c - 1; expectedPrevCellOrientation = 'down';
    } else { // currentCellOrientation === 'down', prev step is vertical
      prevR = r - 1; prevC = c; expectedPrevCellOrientation = 'up';
    }
  } else { // type === 'sum', '/' diagonal, moving towards top-right
    if (currentCellOrientation === 'up') { // Current is UP, prev step is vertical
      prevR = r - 1; prevC = c; expectedPrevCellOrientation = 'down';
    } else { // currentCellOrientation === 'down', prev step is horizontal
      prevR = r; prevC = c + 1; expectedPrevCellOrientation = 'up';
    }
  }

  if (prevR >= 0 && prevR < numGridRows && prevC >= 0 && prevC < numVisualCols) {
    if (getExpectedOrientation(prevR, prevC) === expectedPrevCellOrientation) {
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
    return []; // Start point out of bounds
  }
  
  // Always add the start tile
  lineCoords.push({ r: startR, c: startC });

  // Trace forward
  let currR_fwd = startR;
  let currC_fwd = startC;
  while (true) {
    const currentOrientation = getExpectedOrientation(currR_fwd, currC_fwd);
    const nextCoord = getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, currentOrientation, type, numGridRows, numVisualCols);
    if (nextCoord && !lineCoords.some(lc => lc.r === nextCoord.r && lc.c === nextCoord.c)) { // Check if already added
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
    if (prevCoord && !lineCoords.some(lc => lc.r === prevCoord.r && lc.c === prevCoord.c)) { // Check if already added
      lineCoords.unshift(prevCoord); // Add to the beginning
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
    } else {
      break;
    }
  }
  
  // Sort for consistent processing order by slideLine, especially important if tracing from middle
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
  
  // Store original tiles from the input grid (not newGrid, which has isNew reset)
  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
      const tile = grid[coord.r]?.[coord.c];
      return tile ? {...tile} : null; // Make a copy
  });


  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileData: Tile | null;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') {
      const sourceIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === 0) isNewlySpawned = true; // Tile moving in from wrap-around at the start of the line
    } else { // backward
      const sourceIndex = (i + 1) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === numCellsInLine - 1) isNewlySpawned = true; // Tile moving in from wrap-around at the end of the line
    }
    
    let tileToPlace: Tile | null;
    if (isNewlySpawned) {
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
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
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Recalculate orientation based on new position
          isNew: false, 
          isMatched: false,
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
     rowCoords.push({ r: rowIndex, c: c_slide }); // Collect all cells
  }
  
  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows: numGridRows } = await getGridDimensions(grid); // numGridRows is 12
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // is 11

  const currentTile = grid[r]?.[c];
  if (!currentTile) return []; // No tile at (r,c) to get neighbors for

  const currentExpectedOrientation = getExpectedOrientation(r,c);

  // 1. Horizontal Left Neighbor (r, c-1)
  if (c > 0) {
    const nr = r;
    const nc = c - 1;
    if (grid[nr]?.[nc] && getExpectedOrientation(nr, nc) !== currentExpectedOrientation) {
      neighbors.push({ r: nr, c: nc });
    }
  }

  // 2. Horizontal Right Neighbor (r, c+1)
  if (c < numVisualCols - 1) {
    const nr = r;
    const nc = c + 1;
    if (grid[nr]?.[nc] && getExpectedOrientation(nr, nc) !== currentExpectedOrientation) {
      neighbors.push({ r: nr, c: nc });
    }
  }

  // 3. Vertical Neighbor (Base-to-Base Connection)
  if (currentExpectedOrientation === 'up') {
    // UP tile connects to DOWN tile below it
    const nr = r + 1;
    const nc = c;
    if (nr < numGridRows && grid[nr]?.[nc] && getExpectedOrientation(nr, nc) === 'down') {
      neighbors.push({ r: nr, c: nc });
    }
  } else { // currentExpectedOrientation === 'down'
    // DOWN tile connects to UP tile above it
    const nr = r - 1;
    const nc = c;
    if (nr >= 0 && grid[nr]?.[nc] && getExpectedOrientation(nr, nc) === 'up') {
      neighbors.push({ r: nr, c: nc });
    }
  }
  
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false } : null)); // Preserve isNew, only reset isMatched
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
  let hasMatches = false;
  let matchCount = 0;
  const visitedOverall = new Set<string>(); // Tracks tiles that have been part of any component search

  for (let r_start = 0; r_start < numRows; r_start++) {
    for (let c_start = 0; c_start < numVisualCols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      const startTile = newGrid[r_start]?.[c_start];

      if (!startTile || startTile.isMatched || visitedOverall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: { r: number, c: number }[] = [{ r: r_start, c: c_start }];
      const componentCoords: { r: number, c: number }[] = [];
      const visitedInThisComponentSearch = new Set<string>(); 
      visitedInThisComponentSearch.add(startTileKey);
      
      let head = 0;
      while(head < queue.length) {
        const currentPos = queue[head++];
        // Only add to componentCoords if it hasn't been added by another path in this BFS
        // (though BFS structure usually handles this via visitedInThisComponentSearch for queueing)
        if (!componentCoords.some(p => p.r === currentPos.r && p.c === currentPos.c)) {
             componentCoords.push(currentPos);
        }
        // All tiles in visitedInThisComponentSearch are considered part of this component search globally
        visitedOverall.add(`${currentPos.r},${currentPos.c}`);


        const neighbors = await getNeighbors(currentPos.r, currentPos.c, newGrid);
        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];

          if (neighborTile && neighborTile.color === targetColor && !visitedInThisComponentSearch.has(neighborKey)) {
             visitedInThisComponentSearch.add(neighborKey);
             queue.push(neighborPos);
          }
        }
      }
      
      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        componentCoords.forEach(pos => {
          const tileToMark = newGrid[pos.r]?.[pos.c];
          if (tileToMark && !tileToMark.isMatched) { // Check if not already marked by another overlapping match group in same findAndMarkMatches call
             tileToMark.isMatched = true;
             matchCount++;
          }
        });
      }
      // All tiles explored in this specific BFS (whether part of a match or not) are marked globally visited.
      // This was moved inside the BFS loop, but also ensure all in componentCoords are globally visited.
      componentCoords.forEach(pos => visitedOverall.add(`${pos.r},${pos.c}`));
    }
  }
  return { newGrid, hasMatches, matchCount };
};

export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  return grid.map(row => row.map(tile => {
    if (tile && tile.isMatched) {
      return null;
    }
    // Ensure non-matched tiles are not marked isNew from previous animations, unless they truly are new from a spawn
    return tile ? {...tile, isNew: tile.isNew === true && !tile.isMatched ? true : false} : null; 
  }));
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
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

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
    for (let c_diag_start = 0; c_diag_start < numVisualCols; c_diag_start++) {
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

    