
'use server';
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // For Trism-like tessellation:
  // Even rows (0, 2, 4...) start with UP: UP, DOWN, UP...
  // Odd rows (1, 3, 5...) start with DOWN: DOWN, UP, DOWN...
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
};

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
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
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};


export const getTilesOnDiagonal = async (grid: GridData, startR: number, startC: number, type: DiagonalType): Promise<{r: number, c: number}[]> => {
  const { rows } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  let minR = 0, maxR = rows - 1;
  let minC = 0, maxC = GAME_SETTINGS.VISUAL_TILES_PER_ROW -1;

  for (let r_iter = minR; r_iter <= maxR; r_iter++) {
    for (let c_iter = minC; c_iter <= maxC; c_iter++) {
        if (c_iter >= GAME_SETTINGS.VISUAL_TILES_PER_ROW) continue;
        
        const cellIsValidForThisRow = true;
        
        if (cellIsValidForThisRow) {
          if (type === 'sum' && r_iter + c_iter === key) {
             lineCoords.push({ r: r_iter, c: c_iter }); // Collect all cells, including nulls
          } else if (type === 'diff' && r_iter - c_iter === key) {
             lineCoords.push({ r: r_iter, c: c_iter }); // Collect all cells, including nulls
          }
        }
    }
  }
  // Sort for consistent processing order, especially for 'sum' diagonals
  lineCoords.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  return lineCoords;
};


export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; 
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
     rowCoords.push({ r: rowIndex, c: c_slide }); // Collect all cells, including nulls
  }

  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};

export const getNeighbors = async (r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const currentOrientation = getExpectedOrientation(r,c); // Use authoritative orientation

  // Horizontal neighbors (must have opposite orientation to connect along diagonal edge)
  if (c > 0) {
    const leftNeighbor = grid[r]?.[c-1];
    if (leftNeighbor && getExpectedOrientation(r, c-1) !== currentOrientation) {
      neighbors.push({ r: r, c: c - 1 });
    }
  }
  if (c < GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1) { 
    const rightNeighbor = grid[r]?.[c+1];
    if (rightNeighbor && getExpectedOrientation(r, c+1) !== currentOrientation) {
      neighbors.push({ r: r, c: c + 1 });
    }
  }

  let nr: number, nc: number;
  if (currentOrientation === 'up') {
    nr = r - 1; 
    nc = c;     
  } else { // currentOrientation === 'down'
    nr = r + 1; 
    nc = c;
  }

  if (nr >= 0 && nr < rows && nc >= 0 && nc < GAME_SETTINGS.VISUAL_TILES_PER_ROW) { 
    const vertNeighbor = grid[nr]?.[nc];
    if (vertNeighbor && getExpectedOrientation(nr, nc) !== currentOrientation) {
       neighbors.push({ r: nr, c: nc });
    }
  }

  return neighbors.filter(n => grid[n.r]?.[n.c]); 
};

