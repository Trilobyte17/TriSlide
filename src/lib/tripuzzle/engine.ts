
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types'; // Removed getExpectedOrientation from this import

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
};

// THIS FUNCTION DEFINES THE CORE VISUAL LAYOUT RULE
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; //  Up, Down, Up...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // Down, Up, Down...
  }
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r_init = 0; r_init < rows; r_init++) {
    const row: (Tile | null)[] = new Array(cols).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]);
  const { rows } = getGridDimensions(newGrid);

  for (let r_add = 0; r_add < rows; r_add++) {
    // All rows will have VISUAL_TILES_PER_ROW visual tiles.
    for (let c_add = 0; c_add < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_add++) {
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add), // Use local function
          isNew: true,
          isMatched: false,
        };
    }
    // Ensure remaining columns in data array (if GRID_WIDTH_TILES > VISUAL_TILES_PER_ROW) are null
    for (let c_fill_null = GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
  const { rows } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  for (let r_iter = 0; r_iter < rows; r_iter++) {
    for (let c_iter = 0; c_iter < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_iter++) {
      // Collect ALL coordinates on the mathematical diagonal within visual bounds
      if (type === 'sum' && r_iter + c_iter === key) {
        lineCoords.push({ r: r_iter, c: c_iter });
      } else if (type === 'diff' && r_iter - c_iter === key) {
        lineCoords.push({ r: r_iter, c: c_iter });
      }
    }
  }

  lineCoords.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  
  return lineCoords;
};


export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; 
  const numTilesInLine = lineCoords.length;
  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => grid[coord.r]?.[coord.c] ?? null);

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') {
      sourceTileIndex = (i - 1 + numTilesInLine) % numTilesInLine;
      if (i === 0) isNewlySpawned = true; 
    } else { // backward
      sourceTileIndex = (i + 1) % numTilesInLine;
      if (i === numTilesInLine - 1) isNewlySpawned = true; 
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


export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  for (let c_slide = 0; c_slide < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_slide++) {
    rowCoords.push({ r: rowIndex, c: c_slide });
  }

  if (rowCoords.length === 0) return grid;
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const currentOrientation = tile.orientation; // Use the tile's actual orientation

  const potentialNeighbors = [
    { dr: 0, dc: -1 }, 
    { dr: 0, dc: 1 },  
  ];

  if (currentOrientation === 'up') {
    potentialNeighbors.push({ dr: 1, dc: 0 }); 
  } else { // currentOrientation === 'down'
    potentialNeighbors.push({ dr: -1, dc: 0 }); 
  }

  for (const offset of potentialNeighbors) {
    const nr = r + offset.dr;
    const nc = c + offset.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile) {
        if (offset.dr === 0 && neighborTile.orientation !== currentOrientation) {
          neighbors.push({ r: nr, c: nc });
        }
        else if (offset.dc === 0 && neighborTile.orientation !== currentOrientation) {
           neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  
  return neighbors.filter(n => grid[n.r]?.[n.c]);
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows } = getGridDimensions(newGrid);
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
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR]?.[currC]; 
          if (!tileForBFS) continue;

          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
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

export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows } = getGridDimensions(newGrid);

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


export const checkGameOver = (grid: GridData): boolean => {
  const { rows: numRows } = getGridDimensions(grid);

  if (findAndMarkMatches(grid).hasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = slideRow(tempGridLeft, r_slide, 'left');
    if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = slideRow(tempGridRight, r_slide, 'right');
    if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    for (let c_diag = 0; c_diag < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        const key = type === 'sum' ? r_diag + c_diag : r_diag - c_diag;
        const diagonalKey = `${type}-${key}`;
        if (checkedDiagonals.has(diagonalKey)) continue; 

        const lineCoords = getTilesOnDiagonal(grid, r_diag, c_diag, type);
        if (lineCoords.length > 0) { 
          checkedDiagonals.add(diagonalKey); 

          const tempGridForward = JSON.parse(JSON.stringify(grid));
          const gridAfterForwardSlide = slideLine(tempGridForward, lineCoords, 'forward');
          if (findAndMarkMatches(gridAfterForwardSlide).hasMatches) return false;

          const tempGridBackward = JSON.parse(JSON.stringify(grid));
          const gridAfterBackwardSlide = slideLine(tempGridBackward, lineCoords, 'backward');
          if (findAndMarkMatches(gridAfterBackwardSlide).hasMatches) return false;
        }
      }
    }
  }
  return true; 
};
