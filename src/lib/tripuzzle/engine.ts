
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; 
  return { rows, cols };
};

// All rows now follow the same orientation pattern.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  return c % 2 === 0 ? 'up' : 'down'; // Pattern: UP, DOWN, UP... for all rows
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r_init = 0; r_init < rows; r_init++) {
    // All rows in the data structure will have GAME_SETTINGS.GRID_WIDTH_TILES columns
    const row: (Tile | null)[] = new Array(GAME_SETTINGS.GRID_WIDTH_TILES).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]);
  const { rows } = getGridDimensions(newGrid); 

  for (let r_add = 0; r_add < rows; r_add++) {
    for (let c_add = 0; c_add < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_add++) { // All rows get VISUAL_TILES_PER_ROW
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
    for (let c_iter = 0; c_iter < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_iter++) { // Iterate only over visual tiles
      if (grid[r_iter]?.[c_iter]) {
        if (type === 'sum' && r_iter + c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        } else if (type === 'diff' && r_iter - c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        }
      }
    }
  }

  if (type === 'sum') { 
    lineCoords.sort((a, b) => a.r - b.r || b.c - a.c);  // Corrected: sum diagonals generally increase R and decrease C or vice-versa
  } else { 
    lineCoords.sort((a, b) => a.r - b.r || a.c - b.c); 
  }
  return lineCoords;
};

export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length < 2) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; 
  const numTilesInLine = lineCoords.length;
  const originalTilesData = lineCoords.map(coord => grid[coord.r][coord.c]);

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') { 
      sourceTileIndex = (i - 1 + numTilesInLine) % numTilesInLine;
      if (i === 0) isNewlySpawned = true; 
    } else { 
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
      const existingTile = originalTilesData[sourceTileIndex];
      if (existingTile) {
        tileToPlace = {
          ...existingTile,
          id: existingTile.id, 
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
    if (grid[rowIndex]?.[c_slide]) { 
      rowCoords.push({ r: rowIndex, c: c_slide });
    }
  }
  
  if (rowCoords.length < 2) return grid; 

  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward'; // For rows, left is like forward, right is backward
  return slideLine(grid, rowCoords, slideDir);
};

// Defines connections for a non-tessellated, stacked grid
export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];
  
  // Left neighbor
  if (c > 0 && grid[r]?.[c-1]?.orientation !== tile.orientation) {
    neighbors.push({r, c: c-1});
  }
  // Right neighbor
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1 && grid[r]?.[c+1]?.orientation !== tile.orientation) {
    neighbors.push({r, c: c+1});
  }
  
  // Neighbor above/below (depends on current tile's orientation for direct contact)
  if (tile.orientation === 'up') { // Tip points up, base is at bottom
    // Can connect to a DOWN tile directly below it at (r+1, c) if it exists
    if (r < rows - 1 && grid[r+1]?.[c]?.orientation === 'down') {
      neighbors.push({r: r+1, c: c});
    }
  } else { // 'down', tip points down, base is at top
    // Can connect to an UP tile directly above it at (r-1, c) if it exists
    if (r > 0 && grid[r-1]?.[c]?.orientation === 'up') {
      neighbors.push({r: r-1, c: c});
    }
  }

  return neighbors.filter(n => grid[n.r]?.[n.c]); // Ensure the neighbor actually exists
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  const visitedForMatchFinding = new Set<string>();

  for (let r_find = 0; r_find < rows; r_find++) {
    for (let c_find = 0; c_find < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = [];
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}];
        visitedForMatchFinding.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR]?.[currC];
          if (!tileForBFS) continue;

          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
              component.push(neighborPos);
              q.push(neighborPos);
            }
          }
        }

        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r]?.[pos.c] && !newGrid[pos.r][pos.c]!.isMatched) {
               newGrid[pos.r][pos.c]!.isMatched = true;
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

  // Gravity: Tiles fall straight down within their column.
  for (let c_grav = 0; c_grav < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_grav++) {
    let emptySlotR = -1; 

    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      if (newGrid[r_grav][c_grav] === null) {
        emptySlotR = r_grav;
        break;
      }
    }

    if (emptySlotR !== -1) {
      for (let r_grav = emptySlotR - 1; r_grav >= 0; r_grav--) {
        if (newGrid[r_grav][c_grav] !== null) {
          const tileToFall = newGrid[r_grav][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            row: emptySlotR,
            col: c_grav, 
            orientation: getExpectedOrientation(emptySlotR, c_grav),
            isNew: false,
          };
          newGrid[r_grav][c_grav] = null;
          emptySlotR--; 
          if (emptySlotR < 0) break; 
        }
      }
    }
  }
  
  // Spawning new tiles
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

  // Check horizontal slides
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    // Ensure there are enough tiles in the row to slide
    let tilesInRow = 0;
    for(let c_count = 0; c_count < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_count++) {
        if(grid[r_slide]?.[c_count]) tilesInRow++;
    }
    if (tilesInRow > 1) { 
        const tempGridLeft = JSON.parse(JSON.stringify(grid));
        const gridAfterLeftSlide = slideRow(tempGridLeft, r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

        const tempGridRight = JSON.parse(JSON.stringify(grid));
        const gridAfterRightSlide = slideRow(tempGridRight, r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  // Check diagonal slides
  const checkedDiagonals = new Set<string>(); 
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    for (let c_diag = 0; c_diag < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag++) {
      if (grid[r_diag]?.[c_diag]) { 
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r_diag + c_diag : r_diag - c_diag;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue; 

          const lineCoords = getTilesOnDiagonal(grid, r_diag, c_diag, type);
          if (lineCoords.length > 1) { 
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
  }
  return true; 
};
