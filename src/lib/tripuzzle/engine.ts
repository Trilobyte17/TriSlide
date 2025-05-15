
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; 
  return { rows, cols };
};

export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; // Pattern: UP, DOWN, UP...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // Pattern: DOWN, UP, DOWN... (this is the mirroring/flipping)
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
  const { rows, cols: maxDataCols } = getGridDimensions(newGrid); 

  for (let r_add = 0; r_add < rows; r_add++) {
    const tilesInThisRowVisual = (r_add % 2 === 0) ? 6 : 5; // 6 for even rows, 5 for odd rows visually
    for (let c_add = 0; c_add < maxDataCols; c_add++) { 
      if (c_add < tilesInThisRowVisual) { 
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add), // Critically set correct orientation
          isNew: true,
        };
      } else {
        newGrid[r_add][c_add] = null; // Ensure other parts of data row are null
      }
    }
  }
  return newGrid;
};

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
  const { rows, cols: maxDataCols } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  for (let r_iter = 0; r_iter < rows; r_iter++) {
    const tilesInCurrentRowVisual = (r_iter % 2 === 0) ? 6 : 5;
    for (let c_iter = 0; c_iter < tilesInCurrentRowVisual; c_iter++) { // Iterate only over visual tiles
      if (grid[r_iter][c_iter]) {
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
  const { cols: maxDataCols } = getGridDimensions(grid);
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const tilesInThisRowVisual = (rowIndex % 2 === 0) ? 6 : 5;

  for (let c_slide = 0; c_slide < tilesInThisRowVisual; c_slide++) {
    if (grid[rowIndex][c_slide]) { 
      rowCoords.push({ r: rowIndex, c: c_slide });
    }
  }
  
  if (rowCoords.length < 2) return grid; 

  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';
  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols: maxDataCols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const deltas = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  if (tile.orientation === 'up') {
     deltas.push({ dr: -1, dc: 0 }); 
  } else { 
     deltas.push({ dr: 1, dc: 0 });  
  }

  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < maxDataCols) {
      const neighborTile = grid[nr]?.[nc];
      const tilesInNeighborRowVisual = (nr % 2 === 0) ? 6 : 5;

      if (neighborTile && nc < tilesInNeighborRowVisual) { // Check visual boundary of neighbor row
        if (neighborTile.orientation !== tile.orientation) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
  }
  return neighbors;
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows, cols: maxDataCols } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  const visitedForMatchFinding = new Set<string>();

  for (let r_find = 0; r_find < rows; r_find++) {
    const tilesInThisRowVisual = (r_find % 2 === 0) ? 6 : 5;
    for (let c_find = 0; c_find < tilesInThisRowVisual; c_find++) { // Iterate visual columns
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = [];
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}];
        visitedForMatchFinding.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR][currC]!;
          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
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
            if (newGrid[pos.r][pos.c] && !newGrid[pos.r][pos.c]!.isMatched) {
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
  const { rows: numRows, cols: maxDataCols } = getGridDimensions(newGrid);

  for (let c_grav = 0; c_grav < maxDataCols; c_grav++) { // Iterate all possible data columns
    for (let r_grav = numRows - 2; r_grav >= 0; r_grav--) { 
      const currentTile = newGrid[r_grav][c_grav];
      if (currentTile) {
        let lowestPossibleR = r_grav;
        for (let r_check_below = r_grav + 1; r_check_below < numRows; r_check_below++) {
          const tilesInRowBelowVisual = (r_check_below % 2 === 0) ? 6 : 5;
          if (c_grav < tilesInRowBelowVisual && newGrid[r_check_below][c_grav] === null) { // Check visual boundary and if empty
            lowestPossibleR = r_check_below;
          } else {
            break; 
          }
        }

        if (lowestPossibleR !== r_grav) {
          newGrid[lowestPossibleR][c_grav] = {
            ...currentTile,
            row: lowestPossibleR,
            col: c_grav,
            orientation: getExpectedOrientation(lowestPossibleR, c_grav), 
            isNew: false,
          };
          newGrid[r_grav][c_grav] = null;
        }
      }
    }
  }

  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    const tilesInThisRowVisual = (r_spawn % 2 === 0) ? 6 : 5;
    for (let c_spawn = 0; c_spawn < tilesInThisRowVisual; c_spawn++) { // Spawn only in visual spots
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
  const { rows: numRows, cols: maxDataCols } = getGridDimensions(grid);

  if (findAndMarkMatches(grid).hasMatches) return false;

  // Check horizontal slides
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tilesInThisRowVisual = (r_slide % 2 === 0) ? 6 : 5;
    if (tilesInThisRowVisual > 1) { 
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
    const tilesInThisRowVisual = (r_diag % 2 === 0) ? 6 : 5;
    for (let c_diag = 0; c_diag < tilesInThisRowVisual; c_diag++) {
      if (grid[r_diag][c_diag]) { 
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
