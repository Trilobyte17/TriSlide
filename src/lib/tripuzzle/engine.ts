
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

// Defines the canonical orientation of a tile based on its grid position
// For the "no horizontal offset, alternating row orientation" grid:
// Even rows (0, 2, 4...): UP, DOWN, UP...
// Odd rows (1, 3, 5...): DOWN, UP, DOWN...
const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
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
    // Ensure cells outside visual range are null if GRID_WIDTH_TILES > VISUAL_TILES_PER_ROW
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

// Helper function to get the next coordinate in a diagonal path
const getNextCoordOnDiagonalPath = async (
    currR: number, currC: number,
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let nextR = -1, nextC = -1;
    let expectedNextOrientation: 'up' | 'down' | null = null;
    const currentTileOrientation = getExpectedOrientation(currR, currC);

    if (type === 'diff') { // '\' diagonal, moving towards bottom-right (experimental swap logic)
      if (currentTileOrientation === 'up') {
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
      } else { // currentTileOrientation === 'down'
        nextR = currR; nextC = currC + 1; expectedNextOrientation = 'up';
      }
    } else { // type === 'sum'  '/' diagonal, moving towards bottom-left
      if (currentTileOrientation === 'up') {
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
      } else { // currentTileOrientation === 'down'
        nextR = currR; nextC = currC - 1; expectedNextOrientation = 'up';
      }
    }

    if (nextR >= 0 && nextR < numGridRows && nextC >= 0 && nextC < numVisualCols) {
        if (getExpectedOrientation(nextR, nextC) === expectedNextOrientation) {
            return { r: nextR, c: nextC };
        }
    }
    return null;
};

// Helper function to get the previous coordinate in a diagonal path
const getPrevCoordOnDiagonalPath = async (
    currR: number, currC: number,
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let prevR = -1, prevC = -1;
    let expectedPrevOrientation: 'up' | 'down' | null = null;
    const currentTileOrientation = getExpectedOrientation(currR, currC);

    if (type === 'diff') { // '\' diagonal, moving towards top-left (experimental swap logic)
      if (currentTileOrientation === 'up') {
        prevR = currR; prevC = currC - 1; expectedPrevOrientation = 'down';
      } else { // currentTileOrientation === 'down'
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up';
      }
    } else { // type === 'sum' '/' diagonal, moving towards top-right
      if (currentTileOrientation === 'up') {
        prevR = currR; prevC = currC + 1; expectedPrevOrientation = 'down';
      } else { // currentTileOrientation === 'down'
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up';
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
      return []; // Invalid start coordinate
  }
  lineCoords.push({ r: startR, c: startC });
  
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
  
  // Remove duplicates that might arise if startR, startC was re-added during trace
  // and ensure the list is sorted for consistent slideLine processing.
  const uniqueCoordsMap = new Map<string, {r: number, c: number}>();
  lineCoords.forEach(coord => uniqueCoordsMap.set(`${coord.r},${coord.c}`, coord));
  
  const uniqueSortedCoords = Array.from(uniqueCoordsMap.values());
  uniqueSortedCoords.sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      return a.c - b.c;
  });

  return uniqueSortedCoords;
};


