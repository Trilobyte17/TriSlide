
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Max columns in any row
  return { rows, cols };
};

// Determines if a tile at (r, c) should be up-pointing or down-pointing.
// This is critical for the tessellation.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; // Pattern: UP, DOWN, UP...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // Pattern: DOWN, UP, DOWN... (inverted/mirrored from even rows)
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
  const { rows, cols: maxCols } = getGridDimensions(newGrid); 

  for (let r_add = 0; r_add < rows; r_add++) {
    const tilesInThisRowVisual = (r_add % 2 === 0) ? maxCols : maxCols - 1; // Even rows: maxCols, Odd rows: maxCols - 1
    for (let c_add = 0; c_add < maxCols; c_add++) { 
      if (c_add < tilesInThisRowVisual) { 
        newGrid[r_add][c_add] = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: r_add,
          col: c_add,
          orientation: getExpectedOrientation(r_add, c_add),
          isNew: true,
        };
      } else {
        newGrid[r_add][c_add] = null; // Explicitly null for positions beyond the visual row length
      }
    }
  }
  return newGrid;
};

export const getTilesOnDiagonal = (grid: GridData, startR: number, startC: number, type: DiagonalType): {r: number, c: number}[] => {
  const { rows, cols } = getGridDimensions(grid);
  const lineCoords: {r: number, c: number}[] = [];
  const key = type === 'sum' ? startR + startC : startR - startC;

  for (let r_iter = 0; r_iter < rows; r_iter++) {
    const tilesInCurrentRow = (r_iter % 2 === 0) ? cols : cols - 1;
    for (let c_iter = 0; c_iter < tilesInCurrentRow; c_iter++) {
      if (grid[r_iter][c_iter]) { // Check if tile exists at this position
        if (type === 'sum' && r_iter + c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        } else if (type === 'diff' && r_iter - c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        }
      }
    }
  }

  if (type === 'sum') { 
    lineCoords.sort((a, b) => a.r - b.r); // Sort by row, then effectively by decreasing column
  } else { // 'diff'
    lineCoords.sort((a, b) => a.r - b.r); // Sort by row, then effectively by increasing column
  }
  return lineCoords;
};

export const slideLine = (grid: GridData, lineCoords: {r: number, c: number}[], slideDirection: SlideDirection): GridData => {
  if (!lineCoords || lineCoords.length < 2) return grid;

  const newGrid = JSON.parse(JSON.stringify(grid)) as GridData; // Deep copy
  const numTilesInLine = lineCoords.length;

  const originalTilesData = lineCoords.map(coord => grid[coord.r][coord.c]);

  for (let i = 0; i < numTilesInLine; i++) {
    const targetCoord = lineCoords[i];
    let sourceTileData: Tile | null;
    let newTileIndex;

    if (slideDirection === 'forward') { // Tiles shift "down" or "right" along the line
      newTileIndex = (i - 1 + numTilesInLine) % numTilesInLine;
      if (i === 0) { // New tile appears at the start of the line
        sourceTileData = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
          isNew: true,
        };
      } else {
         sourceTileData = originalTilesData[newTileIndex];
      }
    } else { // 'backward' - Tiles shift "up" or "left" along the line
      newTileIndex = (i + 1) % numTilesInLine;
       if (i === numTilesInLine - 1) { // New tile appears at the end of the line
         sourceTileData = {
          id: generateUniqueId(),
          color: getRandomColor(),
          row: targetCoord.r,
          col: targetCoord.c,
          orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
          isNew: true,
        };
       } else {
         sourceTileData = originalTilesData[newTileIndex];
       }
    }

    if (sourceTileData) {
      newGrid[targetCoord.r][targetCoord.c] = {
        ...sourceTileData, // Spread existing properties like ID if it's a shifted tile
        id: sourceTileData.id, 
        color: sourceTileData.color, // Ensure new color if it's a new tile
        row: targetCoord.r, // Update row/col to target position
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c), // Orientation is fixed by position
        isNew: sourceTileData.isNew ?? (i === 0 && slideDirection === 'forward') || (i === numTilesInLine - 1 && slideDirection === 'backward'),
        isMatched: false, // Reset matched status on slide
      };
    } else {
      // This case should ideally not be hit if lineCoords are valid and originalTilesData is populated
      newGrid[targetCoord.r][targetCoord.c] = null;
    }
  }
  return newGrid;
};


