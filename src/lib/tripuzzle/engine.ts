
import type { GridData, Tile, GridDimensions } from './types';
import { GAME_SETTINGS, getRandomColor } from './types';

const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);

const getGridDimensions = (grid: GridData): GridDimensions => {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  return { rows, cols };
};

export const initializeGrid = (rows: number, cols: number): GridData => {
  const grid: GridData = [];
  for (let r = 0; r < rows; r++) {
    const row: (Tile | null)[] = [];
    for (let c = 0; c < cols; c++) {
      // Determine if a tile should exist at this conceptual (r,c)
      // For 'up' tiles: (r is even AND c is even) OR (r is odd AND c is odd)
      // For 'down' tiles: (r is even AND c is odd) OR (r is odd AND c is even)
      // This creates a checkerboard pattern for up/down, but we want to fill the space.
      // A simpler approach: All (r,c) cells in the conceptual grid can hold a tile.
      // The orientation determines its shape and how it fits.
      row.push(null); // Initialize with null, to be filled by addInitialTiles
    }
    grid.push(row);
  }
  return grid;
};


const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  // (0,0) is 'up'. (0,1) is 'down'. (0,2) is 'up'.
  // (1,0) is 'down'. (1,1) is 'up'. (1,2) is 'down'.
  if (r % 2 === 0) { // Even rows
    return c % 2 === 0 ? 'up' : 'down';
  } else { // Odd rows
    return c % 2 === 0 ? 'down' : 'up';
  }
};

export const addInitialTiles = (grid: GridData): GridData => {
  const newGrid = grid.map(row => [...row]); // Create a new grid array
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

export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const newGrid = grid.map(r => r.map(t => t ? {...t, isNew: false, isMatched: false } : null)); // Removed isSelected
  const { rows, cols } = getGridDimensions(newGrid);

  if (rowIndex < 0 || rowIndex >= rows) return newGrid;

  const rowToSlide = newGrid[rowIndex];
  if (cols <= 1) return newGrid; // Cannot slide if only one column or less

  const effectiveColsInRow = rowToSlide.filter(tile => tile !== null).length;
  if (effectiveColsInRow <= 1) return newGrid;


  if (direction === 'left') {
    const firstTile = rowToSlide.shift();
    if (firstTile) rowToSlide.push(firstTile);
  } else { // right
    const lastTile = rowToSlide.pop();
    if (lastTile) rowToSlide.unshift(lastTile);
  }

  // Update col and orientation for all tiles in the slided row
  rowToSlide.forEach((tile, newColIndex) => {
    if (tile) {
      tile.col = newColIndex; // This assumes dense packing after slide
      tile.orientation = getExpectedOrientation(tile.row, tile.col);
    }
  });
  
  // This part is tricky because cols might not be uniform.
  // We need to ensure that the `col` property matches its actual index in the sparse array.
  // And then, re-verify orientations.
  for(let c_idx = 0; c_idx < newGrid[rowIndex].length; c_idx++) {
    const tile = newGrid[rowIndex][c_idx];
    if (tile) {
        tile.col = c_idx; // Ensure col property reflects its position in the array
        tile.orientation = getExpectedOrientation(rowIndex, c_idx);
    }
  }


  return newGrid;
};

export const swapTiles = (grid: GridData, r1: number, c1: number, r2: number, c2: number): GridData => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isNew: false, isMatched: false } : null)); // Removed isSelected
  const tile1Data = newGrid[r1]?.[c1];
  const tile2Data = newGrid[r2]?.[c2];

  if (tile1Data && tile2Data) {
    newGrid[r1][c1] = {
      ...tile2Data,
      row: r1,
      col: c1,
      orientation: getExpectedOrientation(r1, c1),
    };
    newGrid[r2][c2] = {
      ...tile1Data,
      row: r2,
      col: c2,
      orientation: getExpectedOrientation(r2, c2),
    };
  }
  return newGrid;
};

