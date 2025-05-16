
'use server';
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

// This function MUST be defined within this file, not imported from types.ts
const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // For no horizontal offset, orientation depends on row parity and col parity
  if (r % 2 === 0) { // Even rows (0, 2, ...)
    return c % 2 === 0 ? 'up' : 'down'; // UP, DOWN, UP...
  } else { // Odd rows (1, 3, ...)
    return c % 2 === 0 ? 'down' : 'up'; // DOWN, UP, DOWN...
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
    // Ensure cells outside visual range are null if GRID_WIDTH_TILES > VISUAL_TILES_PER_ROW
    // In current setup, GRID_WIDTH_TILES === VISUAL_TILES_PER_ROW (both 11)
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

// Helper function to determine the next coordinate in a diagonal path
const getNextCoordOnDiagonalPath = async (
  r: number, c: number,
  currentTileOrientation: 'up' | 'down',
  type: DiagonalType,
  numGridRows: number, numVisualCols: number,
): Promise<{r: number, c: number} | null> => {
  let nextR = -1, nextC = -1;
  let expectedNextOrientation: 'up' | 'down' | null = null;

  if (type === 'diff') { // '\' path (Top-Left to Bottom-Right) - moving towards bottom-right
    if (currentTileOrientation === 'up') {
      nextR = r; nextC = c + 1; expectedNextOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      nextR = r + 1; nextC = c; expectedNextOrientation = 'up';
    }
  } else { // 'sum' path ('/' path, Top-Right to Bottom-Left) - moving towards bottom-left
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

// Helper function to determine the previous coordinate in a diagonal path
const getPrevCoordOnDiagonalPath = async (
  r: number, c: number,
  currentTileOrientation: 'up' | 'down',
  type: DiagonalType,
  numGridRows: number, numVisualCols: number,
): Promise<{r: number, c: number} | null> => {
  let prevR = -1, prevC = -1;
  let expectedPrevOrientation: 'up' | 'down' | null = null;

  if (type === 'diff') { // '\' path - moving towards top-left
    if (currentTileOrientation === 'up') {
      prevR = r - 1; prevC = c; expectedPrevOrientation = 'down';
    } else { // currentTileOrientation === 'down'
      prevR = r; prevC = c - 1; expectedPrevOrientation = 'up';
    }
  } else { // 'sum' path ('/' path) - moving towards top-right
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
  const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Should be 11
  const lineCoords: {r: number, c: number}[] = [];

  if (startR < 0 || startR >= numGridRows || startC < 0 || startC >= numVisualCols /*|| !grid[startR]?.[startC]*/) {
    // Start tile itself is invalid or null, return empty line
    return [];
  }
  lineCoords.push({ r: startR, c: startC });

  // Trace "forward"
  let currR_fwd = startR;
  let currC_fwd = startC;
  
  while (true) {
    const currTile_fwd = grid[currR_fwd]?.[currC_fwd]; // Get current tile for its orientation
    const currOrientation_fwd = currTile_fwd ? currTile_fwd.orientation : getExpectedOrientation(currR_fwd, currC_fwd); // Fallback if cell is null
    
    const nextCoord = await getNextCoordOnDiagonalPath(currR_fwd, currC_fwd, currOrientation_fwd, type, numGridRows, numVisualCols);
    if (nextCoord) { 
      lineCoords.push(nextCoord);
      currR_fwd = nextCoord.r;
      currC_fwd = nextCoord.c;
    } else {
      break;
    }
  }

  // Trace "backward" from the original start point
  let currR_bwd = startR;
  let currC_bwd = startC;

  while (true) {
    const currTile_bwd = grid[currR_bwd]?.[currC_bwd];
    const currOrientation_bwd = currTile_bwd ? currTile_bwd.orientation : getExpectedOrientation(currR_bwd, currC_bwd);

    const prevCoord = await getPrevCoordOnDiagonalPath(currR_bwd, currC_bwd, currOrientation_bwd, type, numGridRows, numVisualCols);
    if (prevCoord) { 
      lineCoords.unshift(prevCoord); 
      currR_bwd = prevCoord.r;
      currC_bwd = prevCoord.c;
    } else {
      break;
    }
  }
  
  // Deduplicate and Sort for consistent processing order by slideLine
  const uniqueCoords = Array.from(new Set(lineCoords.map(c => `${c.r}-${c.c}`)))
    .map(s => {
      const [r, c] = s.split('-').map(Number);
      return {r, c};
    });

  uniqueCoords.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  return uniqueCoords;
};


export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; // Deep copy
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
    } else { // 'backward'
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
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Critical: update orientation
          isNew: false,         
          isMatched: false,
        };
      } else {
        tileToPlace = null; // Preserve empty spots if they are being slid
      }
    }
    newGrid[targetCoord.r][targetCoord.c] = tileToPlace;
  }
  return newGrid;
};

