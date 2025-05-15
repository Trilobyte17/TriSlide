
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
};

export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // Even rows (0, 2, ...): UP, DOWN, UP...
  // Odd rows (1, 3, ...): DOWN, UP, DOWN...
  if (r % 2 === 0) { 
    return c % 2 === 0 ? 'up' : 'down';
  } else { 
    return c % 2 === 0 ? 'down' : 'up'; 
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
    for (let c_add = 0; c_add < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_add++) {
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
    for (let c_iter = 0; c_iter < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_iter++) {
      if (grid[r_iter]?.[c_iter]) { // Only consider existing tiles
        if (type === 'sum' && r_iter + c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        } else if (type === 'diff' && r_iter - c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        }
      }
    }
  }

  // Sort them to be in a consistent order for sliding.
  // For 'sum' lines (like '/'), as r increases, c decreases. Sort by r ascending.
  // For 'diff' lines (like '\'), as r increases, c increases. Sort by r ascending.
  // Default sort by r, then c for tie-breaking (though r should be unique along a diagonal trace from a single start)
  lineCoords.sort((a, b) => {
    if (a.r !== b.r) {
      return a.r - b.r;
    }
    return a.c - b.c;
  });
  
  return lineCoords;
};

export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length < 1) return grid; // Allow sliding a single tile (it gets replaced)

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; // Deep copy
  const numTilesInLine = lineCoords.length;
  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => grid[coord.r][coord.c]);

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (numTilesInLine === 1) { // Special case: sliding a single tile line means it just gets replaced
        isNewlySpawned = true;
        // sourceTileIndex will not be used but set it to avoid issues if logic changes
        sourceTileIndex = 0; 
    } else if (slideDirection === 'forward') {
      sourceTileIndex = (i - 1 + numTilesInLine) % numTilesInLine;
      if (i === 0) isNewlySpawned = true; // The first tile in the "forward" direction is new
    } else { // backward
      sourceTileIndex = (i + 1) % numTilesInLine;
      if (i === numTilesInLine - 1) isNewlySpawned = true; // The "last" tile (which becomes first) in "backward" is new
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
          id: existingTile.id, // Preserve ID of the moving tile
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Update orientation for new position
          isNew: false, // It's a moved tile
          isMatched: false,
        };
      } else {
        // This case should ideally not be reached if lineCoords only contains non-null tiles
        // and originalTilesData reflects that. If it does, treat as a new spawn.
         tileToPlace = {
            id: generateUniqueId(),
            color: getRandomColor(),
            row: targetCoord.r,
            col: targetCoord.c,
            orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
            isNew: true,
            isMatched: false,
        };
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
    if (grid[rowIndex]?.[c_slide]) { // Only include actual tiles
      rowCoords.push({ r: rowIndex, c: c_slide });
    }
  }

  if (rowCoords.length === 0) return grid; // Nothing to slide

  // For rows, 'left' slide means tiles move 'forward' in terms of array index (0,1,2 -> 1,2,0 with new at 0)
  // 'right' slide means tiles move 'backward' (0,1,2 -> 2,0,1 with new at 2)
  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';
  return slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  // Horizontal neighbors (must have opposite orientation to share a vertical edge)
  // Left neighbor
  if (c > 0 && grid[r]?.[c-1] && grid[r][c-1]!.orientation !== tile.orientation) {
    neighbors.push({r, c: c-1});
  }
  // Right neighbor
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1 && grid[r]?.[c+1] && grid[r][c+1]!.orientation !== tile.orientation) {
    neighbors.push({r, c: c+1});
  }

  // "Vertical/Diagonal" point-sharing neighbor
  // This depends on the row's parity (for overall grid structure) and tile's orientation
  if (tile.orientation === 'up') {
    // An UP tile can connect its tip to the shared base point of two DOWN tiles in the row above (r-1).
    // Or its base corners can connect to tips of DOWN tiles in the row below (r+1).
    // For simplicity, we'll consider the single tile directly "above" or "below" its central axis.
    // If tile at (r,c) is UP, the tile at (r+1, c) should be DOWN if they are to share a base/tip connection.
    if (r < rows - 1 && grid[r+1]?.[c] && grid[r+1][c]!.orientation === 'down') {
      neighbors.push({r: r+1, c: c});
    }
  } else { // tile.orientation === 'down'
    // If tile at (r,c) is DOWN, the tile at (r-1, c) should be UP.
    if (r > 0 && grid[r-1]?.[c] && grid[r-1][c]!.orientation === 'up') {
      neighbors.push({r: r-1, c: c});
    }
  }
  
  // Filter to ensure neighbors are within grid and actually exist
  return neighbors.filter(n => grid[n.r]?.[n.c]);
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

  // Check horizontal slides
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = slideRow(tempGridLeft, r_slide, 'left');
    if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = slideRow(tempGridRight, r_slide, 'right');
    if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
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
          if (lineCoords.length > 0) { // Check even if length is 1, slideLine handles it
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

    