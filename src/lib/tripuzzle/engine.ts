
'use server';

import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const getExpectedOrientation = (r: number, c: number, visualTilesInRowR: number): 'up' | 'down' => {
    // visualTilesInRowR helps determine if 'c' is valid for this specific row's shape.
    // This function should be called with c within [0, visualTilesInRowR - 1]
    if (c < 0 || c >= visualTilesInRowR) {
      // This case should ideally be prevented by callers checking bounds first.
      // For Trism, out-of-visual-bounds cells don't have an orientation.
      // However, to prevent errors if called incorrectly, return a default.
      // A more robust approach might involve throwing an error or handling it based on context.
      return 'up'; // Or handle as error
    }
    if (r % 2 === 0) { // Even rows (e.g., 0, 2, ... up to VISUAL_TILES_PER_ROW tiles)
      return c % 2 === 0 ? 'up' : 'down';
    } else { // Odd rows (e.g., 1, 3, ... up to VISUAL_TILES_PER_ROW - 1 tiles, effectively shifted)
      return c % 2 === 0 ? 'down' : 'up';
    }
  };
  
// Helper to get number of visual tiles in a specific row for Trism grid
const getNumVisualTilesInRow = (r: number): number => {
    return (r % 2 === 0) ? GAME_SETTINGS.VISUAL_TILES_PER_ROW : GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1;
};

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = async (grid: GridData): Promise<GridDimensions> => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Data array width
  return { rows, cols };
};

export const initializeGrid = async (rows: number, cols: number): Promise<GridData> => {
  const grid: GridData = [];
  for (let r_init = 0; r_init < rows; r_init++) {
    // All data rows have the same width (GAME_SETTINGS.GRID_WIDTH_TILES)
    const row: (Tile | null)[] = new Array(GAME_SETTINGS.GRID_WIDTH_TILES).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = async (grid: GridData): Promise<GridData> => {
  const newGrid = grid.map(row => [...row]); // Deep copy rows
  const { rows: numGridRows } = await getGridDimensions(newGrid);

  for (let r_add = 0; r_add < numGridRows; r_add++) {
    const numVisualTilesInThisRow = getNumVisualTilesInRow(r_add);
    for (let c_add = 0; c_add < numVisualTilesInThisRow; c_add++) {
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add, numVisualTilesInThisRow),
          isNew: true,
          isMatched: false,
        };
    }
    // Ensure cells outside visual bounds are null (already done by initializeGrid if GRID_WIDTH_TILES is used)
    for (let c_fill_null = numVisualTilesInThisRow; c_fill_null < GAME_SETTINGS.GRID_WIDTH_TILES; c_fill_null++) {
        newGrid[r_add][c_fill_null] = null;
    }
  }
  return newGrid;
};


