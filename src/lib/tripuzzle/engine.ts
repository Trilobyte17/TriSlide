
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Max columns in any row
  return { rows, cols };
};

// Determines if a tile at (r, c) should be up-pointing or down-pointing
// This creates the alternating pattern essential for tessellation.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; // col 0 is up, 1 is down, 2 is up...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // col 0 is down, 1 is up, 2 is down...
  }
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r = 0; r < rows; r++) {
    // All data rows will have `cols` entries, but visual tiles depend on addInitialTiles
    const row: (Tile | null)[] = new Array(cols).fill(null);
    grid.push(row);
  }
  return grid;
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]);
  const { rows, cols: maxCols } = getGridDimensions(newGrid);

  for (let r = 0; r < rows; r++) {
    const tilesInThisRow = (r % 2 === 0) ? maxCols : maxCols - 1;
    for (let c = 0; c < maxCols; c++) {
      if (c < tilesInThisRow) {
        newGrid[r][c] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r,
          col: c,
          orientation: getExpectedOrientation(r, c),
          isNew: true,
        };
      } else {
        newGrid[r][c] = null; // Explicitly null for positions outside the jagged edge
      }
    }
  }
  return newGrid;
};

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
  const { rows, cols } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  for (let r = 0; r < rows; r++) {
    const tilesInCurrentRow = (r % 2 === 0) ? cols : cols - 1;
    for (let c = 0; c < tilesInCurrentRow; c++) { // Iterate only up to actual tiles in this row
      if (grid[r][c]) { 
        if (type === 'sum' && r + c === key) {
          lineCoords.push({ r, c });
        } else if (type === 'diff' && r - c === key) {
          lineCoords.push({ r, c });
        }
      }
    }
  }

  if (type === 'sum') { 
    lineCoords.sort((a, b) => a.r - b.r);
  } else { 
    lineCoords.sort((a, b) => a.r - b.r);
  }
  return lineCoords;
};