export const slideRow = async (grid: GridData, rowIndex: number, direction: 'left' | 'right'): Promise<GridData> => {
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const numVisualTilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Should be 11

  for (let c_slide = 0; c_slide < numVisualTilesInThisRow; c_slide++) {
     rowCoords.push({ r: rowIndex, c: c_slide }); // Collect all cells, including nulls
  }
  
  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows } = await getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const currentOrientation = getExpectedOrientation(r,c); 

  // For the "no horizontal offset, alternating row orientation" grid:
  // UP tile at (r,c) can connect to:
  // - (r, c-1) if DOWN (left base)
  // - (r, c+1) if DOWN (right base)
  // - (r-1, c) if DOWN (top tip)

  // DOWN tile at (r,c) can connect to:
  // - (r, c-1) if UP (left top)
  // - (r, c+1) if UP (right top)
  // - (r+1, c) if UP (bottom tip)

  const potentialRelativeCoords = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
    { dr: currentOrientation === 'up' ? -1 : 1, dc: 0 } // Above (if up) or Below (if down)
  ];
  
  for (const offset of potentialRelativeCoords) {
    const nr = r + offset.dr;
    const nc = c + offset.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile && getExpectedOrientation(nr, nc) !== currentOrientation) { // Must be opposite orientation
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  
  return neighbors.filter(n_coord => grid[n_coord.r]?.[n_coord.c]);
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
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = []; 
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}]; 
        const groupVisitedThisBFS = new Set<string>(); 
        groupVisitedThisBFS.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR_bfs, c: currC_bfs} = q[head++]; 
          const tileForBFS = newGrid[currR_bfs]?.[currC_bfs];
          if (!tileForBFS) continue; 

          const neighborsOfCurrent = await getNeighbors(currR_bfs, currC_bfs, newGrid);
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
  const { rows: numGridRows } = await getGridDimensions(newGrid); 

  for (let c_grav = 0; c_grav < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_grav++) { 
    let emptySlotR = -1; 

    for (let r_grav = numGridRows - 1; r_grav >= 0; r_grav--) {
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

  for (let r_spawn = 0; r_spawn < numGridRows; r_spawn++) {
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
  const { rows: numGridRows } = await getGridDimensions(grid); 

  if ((await findAndMarkMatches(grid)).hasMatches) return false;

  for (let r_slide = 0; r_slide < numGridRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    if ((await findAndMarkMatches(gridAfterLeftSlide)).hasMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    if ((await findAndMarkMatches(gridAfterRightSlide)).hasMatches) return false;
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numGridRows; r_diag++) {
    for (let c_diag = 0; c_diag < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag++) { 
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        
        const lineCoords = await getTilesOnDiagonal(grid, r_diag, c_diag, type);
        if (lineCoords.length > 1) { 
            // Create a canonical key for the line to avoid re-checking
            // A simple key could be based on the sorted coordinates if the line isn't always fully populated
            const canonicalLineKey = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('-');
            if (checkedDiagonals.has(canonicalLineKey)) continue;
            checkedDiagonals.add(canonicalLineKey);

          const tempGridForward = JSON.parse(JSON.stringify(grid));
          const gridAfterForwardSlide = await slideLine(tempGridForward, lineCoords, 'forward');
          if ((await findAndMarkMatches(gridAfterForwardSlide)).hasMatches) return false;

          const tempGridBackward = JSON.parse(JSON.stringify(grid));
          const gridAfterBackwardSlide = await slideLine(tempGridBackward, lineCoords, 'backward');
          if ((await findAndMarkMatches(gridAfterBackwardSlide)).hasMatches) return false;
        }
      }
    }
  }
  return true;
};
    

    