export const getTilesOnDiagonal = async (grid: GridData, startR: number, startC: number, type: DiagonalType): Promise<{r: number, c: number}[]> => {
  const { rows: numGridRows } = await getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];

  // Helper to add a coordinate if it's within visual bounds
  const addCoordIfVisual = (r: number, c: number) => {
    const numVisualTiles = getNumVisualTilesInRow(r);
    if (r >= 0 && r < numGridRows && c >= 0 && c < numVisualTiles) {
      lineCoords.push({ r, c });
    }
  };
  
  // For path tracing, we need a slightly different approach than just mathematical keys
  // as the Trism grid has shifted rows. We "walk" the connections.

  if (startR < 0 || startR >= numGridRows || startC < 0 || startC >= getNumVisualTilesInRow(startR)) {
    return []; // Start point is out of visual bounds
  }

  lineCoords.push({ r: startR, c: startC });

  let currR_fwd = startR;
  let currC_fwd = startC;
  // Trace forward
  while (true) {
    const numTilesInCurrRow = getNumVisualTilesInRow(currR_fwd);
    const currentOrientation = getExpectedOrientation(currR_fwd, currC_fwd, numTilesInCurrRow);
    let nextR = -1, nextC = -1;

    if (type === 'diff') { // '\' diagonal
      if (currentOrientation === 'up') {
        // Experimental swap that fixed it before for '\'
        nextR = currR_fwd + 1; nextC = currC_fwd; // Try to connect to DOWN in row below
      } else { // currentOrientation === 'down'
        nextR = currR_fwd; nextC = currC_fwd + 1; // Try to connect to UP in same row, next col
      }
    } else { // 'sum' type, '/' diagonal
      if (currentOrientation === 'up') {
        nextR = currR_fwd + 1; nextC = currC_fwd; // Connects to DOWN in row below (Trism specific for /)
                                                 // For Trism, an UP connects to (r+1,c) if even, (r+1,c-1) if odd
                                                 // This simplified one was for the non-offset grid.
                                                 // Corrected for Trism:
         if(currR_fwd % 2 === 0) { // current is UP in EVEN row
            nextR = currR_fwd + 1; nextC = currC_fwd; // tile below (shifted odd row)
         } else { // current is UP in ODD row
            nextR = currR_fwd + 1; nextC = currC_fwd +1; // tile below-right (even row)
         }

      } else { // currentOrientation === 'down'
        // Corrected for Trism:
        if(currR_fwd % 2 === 0) { // current is DOWN in EVEN row
            nextR = currR_fwd + 1; nextC = currC_fwd +1; // tile below-right (shifted odd row)
        } else { // current is DOWN in ODD row
            nextR = currR_fwd + 1; nextC = currC_fwd; // tile below (even row)
        }
      }
    }
    
    if (nextR !== -1) {
        const numTilesInNextRow = getNumVisualTilesInRow(nextR);
        if (nextR >= 0 && nextR < numGridRows && nextC >= 0 && nextC < numTilesInNextRow) {
            const expectedNextOrientation = getExpectedOrientation(nextR, nextC, numTilesInNextRow);
            if (expectedNextOrientation !== currentOrientation) { // Must connect to opposite orientation
                 if (!lineCoords.some(lc => lc.r === nextR && lc.c === nextC)) {
                    lineCoords.push({ r: nextR, c: nextC });
                    currR_fwd = nextR;
                    currC_fwd = nextC;
                    continue;
                 }
            }
        }
    }
    break; // No valid next step
  }

  let currR_bwd = startR;
  let currC_bwd = startC;
  // Trace backward
  while (true) {
    const numTilesInCurrRow = getNumVisualTilesInRow(currR_bwd);
    const currentOrientation = getExpectedOrientation(currR_bwd, currC_bwd, numTilesInCurrRow);
    let prevR = -1, prevC = -1;

    if (type === 'diff') { // '\' diagonal
      if (currentOrientation === 'up') {
        // Experimental swap
        prevR = currR_bwd; prevC = currC_bwd - 1; 
      } else { // currentOrientation === 'down'
        prevR = currR_bwd - 1; prevC = currC_bwd;
      }
    } else { // 'sum' type, '/' diagonal
      if (currentOrientation === 'up') {
        // Corrected for Trism:
        if(currR_bwd % 2 === 0) { // current is UP in EVEN row
            prevR = currR_bwd -1 ; prevC = currC_bwd -1; // tile above-left (shifted odd row)
        } else { // current is UP in ODD row
            prevR = currR_bwd -1; prevC = currC_bwd; // tile above (even row)
        }
      } else { // currentOrientation === 'down'
        // Corrected for Trism:
         if(currR_bwd % 2 === 0) { // current is DOWN in EVEN row
            prevR = currR_bwd -1; prevC = currC_bwd; // tile above (shifted odd row)
         } else { // current is DOWN in ODD row
            prevR = currR_bwd -1; prevC = currC_bwd -1; // tile above-left (even row)
         }
      }
    }

    if (prevR !== -1) {
        const numTilesInPrevRow = getNumVisualTilesInRow(prevR);
        if (prevR >= 0 && prevR < numGridRows && prevC >= 0 && prevC < numTilesInPrevRow) {
            const expectedPrevOrientation = getExpectedOrientation(prevR, prevC, numTilesInPrevRow);
            if (expectedPrevOrientation !== currentOrientation) {
                if (!lineCoords.some(lc => lc.r === prevR && lc.c === prevC)) {
                    lineCoords.unshift({ r: prevR, c: prevC });
                    currR_bwd = prevR;
                    currC_bwd = prevC;
                    continue;
                }
            }
        }
    }
    break; // No valid prev step
  }
  
  lineCoords.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });
  return lineCoords;
};


