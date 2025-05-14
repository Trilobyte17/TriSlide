
import type { GridData, Tile, GridDimensions, DiagonalType, SlideDirection } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

export const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0; // Max columns in any row
  return { rows, cols };
};

// Determines if a tile at (r, c) should be up-pointing or down-pointing.
// This creates the alternating pattern essential for tessellation.
// Odd rows have an inverted (or "flipped") orientation pattern compared to even rows.
export const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r % 2 === 0) { // Even rows (0, 2, 4...)
    return c % 2 === 0 ? 'up' : 'down'; // Pattern: UP, DOWN, UP...
  } else { // Odd rows (1, 3, 5...)
    return c % 2 === 0 ? 'down' : 'up'; // Pattern: DOWN, UP, DOWN... (inverted from even rows)
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
  const { rows, cols: maxCols } = getGridDimensions(newGrid); // maxCols will be GRID_WIDTH_TILES

  for (let r = 0; r < rows; r++) {
    // Number of visual tiles in this row. Odd rows have one less.
    const tilesInThisRow = (r % 2 === 0) ? maxCols : maxCols - 1;
    for (let c = 0; c < maxCols; c++) { // Iterate up to maxCols for data array consistency
      if (c < tilesInThisRow) { // Only create a tile if it's within the visual boundary of this row
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

  for (let r_iter = 0; r_iter < rows; r_iter++) {
    const tilesInCurrentRow = (r_iter % 2 === 0) ? cols : cols - 1;
    for (let c_iter = 0; c_iter < tilesInCurrentRow; c_iter++) {
      if (grid[r_iter][c_iter]) {
        if (type === 'sum' && r_iter + c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        } else if (type === 'diff' && r_iter - c_iter === key) {
          lineCoords.push({ r: r_iter, c: c_iter });
        }
      }
    }
  }

  // Sort for consistent sliding behavior
  if (type === 'sum') { // '/' diagonal, sort by increasing row (top to bottom-left)
    lineCoords.sort((a, b) => a.r - b.r);
  } else { // '\' diagonal, sort by increasing row (top to bottom-right)
    lineCoords.sort((a, b) => a.r - b.r);
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
    let sourceTileData: Tile | null;
    let newTileIndex;

    if (slideDirection === 'forward') {
      newTileIndex = (i - 1 + numTilesInLine) % numTilesInLine;
      if (i === 0) { // The tile that "appears" at the start of the slide
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
    } else { // backward
      newTileIndex = (i + 1) % numTilesInLine;
       if (i === numTilesInLine - 1) { // The tile that "appears" at the end of the slide
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
        ...sourceTileData,
        id: sourceTileData.id, // Keep ID if it's an existing tile moving, new ID if spawned
        color: sourceTileData.color,
        row: targetCoord.r,
        col: targetCoord.c,
        orientation: getExpectedOrientation(targetCoord.r, targetCoord.c),
        isNew: sourceTileData.isNew ?? (i === 0 && slideDirection === 'forward') || (i === numTilesInLine - 1 && slideDirection === 'backward'),
        isMatched: false,
      };
    } else {
      // This case should ideally not be reached if originalTilesData is correctly populated
      // and new tiles are spawned correctly.
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

  for (let c = 0; c < tilesInThisRowVisual; c++) {
    // Ensure we only add coordinates for actual tiles, not null placeholders
    if (grid[rowIndex][c]) {
      rowCoords.push({ r: rowIndex, c });
    }
  }
  
  if (rowCoords.length < 2) return grid;

  // For horizontal rows, 'left' slide means tiles move "forward" (index decreases)
  // 'right' slide means tiles move "backward" (index increases)
  const slideDir: SlideDirection = direction === 'left' ? 'forward' : 'backward';

  return slideLine(grid, rowCoords, slideDir);
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols: maxCols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  // Deltas define potential neighbor positions relative to (r,c)
  // These are based on the hexagonal nature of the triangular grid
  const deltas = [
    // Horizontal neighbors (differ only by column)
    { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
  ];

  // Diagonal neighbors depend on the orientation of the current tile
  if (tile.orientation === 'up') {
    // An UP-pointing tile has one neighbor directly "above" it in grid data terms
    // (which is visually its tip connecting to the base of a DOWN tile)
    // and two neighbors diagonally "below" it (its base corners touching tips of UP tiles)
    // For UP-pointing, the third direct connection is "above" in terms of data (r-1), sharing its tip.
    // In a Trism grid, the "flat" side is at the bottom for UP.
    // The neighbors are across its three sides.
    // Side 1 (left diagonal): r, c-1 (already covered by horizontal)
    // Side 2 (right diagonal): r, c+1 (already covered by horizontal)
    // Side 3 (base): The tile below it (r+1) that shares the base.
    // This connection is with a DOWN-pointing triangle at (r+1, c) if r is even, or (r+1, c-1) if r is odd.
    // No, this is simpler: an UP tile connects to one DOWN tile above its tip.
    // And two DOWN tiles below its base corners.
     deltas.push({ dr: -1, dc: 0 }); // Tile directly above (tip connection)

  } else { // 'down' orientation
    // A DOWN-pointing tile has one neighbor directly "below" it
    // and two neighbors diagonally "above" it.
    // Its tip connects "downwards".
     deltas.push({ dr: 1, dc: 0 }); // Tile directly below (tip connection)
  }


  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < maxCols) {
      const neighborTile = grid[nr]?.[nc];
      // Check if nc is within the visual boundary of the neighbor row
      const tilesInNeighborRow = (nr % 2 === 0) ? maxCols : maxCols - 1;

      if (neighborTile && nc < tilesInNeighborRow) {
        // Key condition for adjacency: orientations must be different.
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

  const visitedForMatchFinding = new Set<string>(); // To avoid re-processing tiles in the same component

  for (let r_find = 0; r_find < rows; r_find++) {
    const tilesInThisRow = (r_find % 2 === 0) ? maxCols : maxCols - 1;
    for (let c_find = 0; c_find < tilesInThisRow; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = []; // Stores tiles in the current connected component
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}]; // Queue for BFS

        visitedForMatchFinding.add(`${r_find},${c_find}`);
        component.push({r:r_find, c:c_find});

        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          // No, component.push({r: currR, c: currC}) should be here, AFTER checking it's valid and part of the component.
          // It's added above, which is fine if we ensure BFS explores correctly.

          const tileForBFS = newGrid[currR][currC]!; // Should be non-null as it's from the queue

          const neighborsOfCurrent = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighborsOfCurrent) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
              component.push(neighborPos); // Add to component
              q.push(neighborPos); // Add to queue for further exploration
            }
          }
        }

        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r][pos.c] && !newGrid[pos.r][pos.c]!.isMatched) { // Double check not already marked
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

  // Apply gravity: Make tiles fall down
  for (let c_grav = 0; c_grav < maxCols; c_grav++) { // Iterate through each conceptual column
    let emptySlotR = -1; // Lowest empty row found so far in this column

    // Find the lowest empty slot in the current column `c_grav`
    for (let r_grav = numRows - 1; r_grav >= 0; r_grav--) {
      const tilesInRowRGrav = (r_grav % 2 === 0) ? maxCols : maxCols - 1;
      if (c_grav < tilesInRowRGrav) { // Is c_grav a valid visual column in this row?
        if (newGrid[r_grav][c_grav] === null) {
          emptySlotR = r_grav;
          break; // Found the lowest empty slot for this column
        }
      }
    }

    // If an empty slot was found, try to fill it from above
    if (emptySlotR !== -1) {
      for (let r_above = emptySlotR - 1; r_above >= 0; r_above--) {
        const tilesInRowRAbove = (r_above % 2 === 0) ? maxCols : maxCols - 1;
        if (c_grav < tilesInRowRAbove && newGrid[r_above][c_grav] !== null) {
          const tileToFall = newGrid[r_above][c_grav]!;
          newGrid[emptySlotR][c_grav] = {
            ...tileToFall,
            row: emptySlotR,
            col: c_grav, // Column remains the same
            orientation: getExpectedOrientation(emptySlotR, c_grav),
            isNew: false, // It's a falling tile, not new
          };
          newGrid[r_above][c_grav] = null; // Vacate the original position

          // Update emptySlotR to the new lowest empty slot, which is r_above
          // This allows for multi-tile drops in a single pass for a column
          emptySlotR = r_above; 
          // No, we need to re-scan for the *next* lowest empty slot from r_above upwards.
          // Simpler: find next empty slot from the one just filled.
           let nextEmptyR = -1;
           for(let rCheck = emptySlotR; rCheck >=0; rCheck--){ // check from the slot we just moved tile into
                const tilesInRowRCheck = (rCheck % 2 === 0) ? maxCols : maxCols - 1;
                if (c_grav < tilesInRowRCheck && newGrid[rCheck][c_grav] == null) {
                    nextEmptyR = rCheck;
                    break;
                }
           }
           if(nextEmptyR !== -1) emptySlotR = nextEmptyR;
           else break; // No more empty slots above in this column to continue filling from current emptySlotR
        }
      }
    }
  }

  // Spawn new tiles in any remaining empty slots at the top
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

  // If there are any existing matches, game is not over
  if (findAndMarkMatches(grid).hasMatches) return false;

  // Try sliding each row
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    // Check if the row has enough tiles to slide (at least 2, though slideLine handles <2)
    const tilesInThisDataRow = grid[r_slide].filter(tile => tile !== null).length;
    if (tilesInThisDataRow > 1) { // Meaningful to slide if more than 1 tile
        const tempGridLeft = JSON.parse(JSON.stringify(grid));
        const gridAfterLeftSlide = slideRow(tempGridLeft, r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

        const tempGridRight = JSON.parse(JSON.stringify(grid));
        const gridAfterRightSlide = slideRow(tempGridRight, r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  // Try sliding each diagonal
  const checkedDiagonals = new Set<string>(); // To avoid redundant checks for the same diagonal line
  for (let r = 0; r < numRows; r++) {
    const tilesInThisRow = (r % 2 === 0) ? maxCols : maxCols - 1;
    for (let c = 0; c < tilesInThisRow; c++) {
      if (grid[r][c]) { // Only consider actual tiles as starting points for diagonals
        const diagonalTypes: DiagonalType[] = ['sum', 'diff'];
        for (const type of diagonalTypes) {
          const key = type === 'sum' ? r + c : r - c;
          const diagonalKey = `${type}-${key}`;
          if (checkedDiagonals.has(diagonalKey)) continue; // Already checked this diagonal

          const lineCoords = getTilesOnDiagonal(grid, r, c, type);
          if (lineCoords.length > 1) { // Meaningful to slide if more than 1 tile
            checkedDiagonals.add(diagonalKey); // Mark this diagonal as checked

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