export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const { cols } = getGridDimensions(grid);
  if (rowIndex < 0 || rowIndex >= grid.length) return grid;

  const rowCoords: {r: number, c: number}[] = [];
  const tilesInThisRowVisual = (rowIndex % 2 === 0) ? cols : cols - 1;

  for (let c_slide = 0; c_slide < tilesInThisRowVisual; c_slide++) {
    if (grid[rowIndex][c_slide]) { // Only consider actual tiles
      rowCoords.push({ r: rowIndex, c: c_slide });
    }
  }
  
  if (rowCoords.length < 2) return grid; // Need at least 2 tiles to slide

  // For horizontal rows: 'left' drag means tiles move forward visually (0th tile replaced, last tile falls off)
  // 'right' drag means tiles move backward visually (last tile replaced, 0th tile falls off)
  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';

  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols: maxCols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  // Define potential neighbor relative coordinates based on tile's orientation
  const deltas = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  if (tile.orientation === 'up') {
     // Up-pointing triangle shares its tip with a down-pointing triangle above it in the same column C or C-1.
     // And its base with a down-pointing triangle below it.
     // Let's consider only adjacent tiles that form a "flat" edge contact.
     // The "tip" neighbor for an UP triangle is the base of a DOWN triangle in the row above.
     // The "base" neighbors for an UP triangle are the tips of DOWN triangles in the same row.
     // More simply, direct orthogonal-ish neighbors for matching logic:
     deltas.push({ dr: -1, dc: 0 }); // Tile directly "above" (shares point)
  } else { // 'down'
     // Down-pointing triangle shares its tip with an up-pointing triangle below it in the same column C or C+1.
     deltas.push({ dr: 1, dc: 0 });  // Tile directly "below" (shares point)
  }

  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    // Check bounds for the neighbor
    if (nr >= 0 && nr < rows && nc >= 0 && nc < maxCols) {
      const neighborTile = grid[nr]?.[nc];
      const tilesInNeighborRow = (nr % 2 === 0) ? maxCols : maxCols - 1; // Max tiles for neighbor's row

      // Ensure the neighbor is within its row's visual bounds and exists
      if (neighborTile && nc < tilesInNeighborRow) {
        // Key condition: Only consider neighbors if their orientation is DIFFERENT.
        // This is how Trism matches form (up touches down).
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
  const { rows, cols: maxCols } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;

  const visitedForMatchFinding = new Set<string>(); // Keep track of tiles already part of a found match component

  for (let r_find = 0; r_find < rows; r_find++) {
    const tilesInThisRow = (r_find % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_find = 0; c_find < tilesInThisRow; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = []; // Tiles in the current connected component
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}]; // Queue for BFS

        visitedForMatchFinding.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          const tileForBFS = newGrid[currR][currC]!; // Should exist as it was added to queue

          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
            // Check if neighbor is of the same color and not yet visited for this component search
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
              component.push(neighborPos); // Add to current component
              q.push(neighborPos); // Add to BFS queue
            }
          }
        }

        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r][pos.c] && !newGrid[pos.r][pos.c]!.isMatched) { // Double check to avoid issues
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

// Apply gravity and spawn new tiles
export const applyGravityAndSpawn = (grid: GridData): GridData => {
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null));
  const { rows: numRows, cols: maxCols } = getGridDimensions(newGrid);

  // Gravity: Iterate from bottom up, column by column (simplified for triangular grid)
  // This needs to be more sophisticated for a true triangular fall.
  // For now, direct vertical fall if possible (tile above is compatible orientation).
  for (let c_grav = 0; c_grav < maxCols; c_grav++) { // Iterate through all possible column indices
    let emptySlotR = -1; // Track the lowest empty slot in current column `c_grav`

    // Find the lowest empty slot in column c_grav that can accept a tile
    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      const tilesInRowRGrav = (r_grav % 2 === 0) ? maxCols : maxCols - 1;
      if (c_grav < tilesInRowRGrav) { // Is (r_grav, c_grav) a valid position in this row?
        if (newGrid[r_grav][c_grav] === null) {
          emptySlotR = r_grav;
          break; // Found the lowest empty slot for this column check
        }
      }
    }

    // If an empty slot was found, try to fill it from above
    if (emptySlotR !== -1) {
      for (let r_above = emptySlotR - 1; r_above >= 0; r_above--) {
        const tilesInRowRAbove = (r_above % 2 === 0) ? maxCols : maxCols - 1;
        if (c_grav < tilesInRowRAbove && newGrid[r_above][c_grav] !== null) {
          // Check if orientations are compatible for a fall
          const tileToFall = newGrid[r_above][c_grav]!;
          const fallingOrientation = tileToFall.orientation;
          const targetOrientation = getExpectedOrientation(emptySlotR, c_grav);

          // Simplistic fall: if a tile exists above, it falls.
          // A more complex gravity would check if the space below can "support" the tile based on orientation.
          // For now, we assume any tile above can fall into an empty space in the same column index
          // and its orientation will be updated.
          
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            row: emptySlotR,
            col: c_grav, 
            orientation: targetOrientation, // Update orientation based on new position
            isNew: false, 
          };
          newGrid[r_above][c_grav] = null; // Vacate the original spot

           // Find the next lowest empty slot in the same column to continue falling
           let nextEmptyR = -1;
           for(let rCheck = emptySlotR; rCheck >=0; rCheck--){ // Start checking from the slot just filled
                const tilesInRowRCheck = (rCheck % 2 === 0) ? maxCols : maxCols - 1;
                if (c_grav < tilesInRowRCheck && newGrid[rCheck][c_grav] == null) {
                    nextEmptyR = rCheck;
                    break;
                }
           }
           if(nextEmptyR !== -1) emptySlotR = nextEmptyR; // Update emptySlotR to the new lowest empty
           else break; // No more empty slots below in this column for this falling sequence
        }
      }
    }
  }

  // Spawn new tiles in any remaining empty spots (top-down)
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

  // Check current grid for matches (should be false if called after processing)
  if (findAndMarkMatches(grid).hasMatches) return false;

  // Try sliding each row
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    const tilesInThisDataRow = grid[r_slide].filter(tile => tile !== null).length;
    if (tilesInThisDataRow > 1) { // Can't slide a row with 0 or 1 tiles effectively
        const tempGridLeft = JSON.parse(JSON.stringify(grid));
        const gridAfterLeftSlide = slideRow(tempGridLeft, r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

        const tempGridRight = JSON.parse(JSON.stringify(grid));
        const gridAfterRightSlide = slideRow(tempGridRight, r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  // Try sliding each possible diagonal
  const checkedDiagonals = new Set<string>(); // To avoid re-checking the same diagonal line
  for (let r_diag = 0; r_diag < numRows; r_diag++) {
    const tilesInThisRow = (r_diag % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_diag = 0; c_diag < tilesInThisRow; c_diag++) {
      if (grid[r_diag][c_diag]) { // If there's a tile here, it can be part of a diagonal
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r_diag + c_diag : r_diag - c_diag;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue; // Already checked this logical diagonal

          const lineCoords = getTilesOnDiagonal(grid, r_diag, c_diag, type);
          if (lineCoords.length > 1) { // Can't slide a diagonal with 0 or 1 tiles
            checkedDiagonals.add(diagonalKey); // Mark this logical diagonal as checked

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

  return true; // No possible moves lead to a match
};

    