export const slideLine = async (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): Promise<GridData> => {
  if (!lineCoords || lineCoords.length === 0) return grid;

  const newGrid = grid.map(row => row.map(tile => tile ? {...tile, isNew: false, isMatched: false} : null));
  const numCellsInLine = lineCoords.length;

  const originalTilesData: (Tile | null)[] = lineCoords.map(coord => {
    const tile = grid[coord.r]?.[coord.c]; // Use original grid to get tile data
    return tile ? {...tile} : null;
  });

  for (let i = 0; i < numCellsInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileIndex;
    let isNewlySpawned = false;

    if (slideDirection === 'forward') {
      sourceTileIndex = (i - 1 + numCellsInLine) % numCellsInLine;
      if (i === 0) isNewlySpawned = true; // Tile at the "start" of the line wrap-around is new
    } else { // backward
      sourceTileIndex = (i + 1) % numCellsInLine;
      if (i === numCellsInLine - 1) isNewlySpawned = true; // Tile at the "end" of the line wrap-around is new
    }
    
    const numVisualTilesInTargetRow = getNumVisualTilesInRow(targetCoord.r);

    if (targetCoord.c < 0 || targetCoord.c >= numVisualTilesInTargetRow) {
        // This target coordinate is outside the visual bounds of its row, should not place a tile.
        // This can happen if lineCoords includes out-of-visual-bounds cells for mathematical diagonals.
        // Ensure such cells in newGrid remain or become null.
        if(newGrid[targetCoord.r]) newGrid[targetCoord.r][targetCoord.c] = null; // defensive
        continue; 
    }
    
    let tileToPlace: Tile | null;

    if (isNewlySpawned) {
      tileToPlace = {
        id: generateUniqueId(),
        color: getRandomColor(),
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c, numVisualTilesInTargetRow),
        isNew: true,
        isMatched: false,
      };
    } else {
      const existingTileData = originalTilesData[sourceTileIndex];
      if (existingTileData) { // If the source was a tile
        tileToPlace = {
          ...existingTileData, // Preserve color, id
          id: existingTileData.id, 
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c, numVisualTilesInTargetRow),
          isNew: false, 
          isMatched: false,
        };
      } else { // If the source was null (an empty spot in the line)
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
  const numVisualTilesInThisRow = getNumVisualTilesInRow(rowIndex);

  for (let c_slide = 0; c_slide < numVisualTilesInThisRow; c_slide++) {
     rowCoords.push({ r: rowIndex, c: c_slide }); 
  }
  
  if (rowCoords.length === 0) return grid; 
  
  const slideDir: SlideDirection = direction === 'left' ? 'backward' : 'forward';
  return await slideLine(grid, rowCoords, slideDir);
};


async function getNeighbors(r: number, c: number, grid: GridData): Promise<{r: number, c: number}[]> {
    const neighbors: {r: number, c: number}[] = [];
    const { rows: numGridRows } = await getGridDimensions(grid);
    
    const currentTile = grid[r]?.[c];
    if (!currentTile) return [];

    const numTilesInCurrentRow = getNumVisualTilesInRow(r);
    const currentOrientation = getExpectedOrientation(r, c, numTilesInCurrentRow);

    const potentialSideSharingConfigs: {dr: number, dc: number, requiredNeighborOrientation?: 'up' | 'down'}[] = [];

    // Horizontal neighbors
    potentialSideSharingConfigs.push({dr: 0, dc: -1}); // Left
    potentialSideSharingConfigs.push({dr: 0, dc: 1});  // Right

    // Vertical/Diagonal neighbors for Trism (a tile has 3 sides)
    if (currentOrientation === 'up') {
        // For an UP tile at (r,c):
        // Side 1 connects to (r, c-1) which must be DOWN
        // Side 2 connects to (r, c+1) which must be DOWN
        // Side 3 (base) connects to DOWN tile(s) in row r+1
        if (r % 2 === 0) { // Current UP is in an EVEN row
            // Base connects to (r+1, c) in ODD row below (this tile must be DOWN)
            potentialSideSharingConfigs.push({dr: 1, dc: 0});
        } else { // Current UP is in an ODD row
            // Base connects to (r+1, c) AND (r+1, c+1) in EVEN row below. Both must be DOWN.
            // These are two distinct neighbors if they meet criteria.
            potentialSideSharingConfigs.push({dr: 1, dc: 0});
            potentialSideSharingConfigs.push({dr: 1, dc: 1});
        }
    } else { // currentOrientation === 'down'
        // For a DOWN tile at (r,c):
        // Side 1 connects to (r, c-1) which must be UP
        // Side 2 connects to (r, c+1) which must be UP
        // Side 3 (base) connects to UP tile(s) in row r-1
        if (r % 2 !== 0) { // Current DOWN is in an ODD row
            // Base connects to (r-1, c) in EVEN row above (this tile must be UP)
            potentialSideSharingConfigs.push({dr: -1, dc: 0});
        } else { // Current DOWN is in an EVEN row
            // Base connects to (r-1, c-1) AND (r-1, c) in ODD row above. Both must be UP.
            potentialSideSharingConfigs.push({dr: -1, dc: -1});
            potentialSideSharingConfigs.push({dr: -1, dc: 0});
        }
    }
    
    for (const config of potentialSideSharingConfigs) {
        const nr = r + config.dr;
        const nc = c + config.dc;
        
        const numTilesInNeighborRow = getNumVisualTilesInRow(nr);

        if (nr >= 0 && nr < numGridRows && nc >= 0 && nc < numTilesInNeighborRow) {
            const neighborTile = grid[nr]?.[nc];
            if (neighborTile) {
                const neighborCanonicalOrientation = getExpectedOrientation(nr, nc, numTilesInNeighborRow);
                // For side-sharing, orientations must be opposite.
                if (neighborCanonicalOrientation !== currentOrientation) { 
                    neighbors.push({r: nr, c: nc});
                }
            }
        }
    }
    // Remove duplicates: A tile might be listed twice if the config logic isn't perfectly exclusive.
    const uniqueKeys = new Set<string>();
    const uniqueNeighbors: {r:number, c:number}[] = [];
    for(const neighbor of neighbors){
        const key = `${neighbor.r},${neighbor.c}`;
        if(!uniqueKeys.has(key)){
            uniqueKeys.add(key);
            uniqueNeighbors.push(neighbor);
        }
    }
    return uniqueNeighbors;
}


export const findAndMarkMatches = async (grid: GridData): Promise<{ newGrid: GridData, hasMatches: boolean, matchCount: number }> => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isMatched: false } : null)); // Preserve isNew
  const { rows: numRows } = await getGridDimensions(newGrid);
  let hasMatches = false;
  let matchCount = 0;
  const visitedOverall = new Set<string>(); 

  for (let r_start = 0; r_start < numRows; r_start++) {
    const numVisualTilesInStartRow = getNumVisualTilesInRow(r_start);
    for (let c_start = 0; c_start < numVisualTilesInStartRow; c_start++) {
      const startTileKey = `${r_start},${c_start}`;
      const startTile = newGrid[r_start]?.[c_start];

      if (!startTile || startTile.isMatched || visitedOverall.has(startTileKey)) {
        continue;
      }

      const targetColor = startTile.color;
      const queue: { r: number, c: number }[] = [{ r: r_start, c: c_start }];
      const componentCoords: { r: number, c: number }[] = [];
      const visitedThisBFS = new Set<string>(); // Tiles visited in *this specific* BFS traversal
      
      visitedThisBFS.add(startTileKey);
      // componentCoords.push({ r: r_start, c: c_start }); // Add start tile to component immediately
      
      let head = 0;
      while(head < queue.length) {
        const currentPos = queue[head++];
        
        // Add to component and overall visited *when dequeued for processing*
        if(!componentCoords.find(p => p.r === currentPos.r && p.c === currentPos.c)) {
            componentCoords.push(currentPos);
        }
        visitedOverall.add(`${currentPos.r},${currentPos.c}`);

        const neighbors = await getNeighbors(currentPos.r, currentPos.c, newGrid);
        for (const neighborPos of neighbors) {
          const neighborKey = `${neighborPos.r},${neighborPos.c}`;
          const neighborTile = newGrid[neighborPos.r]?.[neighborPos.c];

          if (neighborTile && neighborTile.color === targetColor && !visitedThisBFS.has(neighborKey)) {
             if (!neighborTile.isMatched) { // Only add to queue if not already part of a confirmed match
                visitedThisBFS.add(neighborKey);
                queue.push(neighborPos);
             }
          }
        }
      }
      
      if (componentCoords.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
        hasMatches = true;
        componentCoords.forEach(pos => {
          const tileToMark = newGrid[pos.r]?.[pos.c];
          if (tileToMark && !tileToMark.isMatched) { // check !isMatched before incrementing
             tileToMark.isMatched = true;
             matchCount++;
          }
        });
      }
    }
  }
  return { newGrid, hasMatches, matchCount };
};

