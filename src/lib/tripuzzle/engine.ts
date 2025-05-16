
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

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
    // Ensure data array width matches visual width if they differ
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
            nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
        } else { // currentCellOrientation === 'down'
            nextR = currR; nextC = currC - 1; expectedNextOrientation = 'up';
        }
    } else { // type === 'diff', '\' diagonal, moving towards bottom-right (this was the experimentally fixed logic)
        if (currentCellOrientation === 'up') {
            nextR = currR + 1; nextC = currC; expectedNextOrientation = 'down';
        } else { // currentCellOrientation === 'down'
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
            prevR = currR; prevC = currC + 1; expectedPrevOrientation = 'down';
        } else { // currentCellOrientation === 'down'
            prevR = currR - 1; prevC = currC; expectedPrevOrientation = 'up';
        }
    } else { // type === 'diff', '\' diagonal, moving towards top-left (this was the experimentally fixed logic)
         if (currentCellOrientation === 'up') {
            prevR = currR; prevC = currC - 1; expectedPrevOrientation = 'down';
        } else { // currentCellOrientation === 'down'
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

  if (startR < 0 || startR >= numGridRows || startC < 0 || startC >= numVisualCols) { // Removed check for grid[startR]?.[startC] as we slide nulls
    return []; 
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
  const neighbors: { r: number; c: number }[] = [];
  const currentTile = grid[r]?.[c];

  if (!currentTile) { // No tile at (r,c) to find neighbors for
    return [];
  }
  const currentCanonicalOrientation = getExpectedOrientation(r, c);

  // Potential side-sharing configurations: [dr, dc, requiredNeighborOrientation]
  // For horizontal, requiredNeighborOrientation is the opposite of current.
  // For vertical, it's specific.
  const potentialSideSharingConfigs: { dr: number; dc: number; reqOppositeOrientation: 'up' | 'down' }[] = [
    { dr: 0, dc: -1, reqOppositeOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' }, // Left
    { dr: 0, dc: 1, reqOppositeOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' },  // Right
  ];

  if (currentCanonicalOrientation === 'up') {
    // UP tile at (r,c) shares base with DOWN tile at (r+1,c)
    potentialSideSharingConfigs.push({ dr: 1, dc: 0, reqOppositeOrientation: 'down' });
  } else { // currentCanonicalOrientation === 'down'
    // DOWN tile at (r,c) shares base with UP tile at (r-1,c)
    potentialSideSharingConfigs.push({ dr: -1, dc: 0, reqOppositeOrientation: 'up' });
  }
  
  for (const config of potentialSideSharingConfigs) {
    const nr = r + config.dr;
    const nc = c + config.dc;

    // Check bounds
    if (nr >= 0 && nr < GAME_SETTINGS.GRID_HEIGHT_TILES && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) {
      const neighborTile = grid[nr]?.[nc];
      // Check if neighbor tile exists AND its canonical orientation matches the requirement for side-sharing
      if (neighborTile && getExpectedOrientation(nr, nc) === config.reqOppositeOrientation) {
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows } = await getGridDimensions(newGrid);
  let hasMatches = false;
  let matchCount = 0;
  const visitedOverall = new Set<string>(); // Tracks tiles already processed in any component search

  for (let r_start = 0; r_start < rows; r_start++) {
    for (let c_start = 0; c_start < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_start++) {
      const startTile = newGrid[r_start]?.[c_start];
      const startTileKey = `${r_start},${c_start}`;

      if (!startTile || startTile.isMatched || visitedOverall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: { r: number, c: number }[] = [{ r: r_start, c: c_start }];
      const componentCoords: { r: number, c: number }[] = [];
      const visitedInThisComponentSearch = new Set<string>(); 
      
      visitedInThisComponentSearch.add(startTileKey);
      // componentCoords.push({ r: r_start, c: c_start }); // Add start tile to component when discovered

      let head = 0;
      while (head < queue.length) {
        const currentPos = queue[head++];
        componentCoords.push(currentPos); // Add to component when dequeued for processing
        // visitedOverall.add(`${currentPos.r},${currentPos.c}`); // Mark as globally visited when processed

        const neighbors = await getNeighbors(currentPos.r, currentPos.c, newGrid);
        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];

          if (neighborTile && neighborTile.color === targetColor && !visitedInThisComponentSearch.has(neighborKey)) {
            visitedInThisComponentSearch.add(neighborKey);
            queue.push(neighborPos);
            // componentCoords.push(neighborPos); // Add to component when discovered
          }
        }
      }
      
      // Mark all tiles explored in this BFS as visitedOverall *after* the BFS completes for this component
      visitedInThisComponentSearch.forEach(key => visitedOverall.add(key));


      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        let newlyMatchedInThisGroup = 0;
        componentCoords.forEach(pos => {
          const tileToMark = newGrid[pos.r]?.[pos.c];
          if (tileToMark && !tileToMark.isMatched) { 
             tileToMark.isMatched = true;
             newlyMatchedInThisGroup++;
          }
        });
        matchCount += newlyMatchedInThisGroup;
      }
    }
  }
  return { newGrid, hasMatches, matchCount };
};

// DEBUG: Keeps matched tiles on board for highlighting, no gravity/spawn
export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  return grid; 
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  return grid; // In debug mode, no gravity/spawn to see highlights
};

export const checkGameOver = async (grid: GridData): Promise<boolean> => {
  const { rows: numRows } = await getGridDimensions(grid);

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
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    for (let c_diag_start = 0; c_diag_start < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        
        const lineCoords = await getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue; 

        const uniqueCoordStrings = [...new Set(lineCoords.map(lc => `${lc.r},${lc.c}`))].sort();
        const canonicalLineKey = `${type}-${uniqueCoordStrings.join('|')}`;
        
        if (checkedDiagonals.has(canonicalLineKey) || uniqueCoordStrings.length < 1) continue;
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