export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; // Deep copy
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
    const tile = grid[coord.r]?.[coord.c]; // Use original grid to get tile data
    return tile ? {...tile} : null; // Make a copy if tile exists
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') { // e.g. right for rows, "down-diagonal" for diagonals
      sourceTileIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      // The tile at the "start" of the line (index 0 after forward slide) is newly spawned
      if (i === 0) isNewlySpawned = true; 
    } else { // 'backward' e.g. left for rows, "up-diagonal" for diagonals
      sourceTileIndex = (i + 1) % numCellsInLine;
      // The tile at the "end" of the line (index numCellsInLine - 1 after backward slide) is newly spawned
      if (i === numCellsInLine - 1) isNewlySpawned = true; 
    }

    let tileToPlace: Tile | null;

    if (isNewlySpawned) {
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Critical: set orientation based on new position
        isNew: true, // Mark as new for animation
        isMatched: false,
      };
    } else {
      const existingTileData = originalTilesData[sourceTileIndex];
      if (existingTileData) {
        tileToPlace = {
          ...existingTileData,
          id: existingTileData.id, // Preserve ID of existing tile
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Critical: update orientation
          isNew: false, // Not new, it moved
          isMatched: false, // Reset matched status
        };
      } else {
        // If the source was null (empty space), the target also becomes null (empty space moves)
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
     rowCoords.push({ r: rowIndex, c: c_slide }); // Collect all cells, including nulls
  }
  
  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows: numGridRows } = await getGridDimensions(grid); // Assuming this gives actual number of rows
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
  const currentTile = grid[r]?.[c];

  if (!currentTile) {
    return []; // No tile at (r,c) means no neighbors
  }
  
  const currentCanonicalOrientation = getExpectedOrientation(r, c);

  const potentialNeighborConfigs: { dr: number, dc: number, requiredOppositeOrientation: 'up' | 'down' }[] = [];

  // Config for Horizontal Left
  potentialNeighborConfigs.push({ dr: 0, dc: -1, requiredOppositeOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' });
  // Config for Horizontal Right
  potentialNeighborConfigs.push({ dr: 0, dc: 1, requiredOppositeOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' });
  
  // Config for Vertical
  if (currentCanonicalOrientation === 'up') {
    potentialNeighborConfigs.push({ dr: -1, dc: 0, requiredOppositeOrientation: 'down' });
  } else { // currentCanonicalOrientation === 'down'
    potentialNeighborConfigs.push({ dr: 1, dc: 0, requiredOppositeOrientation: 'up' });
  }

  for (const config of potentialNeighborConfigs) {
    const nr = r + config.dr;
    const nc = c + config.dc;

    // Check bounds
    if (nr >= 0 && nr < numGridRows && nc >= 0 && nc < numVisualCols) {
      const neighborTileExists = grid[nr]?.[nc]; // Check if a tile object exists
      if (neighborTileExists) {
        // Check if the neighbor's canonical orientation is what's required for side-sharing
        if (getExpectedOrientation(nr, nc) === config.requiredOppositeOrientation) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows } = await getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  const visitedForMatchFinding = new Set<string>(); 

  for (let r_find = 0; r_find < rows; r_find++) {
    const tilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    for (let c_find = 0; c_find < tilesInThisRow; c_find++) {
      const currentInitialTile = newGrid[r_find]?.[c_find];
      
      if (currentInitialTile && !currentInitialTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = []; 
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}]; 
        const groupVisitedThisBFS = new Set<string>(); 
        groupVisitedThisBFS.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR]?.[currC]; 
          if (!tileForBFS) continue; 

          const neighborsOfCurrent = await getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];
            
            if (neighborTile && neighborTile.color === tileForBFS.color && !groupVisitedThisBFS.has(`${neighborPos.r},${neighborPos.c}`)) {
              groupVisitedThisBFS.add(`${neighborPos.r},${neighborPos.c}`);
              component.push(neighborPos);
              q.push(neighborPos);
            }
          }
        }
        
        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r]?.[pos.c]) {
               newGrid[pos.r][pos.c]!.isMatched = true;
               visitedForMatchFinding.add(`${pos.r},${pos.c}`); 
               totalMatchedTiles++;
            }
          });
        }
      }
    }
  }
  return { newGrid, hasMatches, matchCount: totalMatchedTiles };
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

  const { hasMatches: initialMatches } = await findAndMarkMatches(grid);
  if (initialMatches) return false; 

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    const { hasMatches: leftSlideMatches } = await findAndMarkMatches(gridAfterLeftSlide);
    if (leftSlideMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    const { hasMatches: rightSlideMatches } = await findAndMarkMatches(gridAfterRightSlide);
    if (rightSlideMatches) return false;
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    for (let c_diag = 0; c_diag < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        
        const currentLineCoords = await getTilesOnDiagonal(grid, r_diag, c_diag, type);
        if (currentLineCoords.length < 1) continue; 

        // Create a canonical key for the line to avoid re-checking if start point is different but line is same
        const canonicalLineKey = currentLineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('-');
        if (checkedDiagonals.has(canonicalLineKey)) continue;
        
        checkedDiagonals.add(canonicalLineKey);

        const tempGridForward = JSON.parse(JSON.stringify(grid));
        const gridAfterForwardSlide = await slideLine(tempGridForward, currentLineCoords, 'forward');
        const { hasMatches: forwardSlideMatches } = await findAndMarkMatches(gridAfterForwardSlide);
        if (forwardSlideMatches) return false;

        const tempGridBackward = JSON.parse(JSON.stringify(grid));
        const gridAfterBackwardSlide = await slideLine(tempGridBackward, currentLineCoords, 'backward');
        const { hasMatches: backwardSlideMatches } = await findAndMarkMatches(gridAfterBackwardSlide);
        if (backwardSlideMatches) return false;
      }
    }
  }
  return true;
};
    

    