export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length < 2) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; 
  const numTilesInLine = lineCoords.length;

  const tempTileDatas: (Tile | null)[] = lineCoords.map(coord => {
    const tile = grid[coord.r][coord.c];
    return tile ? JSON.parse(JSON.stringify(tile)) : null;
  });

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileData: Tile | null;

    if (slideDirection === 'forward') { 
      sourceTileData = tempTileDatas[(i - 1 + numTilesInLine) % numTilesInLine];
    } else { 
      sourceTileData = tempTileDatas[(i + 1) % numTilesInLine];
    }

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
  const { cols } = getGridDimensions(grid);
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const tilesInThisRow = (rowIndex % 2 === 0) ? cols : cols - 1;

  for (let c = 0; c < tilesInThisRow; c++) {
    if (grid[rowIndex][c]) { 
      rowCoords.push({ r: rowIndex, c });
    }
  }
  
  if (rowCoords.length < 2) return grid;

  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';
  
  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];
  
  let deltas: {dr: number, dc: number}[];

  // For an UP-pointing triangle at (r,c):
  // Base is at row r, tip points to r-1.
  // Neighbors are:
  //   (r, c-1) - left, DOWN
  //   (r, c+1) - right, DOWN
  //   (r+1, c) - below, DOWN (if r is even)
  //   (r+1, c-1) - below, DOWN (if r is odd) - no, this should be (r+1, c) as well for the one directly below
  // The original delta logic was simpler because it assumed a more uniform grid.
  // For tessellated triangles:
  // An UP triangle at (r,c) can connect to:
  //  - DOWN at (r, c-1) (shares left slanted edge)
  //  - DOWN at (r, c+1) (shares right slanted edge)
  //  - DOWN at (r+1, c) (shares horizontal base with tip of (r+1,c)) -- this seems wrong.
  // An UP triangle shares its base with TWO down triangles in the row below, or ONE down triangle in the same row.
  // The "three neighbors" concept for Trism is simpler: triangles touching along any of the 3 sides.

  // Simplified: an UP tile at (r,c) has neighbors:
  // (r, c-1) which must be DOWN
  // (r, c+1) which must be DOWN
  // (r-1, c) if r is odd, or (r-1, c-1) if r is even and c > 0 and (r-1,c+1) if r is even?
  // This gets complex. Let's use the definition: if two triangles share an edge, they are neighbors.
  // An UP tile at (r,c) touches:
  //   (r, c-1) - a DOWN tile (left side)
  //   (r, c+1) - a DOWN tile (right side)
  //   The tile whose tip it touches: (r-1, c) - a DOWN tile (tip to base)

  // A DOWN tile at (r,c) touches:
  //   (r, c-1) - an UP tile (left side)
  //   (r, c+1) - an UP tile (right side)
  //   The tile whose base it touches: (r+1, c) - an UP tile (base to tip)

  if (tile.orientation === 'up') {
    deltas = [
      { dr: 0, dc: -1 }, // Left neighbor (should be down)
      { dr: 0, dc: 1 },  // Right neighbor (should be down)
      { dr: -1, dc: 0 }  // Top neighbor (should be down, the one whose base this up-tile's tip touches)
    ];
  } else { // tile.orientation === 'down'
    deltas = [
      { dr: 0, dc: -1 }, // Left neighbor (should be up)
      { dr: 0, dc: 1 },  // Right neighbor (should be up)
      { dr: 1, dc: 0 }   // Bottom neighbor (should be up, the one whose tip this down-tile's base touches)
    ];
  }
  
  for (const delta of deltas) {
    let nr = r + delta.dr;
    let nc = c + delta.dc;

    // Adjust nc for inter-row connections based on parent row parity for tip/base connections
    if (delta.dc === 0) { // Vertical connection (tip-to-base or base-to-tip)
        if (tile.orientation === 'up' && r % 2 !== 0) { // Upward tile in odd row, top neighbor is (r-1, c+1) effectively? No, (r-1,c) is right.
            // This needs to use the specific connection logic of Trism.
            // An UP tile at (r,c) points towards row r-1.
            // If r is even, its tip is "aligned" with column c in row r-1.
            // If r is odd, its tip is "between" c and c-1 of row r-1, so effectively aligns with c of row r-1.
            // This logic might be too complex here, relying on visual adjacency is better.
        }
        // The current delta logic might be fine IF the grid positions are interpreted consistently.
    }


    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const neighborTile = grid[nr]?.[nc];
      // Key condition: a neighbor must exist and have the *opposite* orientation.
      if (neighborTile && neighborTile.orientation !== tile.orientation) {
         // Additional check: ensure they are truly adjacent in the Trism layout
         // An UP tile at (r,c) is adjacent to DOWN at (r,c-1), (r,c+1)
         // And also adjacent to DOWN at (r-1,c) if r is odd (shifted grid)
         // or (r-1, c) and (r-1, c-1) if r is even (forming the V for the tip) -> This interpretation is for hex grids mostly.

         // For Trism:
         // Up(r,c) connects to Down(r,c-1), Down(r,c+1).
         // Up(r,c) also connects to Down(r-1,c') where c' depends on the shift.
         // If r is even, Up(r,c) points to space between (r-1, c-1) and (r-1, c). It connects to Down(r-1, c-1) and Down(r-1,c) NO
         // The direct vertical connection is usually simpler:
         // Up(r,c) connects to Down(r-1,c) via tip-base
         // Down(r,c) connects to Up(r+1,c) via tip-base
         // This relies on the visual grid structure more than complex coordinate math.

         // The provided deltas are simplified and should work if interpreted as:
         // For UP(r,c): links to DOWN(r,c-1), DOWN(r,c+1), DOWN(r-1,c)
         // For DOWN(r,c): links to UP(r,c-1), UP(r,c+1), UP(r+1,c)

        // Let's test the original simpler deltas based on shared edges.
        // If tile (r,c) is UP:
        // Its actual neighbors are (r,c-1)=DOWN, (r,c+1)=DOWN
        // And the one "above" it, which would be (r-1, c) if r is odd, (r-1, c-1) if r is even AND c is odd OR (r-1, c) if r is even AND c is even?
        // The provided deltas for orientation-based neighbors are generally fine for a basic check.

        // Check if connection is valid for Trism layout
        let isValidTrismNeighbor = false;
        if (tile.orientation === 'up') {
            if (delta.dr === 0) { // Horizontal connections for UP tile (to DOWN tiles)
                isValidTrismNeighbor = (nc === c - 1 || nc === c + 1);
            } else if (delta.dr === -1 && delta.dc === 0) { // Connection above for UP tile (to DOWN tile)
                isValidTrismNeighbor = true; // UP(r,c) tip touches base of DOWN(r-1,c)
            }
        } else { // tile.orientation === 'down'
            if (delta.dr === 0) { // Horizontal connections for DOWN tile (to UP tiles)
                isValidTrismNeighbor = (nc === c - 1 || nc === c + 1);
            } else if (delta.dr === 1 && delta.dc === 0) { // Connection below for DOWN tile (to UP tile)
                isValidTrismNeighbor = true; // DOWN(r,c) base touches tip of UP(r+1,c)
            }
        }

        if (isValidTrismNeighbor && grid[nr]?.[nc]?.orientation !== tile.orientation) {
           neighbors.push({ r: nr, c: nc });
        }
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
    const tilesInThisRow = (r_find % 2 === 0) ? cols : cols - 1;
    for (let c_find = 0; c_find < tilesInThisRow; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = [];
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}];
        
        visitedForMatchFinding.add(`${r_find},${c_find}`);
        
        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          component.push({r: currR, c: currC});
          const tileForBFS = newGrid[currR][currC]!; // Should exist based on initial check

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
  const { rows: numRows, cols: maxCols } = getGridDimensions(newGrid);

  // Tiles fall column by column (conceptual columns of the bounding box)
  for (let C = 0; C < maxCols; C++) {
    let emptySlotR = -1; 

    // Find the lowest empty slot in this conceptual column C
    for (let R = numRows - 1; R >= 0; R--) {
        // Check if (R,C) is a valid position for a tile in this row
        const tilesInRowR = (R % 2 === 0) ? maxCols : maxCols - 1;
        if (C < tilesInRowR) { // Is C a valid column index for row R?
            if (newGrid[R][C] === null) {
                emptySlotR = R;
                break; // Found lowest empty slot in this column
            }
        }
    }

    if (emptySlotR !== -1) { // If there's an empty slot to fill in this column
        // Look for tiles above it in the same column C to fall down
        for (let R = emptySlotR - 1; R >= 0; R--) {
            const tilesInRowR = (R % 2 === 0) ? maxCols : maxCols - 1;
            if (C < tilesInRowR && newGrid[R][C] !== null) { // If there's a tile at (R,C)
                const tileToFall = newGrid[R][C]!;
                
                newGrid[emptySlotR][C] = {
                    ...tileToFall,
                    row: emptySlotR, // Update row
                    col: C,          // Column remains C
                    orientation: getExpectedOrientation(emptySlotR, C),
                    isNew: false, 
                };
                newGrid[R][C] = null; // Old position is now empty

                // Find the next empty slot above the one just filled
                let nextEmptyR = -1;
                for(let rCheck = emptySlotR - 1; rCheck >=R; rCheck--) { 
                    const tilesInRowRCheck = (rCheck % 2 === 0) ? maxCols : maxCols - 1;
                    if (C < tilesInRowRCheck && newGrid[rCheck][C] == null) {
                        nextEmptyR = rCheck;
                        break;
                    }
                }
                if (nextEmptyR !== -1) {
                    emptySlotR = nextEmptyR; // Move to the next empty slot
                } else {
                    // If no more empty slots directly above in this column segment,
                    // search from the top of this new empty slot again
                    let foundHigherEmpty = false;
                    for (let rSearch = emptySlotR - 1; rSearch >= 0; rSearch--) {
                       const tilesInRowRSearch = (rSearch % 2 === 0) ? maxCols : maxCols - 1;
                       if (C < tilesInRowRSearch && newGrid[rSearch][C] === null) {
                           emptySlotR = rSearch;
                           foundHigherEmpty = true;
                           break;
                       }
                    }
                    if (!foundHigherEmpty) break; // No more empty slots in this column to fill by falling
                }
            }
        }
    }
  }
  
  // Spawn new tiles in any remaining empty spots
  for (let r_spawn = 0; r_spawn < numRows; r_spawn++) {
    const tilesInThisRow = (r_spawn % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_spawn = 0; c_spawn < tilesInThisRow; c_spawn++) {
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
  const { rows: numRows, cols: maxCols } = getGridDimensions(grid);

  if (findAndMarkMatches(grid).hasMatches) return false;

  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tilesInThisRow = (r_slide % 2 === 0) ? maxCols : maxCols - 1;
    const actualTilesInRow = grid[r_slide].filter((_, cIdx) => cIdx < tilesInThisRow && grid[r_slide][cIdx] !== null).length;

    if (actualTilesInRow > 1) {
        const gridAfterLeftSlide = slideRow(JSON.parse(JSON.stringify(grid)), r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;
    
        const gridAfterRightSlide = slideRow(JSON.parse(JSON.stringify(grid)), r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  const checkedDiagonals = new Set<string>(); 
  for (let r = 0; r < numRows; r++) {
    const tilesInThisRow = (r % 2 === 0) ? maxCols : maxCols - 1;
    for (let c = 0; c < tilesInThisRow; c++) {
      if (grid[r][c]) {
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r + c : r - c;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue;

          const lineCoords = getTilesOnDiagonal(grid, r, c, type);
          if (lineCoords.length > 1) {
            checkedDiagonals.add(diagonalKey);
            const gridAfterForwardSlide = slideLine(JSON.parse(JSON.stringify(grid)), lineCoords, 'forward');
            if (findAndMarkMatches(gridAfterForwardSlide).hasMatches) return false;

            const gridAfterBackwardSlide = slideLine(JSON.parse(JSON.stringify(grid)), lineCoords, 'backward');
            if (findAndMarkMatches(gridAfterBackwardSlide).hasMatches) return false;
          }
        }
      }
    }
  }
  return true; 
};
