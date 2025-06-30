
"use client";

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor, getExpectedOrientation } from './types';

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

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
    const { rows: numGridRows } = getGridDimensions(grid);
    const numVisualCols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    const lineCoords: { r: number; c: number }[] = [];

    const isValid = (r: number, c: number) => r >= 0 && r < numGridRows && c >= 0 && c < numVisualCols && grid[r]?.[c] !== null;

    if (!isValid(startR, startC)) return [];

    let r = startR;
    let c = startC;

    // Traverse to the start of the line
    while (true) {
        const tile = grid[r]?.[c];
        if (!tile) break;

        let prevR = -1, prevC = -1;

        if (type === 'sum') { // '/' diagonal, moving up-right
            if (tile.orientation === 'up') {
                prevR = r - 1; prevC = c;
            } else { // 'down'
                prevR = r; prevC = c + 1;
            }
        } else { // 'diff', '\' diagonal, moving up-left
            if (tile.orientation === 'up') {
                prevR = r; prevC = c - 1;
            } else { // 'down'
                prevR = r - 1; prevC = c;
            }
        }
        
        if (isValid(prevR, prevC)) {
            r = prevR;
            c = prevC;
        } else {
            break;
        }
    }

    // Now at the start, traverse down the line
    const visited = new Set<string>();
    while (isValid(r, c)) {
        const key = `${r},${c}`;
        if (visited.has(key)) break; // Prevent infinite loops
        visited.add(key);
        lineCoords.push({ r, c });

        const tile = grid[r]?.[c];
        if (!tile) break;

        let nextR = -1, nextC = -1;
        
        if (type === 'sum') { // '/' diagonal, moving down-left
            if (tile.orientation === 'up') {
                nextR = r + 1; nextC = c;
            } else { // 'down'
                nextR = r; nextC = c - 1;
            }
        } else { // 'diff', '\' diagonal, moving down-right
            if (tile.orientation === 'up') {
                nextR = r + 1; nextC = c;
            } else { // 'down'
                nextR = r; nextC = c + 1;
            }
        }

        if (isValid(nextR, nextC)) {
            r = nextR;
            c = nextC;
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


export const slideLine = (
  grid: GridData,
  lineCoords: { r: number; c: number }[],
  slideDirection: SlideDirection,
  lineType: 'row' | DiagonalType
): GridData => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
      const tileAtCoord = grid[coord.r]?.[coord.c];
      return tileAtCoord ? {...tileAtCoord} : null;
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceIndex;

    if (slideDirection === 'forward') {
      sourceIndex = (i - 1 + numCellsInLine) % numCellsInLine;
    } else { 
      sourceIndex = (i + 1) % numCellsInLine;
    }
    
    const sourceTileData = originalTilesData[sourceIndex];

    if (sourceTileData) {
      newGrid[targetCoord.r][targetCoord.c] = {
        ...sourceTileData,
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
        isNew: false,
        isMatched: false,
      };
    } else {
      newGrid[targetCoord.r][targetCoord.c] = null;
    }
  }
  return newGrid;
};

export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const numVisualTilesInThisRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW;

  for (let c_slide = 0; c_slide < numVisualTilesInThisRow; c_slide++) {
     rowCoords.push({ r: rowIndex, c: c_slide });
  }

  if (rowCoords.length === 0) return grid;

  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return slideLine(grid, rowCoords, slideDir, 'row');
};

export const getNeighbors = (r: number, c: number, grid: GridData): { r: number; c: number }[] => {
    const tile = grid[r]?.[c];
    if (!tile) return [];

    const { rows } = getGridDimensions(grid);
    const cols = GAME_SETTINGS.VISUAL_TILES_PER_ROW;
    const neighbors: { r: number; c: number }[] = [];

    const isValid = (nr: number, nc: number) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr]?.[nc];

    // Common horizontal neighbors
    if (isValid(r, c - 1)) neighbors.push({ r, c: c - 1 });
    if (isValid(r, c + 1)) neighbors.push({ r, c: c + 1 });

    // The third neighbor's position depends on the tile's orientation ('up' or 'down' pointing).
    if (tile.orientation === 'up') {
        // Up-pointing triangles have a neighbor above.
        if (isValid(r - 1, c)) {
            neighbors.push({ r: r - 1, c });
        }
    } else { // 'down'
        // Down-pointing triangles have a neighbor below.
        if (isValid(r + 1, c)) {
            neighbors.push({ r: r + 1, c });
        }
    }

    return neighbors;
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const workingGrid = grid.map(row =>
    row.map(tile => (tile ? { ...tile, isMatched: false } : null))
  );
  const { rows } = getGridDimensions(workingGrid);
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
        const currentTile = workingGrid[currentPos.r]?.[currentPos.c];
        if(!currentTile) continue;

        componentCoords.push(currentPos);
        
        const neighbors = getNeighbors(currentPos.r, currentPos.c, workingGrid);
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

export const removeMatchedTiles = (grid: GridData): GridData => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row =>
    row.map(t => (t ? { ...t, isMatched: false } : null))
  );
  const { rows: numRows } = getGridDimensions(newGrid);
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

export const checkGameOver = (grid: GridData): boolean => {
  const { rows: numRows } = getGridDimensions(grid);

  const { hasMatches: initialCheckHasMatches } = findAndMarkMatches(grid);
  if (initialCheckHasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    let tempGridLeft = JSON.parse(JSON.stringify(grid));
    tempGridLeft = slideRow(tempGridLeft, r_slide, 'left');
    const { hasMatches: leftSlideHasMatches } = findAndMarkMatches(tempGridLeft);
    if (leftSlideHasMatches) return false;

    let tempGridRight = JSON.parse(JSON.stringify(grid));
    tempGridRight = slideRow(tempGridRight, r_slide, 'right');
    const { hasMatches: rightSlideHasMatches } = findAndMarkMatches(tempGridRight);
    if (rightSlideHasMatches) return false;
  }

  const checkedDiagonals = new Set<string>();
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    for (let c_diag_start = 0; c_diag_start < GAME_SETTINGS.VISUAL_TILES_PER_ROW; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {

        const lineCoords = getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue;

        const canonicalLineKeyCoords = lineCoords.map(lc => `${lc.r},${lc.c}`).sort().join('|');
        const canonicalLineKey = `${type}-${canonicalLineKeyCoords}`;

        if (checkedDiagonals.has(canonicalLineKey)) continue;
        checkedDiagonals.add(canonicalLineKey);

        let tempGridForward = JSON.parse(JSON.stringify(grid));
        tempGridForward = slideLine(tempGridForward, lineCoords, 'forward', type);
        const { hasMatches: forwardSlideHasMatches } = findAndMarkMatches(tempGridForward);
        if (forwardSlideHasMatches) return false;

        let tempGridBackward = JSON.parse(JSON.stringify(grid));
        tempGridBackward = slideLine(tempGridBackward, lineCoords, 'backward', type);
        const { hasMatches: backwardSlideHasMatches } = findAndMarkMatches(tempGridBackward);
        if (backwardSlideHasMatches) return false;
      }
    }
  }
  return true;
};
