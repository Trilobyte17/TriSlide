
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

// Local helper, not exported, so doesn't need to be async itself
const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // For 12 rows, 11 triangles/row, no horizontal offsets
  // Even rows (0-indexed): UP, DOWN, UP...
  // Odd rows (1-indexed): DOWN, UP, DOWN...
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
    // Ensure data array width matches visual width (GRID_WIDTH_TILES should be same as VISUAL_TILES_PER_ROW)
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

const getNextCoordOnDiagonalPath = async (
    currR: number, currC: number,
    currentTileOrientation: 'up' | 'down',
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let nextR = -1, nextC = -1;
    let expectedNextOrientation: 'up' | 'down';

    if (type === 'sum') { // '/' diagonal, moving towards bottom-left
      if (currentTileOrientation === 'up') {
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
      } else { // currentTileOrientation === 'down'
        nextR = currR; nextC = currC - 1; expectedNextOrientation = 'up';
      }
    } else { // type === 'diff', "experimental swap" logic
      if (currentTileOrientation === 'up') {
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down'; // Was (r, c+1)
      } else { // currentTileOrientation === 'down'
        nextR = currR; nextC = currC + 1; expectedNextOrientation = 'up'; // Was (r+1, c)
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
    currR: number, currC: number,
    currentTileOrientation: 'up' | 'down',
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let prevR = -1, prevC = -1;
    let expectedPrevOrientation: 'up' | 'down';

    if (type === 'sum') { // '/' diagonal, moving towards top-right
      if (currentTileOrientation === 'up') {
        prevR = currR; prevC = currC + 1; expectedPrevOrientation = 'down';
      } else { // currentTileOrientation === 'down'
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up';
      }
    } else { // type === 'diff', "experimental swap" logic
      if (currentTileOrientation === 'up') {
        prevR = currR; prevC = currC - 1; expectedPrevOrientation = 'down';// Was (r-1,c)
      } else { // currentTileOrientation === 'down'
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up'; // Was (r,c-1)
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

  // Start by adding the initial cell, whether it has a tile or not, for slideLine to process
  if (startR >= 0 && startR < numGridRows && startC >= 0 && startC < numVisualCols) {
    lineCoords.push({ r: startR, c: startC });
  } else {
    return []; // Invalid start coordinate
  }

  // Trace forward
  let currR_fwd = startR;
  let currC_fwd = startC;
  while (true) {
    const currentCellOrientation = getExpectedOrientation(currR_fwd, currC_fwd); // Orientation of the cell
    const nextCoord = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, currentCellOrientation, type, numGridRows, numVisualCols);
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
    const currentCellOrientation = getExpectedOrientation(currR_bwd, currC_bwd); // Orientation of the cell
    const prevCoord = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, currentCellOrientation, type, numGridRows, numVisualCols);
    if (prevCoord) {
      lineCoords.unshift(prevCoord); 
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
    } else {
      break;
    }
  }
  
  const uniqueCoordsMap = new Map<string, {r: number, c: number}>();
  lineCoords.forEach(coord => uniqueCoordsMap.set(`${coord.r},${coord.c}`, coord));
  
  const finalLineCoords = Array.from(uniqueCoordsMap.values());
  finalLineCoords.sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      return a.c - b.c;
  });

  return finalLineCoords;
};