export const rotateTriad = (
  grid: GridData,
  coords1: { r: number; c: number }, 
  coords2: { r: number; c: number }, 
  coords3: { r: number; c: number }  
): GridData => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isNew: false, isMatched: false } : null)); // Removed isSelected

  const tileData1 = { ...newGrid[coords1.r][coords1.c]! }; 
  const tileData2 = { ...newGrid[coords2.r][coords2.c]! }; 
  const tileData3 = { ...newGrid[coords3.r][coords3.c]! }; 

  newGrid[coords1.r][coords1.c] = {
    ...tileData3,
    id: tileData3.id, 
    row: coords1.r,
    col: coords1.c,
    orientation: getExpectedOrientation(coords1.r, coords1.c),
  };
  newGrid[coords2.r][coords2.c] = {
    ...tileData1,
    id: tileData1.id,
    row: coords2.r,
    col: coords2.c,
    orientation: getExpectedOrientation(coords2.r, coords2.c),
  };
  newGrid[coords3.r][coords3.c] = {
    ...tileData2,
    id: tileData2.id,
    row: coords3.r,
    col: coords3.c,
    orientation: getExpectedOrientation(coords3.r, coords3.c),
  };
  
  return newGrid;
};


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols } = getGridDimensions(grid); // These are conceptual max rows/cols
  const tile = grid[r]?.[c];

  if (!tile) return [];
  
  // Potential neighbors based on orientation
  let deltas: {dr: number, dc: number}[];

  if (tile.orientation === 'up') {
    // An 'up' triangle (apex up) shares its base with a 'down' triangle below it (same column).
    // And shares its left and right sides with 'down' triangles.
    deltas = [
      { dr: 1, dc: 0 },  // Tile directly below (shares base)
      { dr: 0, dc: -1 }, // Tile to the left (shares right side of neighbor, left side of current)
      { dr: 0, dc: 1 },  // Tile to the right (shares left side of neighbor, right side of current)
    ];
  } else { // 'down'
    // A 'down' triangle (apex down) shares its 'base' (top edge) with an 'up' triangle above it (same column).
    // And shares its left and right sides with 'up' triangles.
    deltas = [
      { dr: -1, dc: 0 }, // Tile directly above (shares base)
      { dr: 0, dc: -1 }, // Tile to the left
      { dr: 0, dc: 1 },  // Tile to the right
    ];
  }
  
  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    // Check bounds carefully based on how grid is structured (sparse vs dense)
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const neighborTile = grid[nr]?.[nc];
      // A neighbor must exist and have the opposite orientation to share a side
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
  
  const visitedForMatchFinding = new Set<string>(); // Stores "r,c"

  for (let r_find = 0; r_find < rows; r_find++) {
    for (let c_find = 0; c_find < cols; c_find++) {
      const currentTile = newGrid[r_find]?.[c_find];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r_find},${c_find}`)) {
        const component: {r: number, c: number}[] = []; // Tiles in the current connected component
        const q: {r: number, c: number}[] = [{r:r_find, c:c_find}]; // Queue for BFS
        
        visitedForMatchFinding.add(`${r_find},${c_find}`);
        
        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          component.push({r: currR, c: currC});
          const tileForBFS = newGrid[currR][currC]!; // Should exist if it's in queue

          const neighbors = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighbors) {
            const neighborTile = newGrid[neighborPos.r][neighborPos.c];
            // Check if neighbor exists, has same color, and not yet visited for this match finding pass
            if (neighborTile && neighborTile.color === tileForBFS.color && !visitedForMatchFinding.has(`${neighborPos.r},${neighborPos.c}`)) {
              visitedForMatchFinding.add(`${neighborPos.r},${neighborPos.c}`);
              q.push(neighborPos);
            }
          }
        }

        // After exploring the component, check if it's a match
        if (component.length >= GAME_SETTINGS.MIN_MATCH_LENGTH) {
          hasMatches = true;
          component.forEach(pos => {
            if (newGrid[pos.r][pos.c] && !newGrid[pos.r][pos.c]!.isMatched) { // Ensure not already counted
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
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false } : null)); // Removed isSelected
  const { rows: numRows, cols: numCols } = getGridDimensions(newGrid);

  // Iterate column by column for gravity.
  // For triangular grids, "falling" is more complex than simple column fall.
  // A tile falls into a space if that space is empty AND the space below it can support it OR
  // it's a down-pointing triangle that can hang from an up-pointing one.
  // This implementation simplifies by assuming tiles "fall" downwards within their effective columns,
  // maintaining their (r,c) and re-evaluating orientation.
  // A more realistic gravity would require careful neighbor checking.

  // This simplified gravity pulls tiles down within their visual columns.
  // This means an 'up' tile at (r, c) might fall to (r+k, c) if that spot is empty
  // and an 'up' tile can exist there.
  // Similarly for 'down' tiles.

  for (let C = 0; C < numCols; C++) {
    let emptySlotR = -1; // Track the highest empty slot in the current column C

    // Iterate from bottom to top to find the first empty slot
    for (let R = numRows - 1; R >= 0; R--) {
        if (newGrid[R][C] === null) {
            emptySlotR = R;
            break;
        }
    }

    if (emptySlotR !== -1) {
        // Iterate from this empty slot upwards to find tiles to pull down
        for (let R = emptySlotR - 1; R >= 0; R--) {
            if (newGrid[R][C] !== null) {
                const tileToFall = newGrid[R][C]!;
                
                // Check if the target orientation at (emptySlotR, C) matches tileToFall.orientation
                // Or, more simply, just move it and update orientation.
                // The core idea is that an empty spot at (emptySlotR, C) should be fillable.
                
                newGrid[emptySlotR][C] = {
                    ...tileToFall,
                    row: emptySlotR,
                    // col: C, // col remains the same
                    orientation: getExpectedOrientation(emptySlotR, C),
                    isNew: false, // It's a moved tile, not new
                };
                newGrid[R][C] = null; // Vacate the original spot

                // Find the next empty slot above the one just filled
                let nextEmptyR = -1;
                for(let rCheck = emptySlotR - 1; rCheck >=R; rCheck--) { // Check up to original R
                    if (newGrid[rCheck][C] == null) {
                        nextEmptyR = rCheck;
                        break;
                    }
                }
                if (nextEmptyR !== -1) {
                    emptySlotR = nextEmptyR;
                } else {
                    // If no empty slots above current (emptySlotR-1), it means this column part is full
                    // or original R was the highest tile. No more tiles to pull down in this pass for this emptySlotR.
                    // We need to re-scan for next empty slot from emptySlotR-1.
                    let foundHigherEmpty = false;
                    for (let rSearch = emptySlotR - 1; rSearch >= 0; rSearch--) {
                        if (newGrid[rSearch][C] === null) {
                            emptySlotR = rSearch;
                            foundHigherEmpty = true;
                            break;
                        }
                    }
                    if (!foundHigherEmpty) break; // No more empty slots above in this column
                }

            }
        }
    }
  }
  
  // Spawn new tiles in any remaining empty spots
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

  if (findAndMarkMatches(grid).hasMatches) return false; // Should ideally not happen if called after processing

  // Check all possible horizontal row slides
  // Note: Slide direction might need to be 'forward'/'backward' relative to row type
  // For now, assuming 'left' and 'right' cycle tiles in that row.
  for (let r_slide = 0; r_slide < numRows; r_slide++) {
    // Check if row has enough distinct elements to slide meaningfully
    const rowTiles = grid[r_slide].filter(t => t !== null);
    if (rowTiles.length > 1) {
        const gridAfterLeftSlide = slideRow(grid, r_slide, 'left');
        if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;
    
        // Sliding right is only different if more than 1 tile.
        // slideRow handles single tile rows correctly by doing nothing.
        const gridAfterRightSlide = slideRow(grid, r_slide, 'right');
        if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
    }
  }

  // Check all possible tile swaps with direct neighbors
  for (let r_swap = 0; r_swap < numRows; r_swap++) {
    for (let c_swap = 0; c_swap < numCols; c_swap++) {
      if (grid[r_swap][c_swap]) { 
        const neighbors = getNeighbors(r_swap, c_swap, grid);
        for (const neighbor of neighbors) {
          const gridAfterSwap = swapTiles(grid, r_swap, c_swap, neighbor.r, neighbor.c);
          if (findAndMarkMatches(gridAfterSwap).hasMatches) return false;
        }
      }
    }
  }
  
  // Check all possible triad rotations
  // A triad involves three mutually adjacent tiles.
  // Example: T1=(r,c), T2 is neighbor of T1, T3 is neighbor of T1 and T2.
  const checkedTriads = new Set<string>(); // To avoid re-checking same triad
  for (let r1 = 0; r1 < numRows; r1++) {
    for (let c1 = 0; c1 < numCols; c1++) {
      if (!grid[r1][c1]) continue;
      const t1Coords = {r: r1, c: c1};
      const t1Neighbors = getNeighbors(r1, c1, grid);

      for (const t2Coords of t1Neighbors) { // t2 is a neighbor of t1
        if (!grid[t2Coords.r][t2Coords.c]) continue;
        const t2Neighbors = getNeighbors(t2Coords.r, t2Coords.c, grid);

        for (const t3Coords of t2Neighbors) { // t3 is a neighbor of t2
          if (!grid[t3Coords.r][t3Coords.c]) continue;

          // Check if t3 is also a neighbor of t1 to form a triad
          const t3IsNeighborOfT1 = t1Neighbors.some(n => n.r === t3Coords.r && n.c === t3Coords.c);
          
          // Ensure all three tiles are distinct
          const isT1T2Same = t1Coords.r === t2Coords.r && t1Coords.c === t2Coords.c;
          const isT1T3Same = t1Coords.r === t3Coords.r && t1Coords.c === t3Coords.c;
          const isT2T3Same = t2Coords.r === t3Coords.r && t2Coords.c === t3Coords.c;
          if (isT1T2Same || isT1T3Same || isT2T3Same) continue;

          if (t3IsNeighborOfT1) { // Forms a triad
            // Create a canonical key for the triad to avoid duplicates
            const coordsSet = [t1Coords, t2Coords, t3Coords].sort((a,b) => a.r === b.r ? a.c - b.c : a.r - b.r);
            const triadKey = coordsSet.map(crd => `${crd.r},${crd.c}`).join('|');
            
            if (checkedTriads.has(triadKey)) continue;
            checkedTriads.add(triadKey);

            // Simulate rotation (e.g., t1_data -> t2_pos, t2_data -> t3_pos, t3_data -> t1_pos)
            const gridAfterRotation = rotateTriad(grid, t1Coords, t2Coords, t3Coords);
            if (findAndMarkMatches(gridAfterRotation).hasMatches) return false;

            // Simulate rotation in the other direction
            // (t1_data -> t3_pos, t3_data -> t2_pos, t2_data -> t1_pos)
            const gridAfterReverseRotation = rotateTriad(grid, t1Coords, t3Coords, t2Coords);
            if (findAndMarkMatches(gridAfterReverseRotation).hasMatches) return false;
          }
        }
      }
    }
  }

  return true; // No possible moves found
};
