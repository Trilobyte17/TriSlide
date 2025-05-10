
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
};

export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { 
    return c % 2 === 0 ? 'up' : 'down';
  } else { 
    return c % 2 === 0 ? 'down' : 'up';
  }
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r = 0; r < rows; r++) {
    const row: (Tile | null)[] = new Array(cols).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]);
  const { rows, cols } = getGridDimensions(newGrid);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: getExpectedOrientation(r, c),
          isNew: true,
        };
    }
  }
  return newGrid;
};

// Gets all tiles forming a specific diagonal line through (startR, startC)
export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
  const { rows, cols } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) { // Only consider existing tiles
        if (type === 'sum' && r + c === key) {
          lineCoords.push({ r, c });
        } else if (type === 'diff' && r - c === key) {
          lineCoords.push({ r, c });
        }
      }
    }
  }

  // Sort the coordinates to ensure consistent sliding order
  if (type === 'sum') { // r+c=k (like '/'). As r increases, c decreases. Sort by r ascending.
    lineCoords.sort((a, b) => a.r - b.r);
  } else { // r-c=k (like '\'). As r increases, c increases. Sort by r ascending.
    lineCoords.sort((a, b) => a.r - b.r);
  }
  return lineCoords;
};

// Slides tiles along a given path (row or diagonal)
export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length < 2) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; // Deep copy for modification
  const numTilesInLine = lineCoords.length;

  // Store original data of tiles in the line before modification
  const tempTileDatas: (Tile | null)[] = lineCoords.map(coord => {
    const tile = grid[coord.r][coord.c];
    return tile ? JSON.parse(JSON.stringify(tile)) : null;
  });

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileData: Tile | null;

    if (slideDirection === 'forward') { // tile[i] gets data from tile[i-1] (circular)
      sourceTileData = tempTileDatas[(i - 1 + numTilesInLine) % numTilesInLine];
    } else { // 'backward', tile[i] gets data from tile[i+1] (circular)
      sourceTileData = tempTileDatas[(i + 1) % numTilesInLine];
    }

    if (sourceTileData) {
      newGrid[targetCoord.r][targetCoord.c] = {
        ...sourceTileData, // Keep id, color from sourceTileData
        row: targetCoord.r, // Update position to targetCoord
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
        isNew: false,
        isMatched: false,
      };
    } else {
      // If source was null (should not happen if lineCoords only contains actual tiles)
      // This case might occur if lineCoords can include null spots.
      // For now, assuming lineCoords are only for actual tiles.
      newGrid[targetCoord.r][targetCoord.c] = null; 
    }
  }
  return newGrid;
};


// SlideRow is a specific case of slideLine
export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const { cols } = getGridDimensions(grid);
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  for (let c = 0; c < cols; c++) {
    if (grid[rowIndex][c]) { // Only include actual tiles in the path
      rowCoords.push({ r: rowIndex, c });
    }
  }
  
  if (rowCoords.length < 2) return grid; // Not enough tiles to slide

  // 'left' slide on a row corresponds to 'forward' if row coords are sorted by col ascending
  // 'right' slide on a row corresponds to 'backward'
  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';
  
  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];
  
  let deltas: {dr: number, dc: number}[];

  if (tile.orientation === 'up') {
    deltas = [
      { dr: 1, dc: 0 }, 
      { dr: 0, dc: -1 }, 
      { dr: 0, dc: 1 },  
    ];
  } else { 
    deltas = [
      { dr: -1, dc: 0 }, 
      { dr: 0, dc: -1 }, 
      { dr: 0, dc: 1 },  
    ];
  }
  
  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const neighborTile = grid[nr]?.[nc];
      if (neighborTile && neighborTile.orientation !== tile.orientation) {
         neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
};

export const findAndMarkMatches = (grid: GridData): { newGrid: GridData, hasMatches: boolean, matchCount: number } => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false, isNew: false } : null));
  const { rows, cols } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  
  const visitedForMatchFinding = new Set<string>();

  for (let r_find = 0; r_find < rows; r_find++) {
    for (let c_find = 0; c_find < cols; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = [];
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}];
        
        visitedForMatchFinding.add(`${r_find},${c_find}`);
        
        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          component.push({r: currR, c: currC});
          const tileForBFS = newGrid[currR][currC]!;

          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
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
  const { rows: numRows, cols: numCols } = getGridDimensions(newGrid);

  for (let C = 0; C < numCols; C++) {
    let emptySlotR = -1; 

    for (let R = numRows - 1; R >= 0; R--) {
        if (newGrid[R][C] === null) {
            emptySlotR = R;
            break;
        }
    }

    if (emptySlotR !== -1) {
        for (let R = emptySlotR - 1; R >= 0; R--) {
            if (newGrid[R][C] !== null) {
                const tileToFall = newGrid[R][C]!;
                if (!tileToFall) continue; // Should not happen if newGrid[R][C] is not null
                
                newGrid[emptySlotR][C] = {
                    ...tileToFall,
                    row: emptySlotR,
                    orientation: getExpectedOrientation(emptySlotR, C),
                    isNew: false, 
                };
                newGrid[R][C] = null; 

                let nextEmptyR = -1;
                for(let rCheck = emptySlotR - 1; rCheck >=R; rCheck--) { 
                    if (newGrid[rCheck][C] == null) {
                        nextEmptyR = rCheck;
                        break;
                    }
                }
                if (nextEmptyR !== -1) {
                    emptySlotR = nextEmptyR;
                } else {
                    let foundHigherEmpty = false;
                    for (let rSearch = emptySlotR - 1; rSearch >= 0; rSearch--) {
                        if (newGrid[rSearch][C] === null) {
                            emptySlotR = rSearch;
                            foundHigherEmpty = true;
                            break;
                        }
                    }
                    if (!foundHigherEmpty) break; 
                }
            }
        }
    }
  }
  
  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    for (let c_spawn = 0; c_spawn < numCols; c_spawn++) {
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
  const { rows: numRows, cols: numCols } = getGridDimensions(grid);

  if (findAndMarkMatches(grid).hasMatches) return false;

  // Check all possible horizontal row slides
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const rowTiles = grid[r_slide].filter(t => t !== null);
    if (rowTiles.length > 1) {
        const gridAfterLeftSlide = slideRow(grid, r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;
    
        const gridAfterRightSlide = slideRow(grid, r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  // Check all possible diagonal slides
  const checkedDiagonals = new Set<string>(); // key: "type-value" e.g. "sum-5" or "diff-2"
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (grid[r][c]) {
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r + c : r - c;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue;

          const lineCoords = getTilesOnDiagonal(grid, r, c, type);
          if (lineCoords.length > 1) {
            checkedDiagonals.add(diagonalKey);
            const gridAfterForwardSlide = slideLine(grid, lineCoords, 'forward');
            if (findAndMarkMatches(gridAfterForwardSlide).hasMatches) return false;

            const gridAfterBackwardSlide = slideLine(grid, lineCoords, 'backward');
            if (findAndMarkMatches(gridAfterBackwardSlide).hasMatches) return false;
          }
        }
      }
    }
  }
  
  // Note: Triad rotations and individual tile swaps are not part of Trism's core slide mechanics,
  // so they are omitted from game over check for now to align with Trism like gameplay.
  // If they were to be re-added, their logic would go here.

  return true; // No possible moves found
};