export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile} : null)); // Deep copy
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
    const tile = grid[coord.r]?.[coord.c]; 
    return tile ? {...tile} : null; 
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') { 
      sourceTileIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      if (i === 0) isNewlySpawned = true; 
    } else { // backward
      sourceTileIndex = (i + 1) % numCellsInLine;
      if (i === numCellsInLine - 1) isNewlySpawned = true; 
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
      const existingTileData = originalTilesData[sourceTileIndex];
      if (existingTileData) {
        tileToPlace = {
          ...existingTileData,
          id: existingTileData.id, 
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), 
          isNew: false, 
          isMatched: false, 
        };
      } else {
        tileToPlace = null; 
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
     rowCoords.push({ r: rowIndex, c: c_slide }); 
  }
  
  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const tileAtRC = grid[r]?.[c];

  if (!tileAtRC) {
    return []; 
  }

  const currentCanonicalOrientation = getExpectedOrientation(r, c);

  // Define specific neighbor checks based on strict side-sharing
  const checks = [
    // Horizontal Left: Tile at (r, c-1)
    { nr: r, nc: c - 1 },
    // Horizontal Right: Tile at (r, c+1)
    { nr: r, nc: c + 1 },
    // Vertical: Tile at (r-1, c) if current is UP, or (r+1, c) if current is DOWN
    { nr: (currentCanonicalOrientation === 'up' ? r - 1 : r + 1), nc: c }
  ];

  for (const check of checks) {
    const { nr, nc } = check;

    // Check bounds
    if (nr >= 0 && nr < GAME_SETTINGS.GRID_HEIGHT_TILES && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile) { 
        const neighborCanonicalOrientation = getExpectedOrientation(nr, nc);
        // For side-sharing, orientations must be opposite
        if (neighborCanonicalOrientation !== currentCanonicalOrientation) {
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
  let totalMatchedTilesThisCycle = 0; // Use a cycle-specific counter
  const visited = new Set<string>(); // Tracks all cells visited in any BFS for this findAndMarkMatches call

  for (let r_start = 0; r_start < numRows; r_start++) {
    for (let c_start = 0; c_start < numCols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      if (visited.has(startTileKey)) {
        continue;
      }

      const startTile = newGrid[r_start]?.[c_start];
      
      if (!startTile || startTile.isMatched) { // If no tile, or already part of a previously found match in this cycle
        visited.add(startTileKey);
        continue;
      }

      const targetColor = startTile.color;
      const currentMatchGroup: {r: number, c: number}[] = [];
      const queue: {r: number, c: number}[] = [];
      
      // Start BFS from this tile
      queue.push({r: r_start, c: c_start});
      visited.add(startTileKey); // Mark as visited before adding to queue or group
      
      let head = 0;
      while(head < queue.length) {
        const {r: currR, c: currC} = queue[head++];
        currentMatchGroup.push({r: currR, c: currC}); // Add to current group

        const neighbors = await getNeighbors(currR, currC, newGrid); // Use newGrid to check neighbors against current state

        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          if (visited.has(neighborKey)) {
            continue; 
          }

          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];

          if (neighborTile && !neighborTile.isMatched && neighborTile.color === targetColor) {
            visited.add(neighborKey); // Mark as visited
            queue.push(neighborPos);
          } else if (!visited.has(neighborKey)) { 
            // If neighbor cell is empty or different color & not visited, mark visited to avoid re-processing
            visited.add(neighborKey);
          }
        }
      }
      
      if (currentMatchGroup.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        currentMatchGroup.forEach(posInMatch => {
          const tileToMark = newGrid[posInMatch.r]?.[posInMatch.c];
          if (tileToMark && !tileToMark.isMatched) { // Check if not already marked by another overlapping match in this cycle
             tileToMark.isMatched = true;
             totalMatchedTilesThisCycle++;
          }
        });
      }
    }
  }
  return { newGrid, hasMatches, matchCount: totalMatchedTilesThisCycle };
};

export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows } = await getGridDimensions(newGrid);

  for (let c_grav = 0; c_grav < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_grav++) {
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
    for (let c_spawn = 0; c_spawn < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_spawn++) {
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

  let { hasMatches: initialMatches } = await findAndMarkMatches(grid);
  if (initialMatches) return false; 

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid)); 
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    let { hasMatches: leftSlideMatches } = await findAndMarkMatches(gridAfterLeftSlide);
    if (leftSlideMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid)); 
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    let { hasMatches: rightSlideMatches } = await findAndMarkMatches(gridAfterRightSlide);
    if (rightSlideMatches) return false;
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    for (let c_diag = 0; c_diag < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        
        const currentLineCoords = await getTilesOnDiagonal(grid, r_diag, c_diag, type);
        if (currentLineCoords.length < 1) continue; 

        const canonicalLineKey = currentLineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('-');
        if (checkedDiagonals.has(canonicalLineKey)) continue;
        
        checkedDiagonals.add(canonicalLineKey);

        const tempGridForward = JSON.parse(JSON.stringify(grid));
        const gridAfterForwardSlide = await slideLine(tempGridForward, currentLineCoords, 'forward');
        let { hasMatches: forwardSlideMatches } = await findAndMarkMatches(gridAfterForwardSlide);
        if (forwardSlideMatches) return false;

        const tempGridBackward = JSON.parse(JSON.stringify(grid));
        const gridAfterBackwardSlide = await slideLine(tempGridBackward, currentLineCoords, 'backward');
        let { hasMatches: backwardSlideMatches } = await findAndMarkMatches(gridAfterBackwardSlide);
        if (backwardSlideMatches) return false;
      }
    }
  }
  return true;
};
    
    