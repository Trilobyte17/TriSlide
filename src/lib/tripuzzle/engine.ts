
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
    // Ensure data array width matches visual width if they differ (they don't in 12x11 setup)
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};


const getNextCoordOnDiagonalPath = async (
    currR: number, currC: number,
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let nextR = -1, nextC = -1;
    let expectedNextOrientation: 'up' | 'down';
    const currentCellOrientation = getExpectedOrientation(currR, currC);

    if (type === 'sum') { // '/' diagonal, moving towards bottom-left
      if (currentCellOrientation === 'up') {
        // From UP, to connect along '/', next is DOWN at (r+1, c)
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        // From DOWN, to connect along '/', next is UP at (r, c-1)
        nextR = currR; nextC = currC - 1; expectedNextOrientation = 'up';
      }
    } else { // type === 'diff', '\' diagonal, moving towards bottom-right (experimental swap logic)
      if (currentCellOrientation === 'up') {
        // From UP, to connect along '\', next is DOWN at (r+1, c)
        nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        // From DOWN, to connect along '\', next is UP at (r, c+1)
        nextR = currR; nextC = currC + 1; expectedNextOrientation = 'up';
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
    type: DiagonalType,
    numGridRows: number, numVisualCols: number
): Promise<{ r: number, c: number } | null> => {
    let prevR = -1, prevC = -1;
    let expectedPrevOrientation: 'up' | 'down';
    const currentCellOrientation = getExpectedOrientation(currR, currC);

    if (type === 'sum') { // '/' diagonal, moving towards top-right
      if (currentCellOrientation === 'up') {
        // From UP, to connect along '/' prev, is DOWN at (r, c+1)
        prevR = currR; prevC = currC + 1; expectedPrevOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        // From DOWN, to connect along '/' prev, is UP at (r-1, c)
        prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up';
      }
    } else { // type === 'diff', '\' diagonal, moving towards top-left (experimental swap logic)
      if (currentCellOrientation === 'up') {
        // From UP, to connect along '\' prev, is DOWN at (r, c-1)
        prevR = currR; prevC = currC - 1; expectedPrevOrientation = 'down';
      } else { // currentCellOrientation === 'down'
        // From DOWN, to connect along '\' prev, is UP at (r-1, c)
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
      lineCoords.unshift(prevCoord); 
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
    } else {
      break;
    }
  }
  
  // Ensure unique coordinates and sort
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

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
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
        // If the source was null, the target should also be null unless it's a spawn point (handled above)
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

// Baseline getNeighbors - identifies strict side-sharing neighbors
export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const currentTile = grid[r]?.[c];
  if (!currentTile) return []; 

  const neighbors: {r: number, c: number}[] = [];
  const currentCanonicalOrientation = getExpectedOrientation(r, c);

  // Horizontal Left
  if (c > 0) {
      const neighborCoord = { r, c: c - 1 };
      const neighborTile = grid[neighborCoord.r]?.[neighborCoord.c];
      if (neighborTile && getExpectedOrientation(neighborCoord.r, neighborCoord.c) !== currentCanonicalOrientation) {
          neighbors.push(neighborCoord);
      }
  }
  // Horizontal Right
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1) {
      const neighborCoord = { r, c: c + 1 };
      const neighborTile = grid[neighborCoord.r]?.[neighborCoord.c];
      if (neighborTile && getExpectedOrientation(neighborCoord.r, neighborCoord.c) !== currentCanonicalOrientation) {
          neighbors.push(neighborCoord);
      }
  }
  // Vertical
  if (currentCanonicalOrientation === 'up') {
      if (r > 0) {
          const neighborCoord = { r: r - 1, c };
          const neighborTile = grid[neighborCoord.r]?.[neighborCoord.c];
          // For an UP tile at (r,c), its vertical side-sharing neighbor is (r-1,c) and MUST be DOWN
          if (neighborTile && getExpectedOrientation(neighborCoord.r, neighborCoord.c) === 'down') {
              neighbors.push(neighborCoord);
          }
      }
  } else { // currentCanonicalOrientation === 'down'
      if (r < GAME_SETTINGS.GRID_HEIGHT_TILES - 1) {
          const neighborCoord = { r: r + 1, c };
          const neighborTile = grid[neighborCoord.r]?.[neighborCoord.c];
          // For a DOWN tile at (r,c), its vertical side-sharing neighbor is (r+1,c) and MUST be UP
          if (neighborTile && getExpectedOrientation(neighborCoord.r, neighborCoord.c) === 'up') {
              neighbors.push(neighborCoord);
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
  const visitedOverall = new Set<string>(); // Stores "r,c" strings for all processed tiles globally in this call

  for (let r_start = 0; r_start < numRows; r_start++) {
    for (let c_start = 0; c_start < numCols; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      const startTile = newGrid[r_start]?.[c_start];

      // Skip if no tile, or already part of a confirmed match from a previous component in *this* call, 
      // or already explored as part of *any* component (matched or not) in *this* call.
      if (!startTile || startTile.isMatched || visitedOverall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: {r: number, c: number}[] = [{r: r_start, c: c_start}];
      const componentCoords: {r: number, c: number}[] = [];
      const visitedInThisComponentSearch = new Set<string>(); // Tiles visited/queued for *this specific* BFS
      
      visitedInThisComponentSearch.add(startTileKey);

      while (queue.length > 0) {
        const currentPos = queue.shift()!;
        componentCoords.push(currentPos);
        // Note: We add to visitedOverall LATER, after the whole component is explored.
        // This allows a tile to be part of component A (not a match) and then later part of component B (is a match).
        // The startTile check `visitedOverall.has(startTileKey)` prevents re-initiating BFS.

        const neighbors = await getNeighbors(currentPos.r, currentPos.c, newGrid);

        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];
          
          if (neighborTile && neighborTile.color === targetColor && !visitedInThisComponentSearch.has(neighborKey) ) {
            // Important: Only consider for BFS if it's same color and not already in this BFS path
            // We don't check neighborTile.isMatched here, as a tile might be part of a component
            // that ultimately forms a match, even if some of its neighbors were part of a *different*
            // earlier match. The final marking step handles the `!tileToMark.isMatched` check.
            visitedInThisComponentSearch.add(neighborKey);
            queue.push(neighborPos);
          }
        }
      }
      
      // After BFS for this component is complete, mark all tiles in this component as "globally" explored for this call.
      visitedInThisComponentSearch.forEach(key => visitedOverall.add(key));

      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        let newlyMatchedInThisGroup = 0;
        componentCoords.forEach(posInMatch => {
          const tileToMark = newGrid[posInMatch.r]?.[posInMatch.c];
          // Ensure we only count/mark tiles that aren't already part of another confirmed match in this cycle
          if (tileToMark && !tileToMark.isMatched) { 
             tileToMark.isMatched = true;
             newlyMatchedInThisGroup++;
          }
        });
        totalMatchedTilesThisCycle += newlyMatchedInThisGroup;
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
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c_grav = 0; c_grav < numCols; c_grav++) {
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
    for (let c_spawn = 0; c_spawn < numCols; c_spawn++) {
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
  const numCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  const initialCheck = await findAndMarkMatches(grid);
  if (initialCheck.hasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid)); 
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    const leftSlideMatches = await findAndMarkMatches(gridAfterLeftSlide);
    if (leftSlideMatches.hasMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid)); 
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    const rightSlideMatches = await findAndMarkMatches(gridAfterRightSlide);
    if (rightSlideMatches.hasMatches) return false;
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    for (let c_diag = 0; c_diag < numCols; c_diag++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        
        const lineCoords = await getTilesOnDiagonal(grid, r_diag, c_diag, type);
        if (lineCoords.length < 1) continue; 

        // Create a canonical key for the line to avoid re-checking
        const canonicalLineKey = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('-');
        if (checkedDiagonals.has(canonicalLineKey)) continue;
        
        checkedDiagonals.add(canonicalLineKey);

        const tempGridForward = JSON.parse(JSON.stringify(grid));
        const gridAfterForwardSlide = await slideLine(tempGridForward, lineCoords, 'forward');
        const forwardSlideMatches = await findAndMarkMatches(gridAfterForwardSlide);
        if (forwardSlideMatches.hasMatches) return false;

        const tempGridBackward = JSON.parse(JSON.stringify(grid));
        const gridAfterBackwardSlide = await slideLine(tempGridBackward, lineCoords, 'backward');
        const backwardSlideMatches = await findAndMarkMatches(gridAfterBackwardSlide);
        if (backwardSlideMatches.hasMatches) return false;
      }
    }
  }
  return true;
};
    
    
