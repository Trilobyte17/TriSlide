
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
};

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
    // Ensure cells outside visual bounds are null (if GRID_WIDTH_TILES were > VISUAL_TILES_PER_ROW)
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};


const getNextCoordOnDiagonalPath = (r: number, c: number, currentTileOrientation: 'up' | 'down', type: DiagonalType, numGridRows: number, numVisualCols: number): {r: number, c: number} | null => {
  let nextR = -1, nextC = -1;
  let expectedNextOrientation: 'up' | 'down' | null = null;

  if (type === 'diff') { // '\' diagonal, moving towards bottom-right
    if (currentTileOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      nextR = r; nextC = c + 1; expectedNextOrientation = 'up';
    }
  } else { // type === 'sum', '/' diagonal, moving towards bottom-left
    if (currentTileOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      nextR = r; nextC = c - 1; expectedNextOrientation = 'up';
    }
  }

  if (nextR >= 0 && nextR < numGridRows && nextC >= 0 && nextC < numVisualCols) {
    if (getExpectedOrientation(nextR, nextC) === expectedNextOrientation) {
      return { r: nextR, c: nextC };
    }
  }
  return null;
};

const getPrevCoordOnDiagonalPath = (r: number, c: number, currentTileOrientation: 'up' | 'down', type: DiagonalType, numGridRows: number, numVisualCols: number): {r: number, c: number} | null => {
  let prevR = -1, prevC = -1;
  let expectedPrevOrientation: 'up' | 'down' | null = null;

  if (type === 'diff') { // '\' diagonal, moving towards top-left
    if (currentTileOrientation === 'up') {
      prevR = r; prevC = c - 1; expectedPrevOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      prevR = r - 1; prevC = c; expectedPrevOrientation = 'up';
    }
  } else { // type === 'sum', '/' diagonal, moving towards top-right
    if (currentTileOrientation === 'up') {
      prevR = r; prevC = c + 1; expectedPrevOrientation = 'down';
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
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
  const lineCoords: {r: number, c: number}[] = [];

  if (startR < 0 || startR >= numGridRows || startC < 0 || startC >= numVisualCols) {
    return [];
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
  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => grid[coord.r]?.[coord.c] ? {...grid[coord.r][coord.c]!} : null);

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') {
      sourceTileIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      if (i === 0 && originalTilesData[sourceTileIndex] !== null) isNewlySpawned = true; // Tile moving in from wrap-around
    } else { // backward
      sourceTileIndex = (i + 1) % numCellsInLine;
      if (i === numCellsInLine - 1 && originalTilesData[sourceTileIndex] !== null) isNewlySpawned = true; // Tile moving in from wrap-around
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
  const { rows: numRows, cols: numCols } = await getGridDimensions(grid); // numCols here is VISUAL_TILES_PER_ROW
  const currentTile = grid[r]?.[c];

  if (!currentTile) return [];

  const currentCanonicalOrientation = getExpectedOrientation(r, c);

  const potentialNeighborChecks: {dr: number, dc: number, requiredNeighborOrientation: 'up' | 'down'}[] = [];

  // Horizontal Left
  potentialNeighborChecks.push({ dr: 0, dc: -1, requiredNeighborOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' });
  // Horizontal Right
  potentialNeighborChecks.push({ dr: 0, dc: 1, requiredNeighborOrientation: currentCanonicalOrientation === 'up' ? 'down' : 'up' });
  
  // Vertical
  if (currentCanonicalOrientation === 'up') {
    // UP tile shares its base with a DOWN tile directly below it.
    potentialNeighborChecks.push({ dr: 1, dc: 0, requiredNeighborOrientation: 'down' });
  } else { // currentCanonicalOrientation === 'down'
    // DOWN tile shares its base with an UP tile directly above it.
    potentialNeighborChecks.push({ dr: -1, dc: 0, requiredNeighborOrientation: 'up' });
  }

  for (const check of potentialNeighborChecks) {
    const nr = r + check.dr;
    const nc = c + check.dc;

    if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile && getExpectedOrientation(nr, nc) === check.requiredNeighborOrientation) {
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
};


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false } : null)); // Only reset isMatched, preserve isNew
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
      // visitedInThisComponentSearch tracks tiles added to queue for current BFS to prevent cycles
      const visitedInThisComponentSearch = new Set<string>(); 
      visitedInThisComponentSearch.add(startTileKey);
      
      let head = 0;
      while(head < queue.length) {
        const currentPos = queue[head++];
        componentCoords.push(currentPos); // Add to component when dequeued for processing

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
      
      // After BFS for this component is done
      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        componentCoords.forEach(pos => {
          const tileToMark = newGrid[pos.r]?.[pos.c];
          if (tileToMark && !tileToMark.isMatched) {
             tileToMark.isMatched = true;
             matchCount++;
          }
        });
      }
      // Add all tiles explored in this BFS (whether they formed a match or not) to visitedOverall
      componentCoords.forEach(pos => visitedOverall.add(`${pos.r},${pos.c}`));
    }
  }
  return { newGrid, hasMatches, matchCount };
};


export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  // In debug mode, keep tiles but highlight them. For normal play, remove them.
  // For now, return as is because Tile.tsx handles the highlight display
  // return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
  return grid.map(row => row.map(tile => {
    if (tile && tile.isMatched) {
      return null; // Remove matched tiles
    }
    return tile ? {...tile, isNew: false} : null; // Ensure non-matched tiles are not marked isNew from previous animations
  }));
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows } = await getGridDimensions(newGrid);
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  // Gravity pass: Iterate columns, then rows from bottom up
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
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  const { hasMatches: initialCheckHasMatches } = await findAndMarkMatches(grid);
  if (initialCheckHasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    const { hasMatches: leftSlideHasMatches } = await findAndMarkMatches(gridAfterLeftSlide);
    if (leftSlideHasMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    const { hasMatches: rightSlideHasMatches } = await findAndMarkMatches(gridAfterRightSlide);
    if (rightSlideHasMatches) return false;
  }
  
  const checkedDiagonals = new Set<string>(); 
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    for (let c_diag_start = 0; c_diag_start < numVisualCols; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        const lineCoords = await getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue;
        const canonicalLineKey = `${type}-${lineCoords.map(lc => `${lc.r},${lc.c}`).join('|')}`;
        if (checkedDiagonals.has(canonicalLineKey)) continue;
        checkedDiagonals.add(canonicalLineKey);

        const tempGridForward = JSON.parse(JSON.stringify(grid));
        const gridAfterForwardSlide = await slideLine(tempGridForward, lineCoords, 'forward');
        const { hasMatches: forwardSlideHasMatches } = await findAndMarkMatches(gridAfterForwardSlide);
        if (forwardSlideHasMatches) return false;

        const tempGridBackward = JSON.parse(JSON.stringify(grid));
        const gridAfterBackwardSlide = await slideLine(tempGridBackward, lineCoords, 'backward');
        const { hasMatches: backwardSlideHasMatches } = await findAndMarkMatches(gridAfterBackwardSlide);
        if (backwardSlideHasMatches) return false;
      }
    }
  }
  return true;
};