export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  const visitedForMatchFinding = new Set<string>(); // To avoid processing a tile multiple times if it's part of a large match

  for (let r_find = 0; r_find < rows; r_find++) {
    const tilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    for (let c_find = 0; c_find < tilesInThisRow; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = []; // Stores all tiles in the current connected component
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}]; // Queue for BFS
        const groupVisitedThisBFS = new Set<string>(); // Tiles visited in *this specific* BFS traversal
        groupVisitedThisBFS.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR]?.[currC];
          if (!tileForBFS) continue; // Should not happen if added to q correctly

          const neighborsOfCurrent = await getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];
            // Check if neighbor exists, has same color, and hasn't been visited in this BFS
            if (neighborTile && neighborTile.color === tileForBFS.color && !groupVisitedThisBFS.has(`${neighborPos.r},${neighborPos.c}`)) {
              groupVisitedThisBFS.add(`${neighborPos.r},${neighborPos.c}`);
              component.push(neighborPos);
              q.push(neighborPos);
            }
          }
        }
        // If the component size meets the minimum match length, mark all its tiles
        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r]?.[pos.c]) {
               newGrid[pos.r][pos.c]!.isMatched = true;
               visitedForMatchFinding.add(`${pos.r},${pos.c}`); // Add to global visited set
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
  const { rows: numRows } = getGridDimensions(newGrid);

  // Gravity pass: Iterate columns, then rows from bottom up
  for (let c_grav = 0; c_grav < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_grav++) {
    let emptySlotR = -1; // Tracks the lowest empty slot found in the current column

    // Find the lowest empty slot in this column
    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      if (newGrid[r_grav][c_grav] === null) {
        emptySlotR = r_grav;
        break; // Found the lowest empty slot, move to filling it
      }
    }

    // If an empty slot was found, try to fill it from above
    if (emptySlotR !== -1) {
      for (let r_grav_fill = emptySlotR - 1; r_grav_fill >= 0; r_grav_fill--) {
        if (newGrid[r_grav_fill][c_grav] !== null) { // If there's a tile above
          const tileToFall = newGrid[r_grav_fill][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            id: tileToFall.id, // Preserve ID
            row: emptySlotR,
            col: c_grav,
            orientation: getExpectedOrientation(emptySlotR, c_grav), // Recalculate orientation
            isNew: false, // Not new, it fell
          };
          newGrid[r_grav_fill][c_grav] = null; // Vacate the original spot
          emptySlotR--; // Move to the next empty slot above
          if (emptySlotR < 0) break; // Column is filled from this point up
        }
      }
    }
  }

  // Spawn pass: Fill remaining nulls from the top
  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    for (let c_spawn = 0; c_spawn < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_spawn++) {
      if (newGrid[r_spawn][c_spawn] === null) {
        newGrid[r_spawn][c_spawn] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_spawn,
          col: c_spawn,
          orientation: getExpectedOrientation(r_spawn, c_spawn), // Set orientation for new tile
          isNew: true, // It's a new tile
          isMatched: false,
        };
      }
    }
  }
  return newGrid;
};


export const checkGameOver = async (grid: GridData): Promise<boolean> => {
  const { rows: numRows } = getGridDimensions(grid);

  // Check current grid for matches (should be processed already, but as a safeguard)
  if ((await findAndMarkMatches(grid)).hasMatches) return false;

  // Check horizontal slides for potential matches
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    // Test sliding left
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    if ((await findAndMarkMatches(gridAfterLeftSlide)).hasMatches) return false;

    // Test sliding right
    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    if ((await findAndMarkMatches(gridAfterRightSlide)).hasMatches) return false;
  }

  // Check diagonal slides for potential matches
  const checkedDiagonals = new Set<string>(); // To avoid re-checking the same diagonal
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    for (let c_diag = 0; c_diag < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        const key = type === 'sum' ? r_diag + c_diag : r_diag - c_diag;
        const diagonalKey = `${type}-${key}`;
        if (checkedDiagonals.has(diagonalKey)) continue;

        const lineCoords = await getTilesOnDiagonal(grid, r_diag, c_diag, type);
        if (lineCoords.length > 0) { // Only test if the diagonal line has tiles
          checkedDiagonals.add(diagonalKey);

          // Test sliding forward
          const tempGridForward = JSON.parse(JSON.stringify(grid));
          const gridAfterForwardSlide = await slideLine(tempGridForward, lineCoords, 'forward');
          if ((await findAndMarkMatches(gridAfterForwardSlide)).hasMatches) return false;

          // Test sliding backward
          const tempGridBackward = JSON.parse(JSON.stringify(grid));
          const gridAfterBackwardSlide = await slideLine(tempGridBackward, lineCoords, 'backward');
          if ((await findAndMarkMatches(gridAfterBackwardSlide)).hasMatches) return false;
        }
      }
    }
  }
  // If no moves lead to a match, it's game over
  return true;
};
