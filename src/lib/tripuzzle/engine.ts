
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

// Ensure this is the correct getExpectedOrientation for the 12x11 no-offset grid
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
    // Ensure cells outside visual bounds are null if GRID_WIDTH_TILES > VISUAL_TILES_PER_ROW
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

// Path tracing helpers - from confirmed working version for diagonal slides
const getNextCoordOnDiagonalPath = async (
  r: number, c: number,
  type: DiagonalType,
  numGridRows: number,
  numVisualCols: number
): Promise<{r: number, c: number} | null> => {
  let nextR = -1, nextC = -1;
  const currentTileOrientation = getExpectedOrientation(r,c);
  let expectedNextOrientation: 'up' | 'down';

  if (type === 'sum') { // '/' diagonal, moving towards bottom-left
    if (currentTileOrientation === 'up') {
      nextR = r + 1; nextC = c; expectedNextOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      nextR = r; nextC = c - 1; expectedNextOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards bottom-right (with "experimental swap")
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
  type: DiagonalType,
  numGridRows: number,
  numVisualCols: number
): Promise<{r: number, c: number} | null> => {
  let prevR = -1, prevC = -1;
  const currentTileOrientation = getExpectedOrientation(r,c);
  let expectedPrevOrientation: 'up' | 'down';

  if (type === 'sum') { // '/' diagonal, moving towards top-right
    if (currentTileOrientation === 'up') {
      prevR = r; prevC = c + 1; expectedPrevOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      prevR = r - 1; prevC = c; expectedPrevOrientation = 'up';
    }
  } else { // type === 'diff', '\' diagonal, moving towards top-left (with "experimental swap")
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
  // Start with the initial tile, regardless of whether it's null or not, for path definition
  if (startR >= 0 && startR < numGridRows && startC >= 0 && startC < numVisualCols) {
    lineCoords.push({ r: startR, c: startC });
  } else {
    return []; // Invalid start coordinate
  }

  // Trace "forward"
  let currR_fwd = startR;
  let currC_fwd = startC;
  while (true) {
    const nextPos = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, type, numGridRows, numVisualCols);
    if (nextPos) {
      if (lineCoords.some(coord => coord.r === nextPos.r && coord.c === nextPos.c)) break; // Avoid infinite loop
      lineCoords.push(nextPos); // Collect all cells on path
      currR_fwd = nextPos.r;
      currC_fwd = nextPos.c;
    } else {
      break;
    }
  }

  // Trace "backward"
  let currR_bwd = startR;
  let currC_bwd = startC;
  while (true) {
    const prevPos = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, type, numGridRows, numVisualCols);
    if (prevPos) {
      if (lineCoords.some(coord => coord.r === prevPos.r && coord.c === prevPos.c)) break;
      lineCoords.unshift(prevPos); // Collect all cells on path
      currR_bwd = prevPos.r;
      currC_bwd = prevPos.c;
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


export const slideLine = async (
  grid: GridData,
  lineCoords: { r: number; c: number }[],
  slideDirection: SlideDirection,
  lineType: 'row' | DiagonalType
): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
      const tileAtCoord = grid[coord.r]?.[coord.c];
      return tileAtCoord ? {...tileAtCoord} : null;
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileData: Tile | null = null;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') {
      const sourceIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === 0) {
        isNewlySpawned = true;
      }
    } else { // backward
      const sourceIndex = (i + 1) % numCellsInLine;
      sourceTileData = originalTilesData[sourceIndex];
      if (i === numCellsInLine - 1) {
        isNewlySpawned = true;
      }
    }

    let tileToPlace: Tile | null = null;

    if (isNewlySpawned) {
      let orientationForNewTile = getExpectedOrientation(targetCoord.r, targetCoord.c);
      if (lineType === 'sum' || lineType === 'row') { // Specific flip for 'sum' diagonals and now for rows
        orientationForNewTile = orientationForNewTile === 'up' ? 'down' : 'up';
      }
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: orientationForNewTile,
        isNew: true,
        isMatched: false,
      };
    } else {
      if (sourceTileData) {
        tileToPlace = {
          ...sourceTileData,
          id: sourceTileData.id,
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
          isNew: false, // Existing tiles are not new
          isMatched: false, // Reset matched status
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
     rowCoords.push({ r: rowIndex, c: c_slide });
  }

  if (rowCoords.length === 0) return grid;

  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir, 'row');
};

// Matching Logic - From Fresh Re-architecture
export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const currentTile = grid[r]?.[c];
  if (!currentTile) return [];

  const currentOrientation = getExpectedOrientation(r, c);

  // Horizontal Left
  if (c > 0) {
    const leftNeighborTile = grid[r]?.[c-1];
    if (leftNeighborTile && getExpectedOrientation(r, c-1) !== currentOrientation) {
      neighbors.push({ r: r, c: c - 1 });
    }
  }
  // Horizontal Right
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1) {
    const rightNeighborTile = grid[r]?.[c+1];
    if (rightNeighborTile && getExpectedOrientation(r, c+1) !== currentOrientation) {
      neighbors.push({ r: r, c: c + 1 });
    }
  }
  // Vertical
  if (currentOrientation === 'up') { // Current is UP, looks for DOWN below
    if (r + 1 < GAME_SETTINGS.GRID_HEIGHT_TILES) {
      const belowNeighborTile = grid[r+1]?.[c];
      if (belowNeighborTile && getExpectedOrientation(r+1, c) === 'down') {
        neighbors.push({ r: r + 1, c: c });
      }
    }
  } else { // Current is DOWN, looks for UP above
    if (r - 1 >= 0) {
      const aboveNeighborTile = grid[r-1]?.[c];
      if (aboveNeighborTile && getExpectedOrientation(r-1, c) === 'up') {
        neighbors.push({ r: r - 1, c: c });
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
        // Mark as processed for this entire findAndMarkMatches call AFTER it's part of a component
        // This ensures if a non-match component is found, its tiles can still be start of another search
        // No, this should be added to visitedForThisCall as soon as it's taken to explore from.
        // Otherwise, a tile could be added to multiple non-matching components' visitedForCurrentComponent.
        // Correction: Add to visitedForThisCall when starting a new component exploration if it wasn't already visited.
        // The current logic is: if visitedForThisCall.has(startTileKey), skip. This means it's added after its component is fully explored.

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
      
      // After exploring the whole component, add all its tiles to visitedForThisCall
      // to prevent them from starting new component searches.
      for(const pos of componentCoords){
          visitedForThisCall.add(`${pos.r},${pos.c}`);
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


export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  let newGrid = grid.map(row =>
    row.map(t => (t ? { ...t, isMatched: false } : null)) // Preserve isNew initially
  );
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
            ...tileToFall, // Preserves original tileToFall.isNew
            id: tileToFall.id,
            row: emptySlotR,
            col: c_grav,
            orientation: getExpectedOrientation(emptySlotR, c_grav),
            isNew: false, // A tile that falls is no longer "new" from a spawn animation perspective
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
        tempGridForward = await slideLine(tempGridForward, lineCoords, 'forward', type);
        const { hasMatches: forwardSlideHasMatches } = await findAndMarkMatches(tempGridForward);
        if (forwardSlideHasMatches) return false;

        let tempGridBackward = JSON.parse(JSON.stringify(grid));
        tempGridBackward = await slideLine(tempGridBackward, lineCoords, 'backward', type);
        const { hasMatches: backwardSlideHasMatches } = await findAndMarkMatches(tempGridBackward);
        if (backwardSlideHasMatches) return false;
      }
    }
  }
  return true;
};
