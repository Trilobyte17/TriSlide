
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; 
  return { rows, cols };
};

// All rows now follow the same orientation pattern since there's no horizontal shift for tessellation.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  return c % 2 === 0 ? 'up' : 'down'; // Pattern: UP, DOWN, UP... for all rows
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
  const { rows, cols: maxDataCols } = getGridDimensions(newGrid); 

  for (let r_add = 0; r_add < rows; r_add++) {
    for (let c_add = 0; c_add < maxDataCols; c_add++) { 
      if (c_add < GAME_SETTINGS.VISUAL_TILES_PER_ROW) { // All rows get VISUAL_TILES_PER_ROW
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add),
          isNew: true,
        };
      } else {
        newGrid[r_add][c_add] = null;
      }
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
    lineCoords.sort((a, b) => a.r - b.r || b.c - a.c); 
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

  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';
  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const deltas = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  // For stacked rows (no horizontal shift), neighbors are simpler
  // An UP triangle has a DOWN neighbor below it (if it exists)
  // A DOWN triangle has an UP neighbor above it (if it exists)
  // These are based on orientation primarily.
  
  // Tile above/below
  if (tile.orientation === 'up' && r > 0) { // Can have a tile above
    if (grid[r-1]?.[c]?.orientation === 'down') neighbors.push({r: r-1, c: c});
  } else if (tile.orientation === 'down' && r < rows -1) { // Can have a tile below
     if (grid[r+1]?.[c]?.orientation === 'up') neighbors.push({r: r+1, c: c});
  }

  // For simple stacking, the "adjacent" same-row concept of up/down is more direct
  // For an UP tile, its base connects to the base of a DOWN tile at c+1 and c-1 (if they are the correct orientation)
  // For a DOWN tile, its tip connects to the tip of an UP tile at c+1 and c-1

  // This existing delta logic for left/right is for finding *contacting* neighbors
  // If tile (r,c) is UP, its right side contacts a DOWN tile at (r, c+1)
  // If tile (r,c) is DOWN, its right side contacts an UP tile at (r, c+1)
  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile && neighborTile.orientation !== tile.orientation) { // Must be opposite orientation to connect
         // For same row neighbors, dc determines if it's left or right
        if (delta.dr === 0) { // Same row
            neighbors.push({ r: nr, c: nc });
        }
        // For different row neighbors (up/down), the logic becomes more complex without horizontal shift
        // We will simplify for now and assume primary connections are within row and directly above/below based on orientation logic for simple stacking
      }
    }
  }
  // More refined neighbor logic for non-tessellated stacking could be complex
  // For now, this simplified version attempts to connect basic adjacencies.

  // For a more robust Trism-like neighbor finding in a non-shifted grid, 
  // one would typically define explicit connection points.
  // The current one above is a simplification.

  // Let's refine for simple stacking:
  // A tile connects to its left and right neighbor in the same row if they exist and have opposite orientation.
  // An UP tile connects to a DOWN tile directly below it *at the same column index `c`* if it exists.
  // A DOWN tile connects to an UP tile directly above it *at the same column index `c`* if it exists.
  const refinedNeighbors: {r: number, c: number}[] = [];
  // Left neighbor
  if (c > 0 && grid[r]?.[c-1]?.orientation !== tile.orientation) refinedNeighbors.push({r, c: c-1});
  // Right neighbor
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1 && grid[r]?.[c+1]?.orientation !== tile.orientation) refinedNeighbors.push({r, c: c+1});
  
  // Neighbor above/below (depends on current tile's orientation)
  if (tile.orientation === 'up') { // Tip points up, base is at bottom
    // Can connect to a DOWN tile below it at (r+1, c)
    if (r < rows - 1 && grid[r+1]?.[c]?.orientation === 'down') refinedNeighbors.push({r: r+1, c: c});
  } else { // 'down', tip points down, base is at top
    // Can connect to an UP tile above it at (r-1, c)
    if (r > 0 && grid[r-1]?.[c]?.orientation === 'up') refinedNeighbors.push({r: r-1, c: c});
  }

  return refinedNeighbors.filter(n => grid[n.r]?.[n.c]); // Ensure the neighbor actually exists
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
    let emptySlotR = -1; // Keep track of the lowest empty slot in the current column

    // Find the first empty slot from the bottom up
    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      if (newGrid[r_grav][c_grav] === null) {
        emptySlotR = r_grav;
        break;
      }
    }

    // If there's an empty slot, fill it from above
    if (emptySlotR !== -1) {
      for (let r_grav = emptySlotR - 1; r_grav >= 0; r_grav--) {
        if (newGrid[r_grav][c_grav] !== null) {
          const tileToFall = newGrid[r_grav][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            row: emptySlotR,
            col: c_grav, // Column remains the same
            orientation: getExpectedOrientation(emptySlotR, c_grav), // Recalculate orientation for new row
            isNew: false,
          };
          newGrid[r_grav][c_grav] = null;
          emptySlotR--; // Move to the next empty slot above
          if (emptySlotR < 0) break; // No more empty slots above
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
    if (GAME_SETTINGS.VISUAL_TILES_PER_ROW > 1) { 
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