export const removeMatchedTiles = async (grid: GridData): Promise<GridData> => {
  return grid.map(row => row.map(tile => (tile && tile.isMatched ? null : tile)));
};

export const applyGravityAndSpawn = async (grid: GridData): Promise<GridData> => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows } = await getGridDimensions(newGrid);

  for (let c = 0; c < GAME_SETTINGS.GRID_WIDTH_TILES; c++) { // Iterate over data columns
    let writeRow = numRows - 1; 
    for (let r = numRows - 1; r >= 0; r--) {
      const numVisualTilesInRowR = getNumVisualTilesInRow(r);
      const numVisualTilesInWriteRow = getNumVisualTilesInRow(writeRow);

      if (c < numVisualTilesInRowR) { // Only process if 'c' is a visual column for row 'r'
        if (newGrid[r][c] !== null) {
          const tileToFall = newGrid[r][c]!;
          // Ensure writeRow and c are valid for the target visual shape
          if (c < numVisualTilesInWriteRow) {
            if (r !== writeRow) {
              newGrid[writeRow][c] = {
                ...tileToFall,
                id: tileToFall.id, 
                row: writeRow,
                col: c,
                orientation: getExpectedOrientation(writeRow, c, numVisualTilesInWriteRow),
                isNew: false, 
              };
              newGrid[r][c] = null;
            }
            writeRow--;
          } else {
             // Tile at (r,c) cannot fall into (writeRow, c) because 'c' is out of visual bounds for 'writeRow'
             // It effectively stays, or if writeRow was lower, it might mean this column part is full.
             // This can get complex if shapes change. For Trism, 'writeRow' advances for any non-null.
             // If (r,c) has a tile but (writeRow,c) is not visual, this implies complex fall like Trism.
             // For simplicity here, if target is not visual, we assume tile stays if r === writeRow.
             // If r !== writeRow, then it means writeRow already filled past this column, so advance writeRow.
             if (r === writeRow) writeRow--; // It stays, consider next slot above it.
          }
        }
      } else {
        // If current (r,c) is not visual, but writeRow is checking it, it means writeRow might be
        // for a wider row type. Treat (r,c) as empty for falling purposes.
      }
       // Ensure writeRow doesn't go < 0
       if (writeRow < 0 && r > 0 && newGrid[r-1]?.[c] !== null) {
           // This can happen if a tall stack means writeRow goes negative.
           // It implies the column is full to the top.
       }
    }
  }

  // Spawn new tiles
  for (let r = 0; r < numRows; r++) {
    const numVisualTilesInThisRow = getNumVisualTilesInRow(r);
    for (let c = 0; c < numVisualTilesInThisRow; c++) {
      if (newGrid[r][c] === null) {
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: getExpectedOrientation(r, c, numVisualTilesInThisRow),
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
    const tempGridLeft = JSON.parse(JSON.stringify(grid));
    const gridAfterLeftSlide = await slideRow(tempGridLeft, r_slide, 'left');
    const { hasMatches: leftSlideHasMatches } = await findAndMarkMatches(gridAfterLeftSlide);
    if (leftSlideHasMatches) return false;

    const tempGridRight = JSON.parse(JSON.stringify(grid));
    const gridAfterRightSlide = await slideRow(tempGridRight, r_slide, 'right');
    const { hasMatches: rightSlideHasMatches } = await findAndMarkMatches(gridAfterRightSlide);
    if (rightSlideHasMatches) return false;
  }
  
  const checkedDiagonals = new Set<string>(); // To avoid redundant checks on same mathematical diagonal
  for (let r_diag_start = 0; r_diag_start < numRows; r_diag_start++) {
    const numVisualTilesInRowR = getNumVisualTilesInRow(r_diag_start);
    for (let c_diag_start = 0; c_diag_start < numVisualTilesInRowR; c_diag_start++) {
      const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
      for (const type of diagonalTypes) {
        // Get the full line based on starting point
        const lineCoords = await getTilesOnDiagonal(grid, r_diag_start, c_diag_start, type);
        if (lineCoords.length < 1) continue;

        // Create a canonical key for this specific list of coordinates to avoid re-checking
        // if another start point (r_diag_start, c_diag_start) yields the same lineCoords.
        const canonicalLineKey = `${type}-${lineCoords.map(lc => `${lc.r},${lc.c}`).join('|')}`;
        if (checkedDiagonals.has(canonicalLineKey)) continue;
        checkedDiagonals.add(canonicalLineKey);

        const tempGridForward = JSON.parse(JSON.stringify(grid));
        const gridAfterForwardSlide = await slideLine(tempGridForward, lineCoords, 'forward');
        const { hasMatches: forwardSlideHasMatches } = await findAndMarkMatches(gridAfterForwardSlide);
        if (forwardSlideHasMatches) return false;

        const tempGridBackward = JSON.parse(JSON.stringify(grid));
        const gridAfterBackwardSlide = await slideLine(tempGridBackward, lineCoords, 'backward');
        const { hasMatches: backwardSlideHasMatches } = await findAndMarkMatches(gridAfterBackwardSlide);
        if (backwardSlideHasMatches) return false;
      }
    }
  }
  return true;
};
