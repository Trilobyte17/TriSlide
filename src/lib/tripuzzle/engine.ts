
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
    grid.push(new Array(cols).fill(null));
  }
  return grid;
};

const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  return ((r % 2 === 0 && c % 2 === 0) || (r % 2 !== 0 && c % 2 !== 0)) ? 'up' : 'down';
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

export const slideRow = (grid: GridData, rowIndex: number, direction: 'left' | 'right'): GridData => {
  const newGrid = grid.map(r => r.map(t => t ? {...t, isNew: false, isMatched: false, isSelected: false} : null));
  const { rows, cols } = getGridDimensions(newGrid);

  if (rowIndex < 0 || rowIndex >= rows) return newGrid;

  const rowToSlide = newGrid[rowIndex];
  if (cols <= 1) return newGrid;

  if (direction === 'left') {
    const firstTile = rowToSlide.shift();
    if (firstTile) rowToSlide.push(firstTile);
  } else { // right
    const lastTile = rowToSlide.pop();
    if (lastTile) rowToSlide.unshift(lastTile);
  }

  rowToSlide.forEach((tile, newColIndex) => {
    if (tile) {
      tile.col = newColIndex;
      tile.orientation = getExpectedOrientation(tile.row, tile.col);
    }
  });

  return newGrid;
};

export const swapTiles = (grid: GridData, r1: number, c1: number, r2: number, c2: number): GridData => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isSelected: false, isNew: false, isMatched: false } : null));
  const tile1Data = newGrid[r1]?.[c1];
  const tile2Data = newGrid[r2]?.[c2];

  if (tile1Data && tile2Data) {
    // Place tile2Data at (r1, c1)
    newGrid[r1][c1] = {
      ...tile2Data,
      row: r1,
      col: c1,
      orientation: getExpectedOrientation(r1, c1),
    };
    // Place tile1Data at (r2, c2)
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
  coords1: { r: number; c: number }, // Selected tile
  coords2: { r: number; c: number }, // Middle tile
  coords3: { r: number; c: number }  // Target diagonal tile
  // Rotation direction: data from 1->2, 2->3, 3->1
): GridData => {
  const newGrid = grid.map(row => row.map(tile => tile ? { ...tile, isSelected: false, isNew: false, isMatched: false } : null));

  const tileData1 = { ...newGrid[coords1.r][coords1.c]! }; // Data of original tile at coords1
  const tileData2 = { ...newGrid[coords2.r][coords2.c]! }; // Data of original tile at coords2
  const tileData3 = { ...newGrid[coords3.r][coords3.c]! }; // Data of original tile at coords3

  // Perform rotation:
  // Position 1 gets data from Tile 3
  newGrid[coords1.r][coords1.c] = {
    ...tileData3,
    id: tileData3.id, // Keep original ID with the data
    row: coords1.r,
    col: coords1.c,
    orientation: getExpectedOrientation(coords1.r, coords1.c),
  };
  // Position 2 gets data from Tile 1
  newGrid[coords2.r][coords2.c] = {
    ...tileData1,
    id: tileData1.id,
    row: coords2.r,
    col: coords2.c,
    orientation: getExpectedOrientation(coords2.r, coords2.c),
  };
  // Position 3 gets data from Tile 2
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
  const { rows, cols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];
  
  const deltas = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  if (tile.orientation === 'up') {
    deltas.push({ dr: 1, dc: 0 }); 
  } else { 
    deltas.push({ dr: -1, dc: 0 }); 
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

          const neighbors = getNeighbors(currR, currC, newGrid);
          for (const neighborPos of neighbors) {
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
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false, isSelected: false} : null));
  const { rows, cols } = getGridDimensions(newGrid);

  for (let c_grav = 0; c_grav < cols; c_grav++) {
    let writeHead = rows - 1; 
    for (let readHead = rows - 1; readHead >= 0; readHead--) {
      if (newGrid[readHead][c_grav] !== null) {
        const tileToMove = newGrid[readHead][c_grav]!;
        if (readHead !== writeHead) {
          newGrid[writeHead][c_grav] = {
            ...tileToMove,
            row: writeHead,
            orientation: getExpectedOrientation(writeHead, c_grav), 
          };
          newGrid[readHead][c_grav] = null;
        }
        if (newGrid[writeHead][c_grav]) {
            newGrid[writeHead][c_grav]!.orientation = getExpectedOrientation(writeHead, c_grav);
        }
        writeHead--;
      }
    }
  }
  
  for (let r_spawn = 0; r_spawn < rows; r_spawn++) {
    for (let c_spawn = 0; c_spawn < cols; c_spawn++) {
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
  const { rows, cols } = getGridDimensions(grid);

  // 1. Check for current matches (should not happen if called after processing)
  if (findAndMarkMatches(grid).hasMatches) return false;

  // 2. Check all possible horizontal row slides
  for (let r_slide = 0; r_slide < rows; r_slide++) {
    const gridAfterLeftSlide = slideRow(grid, r_slide, 'left');
    if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

    const gridAfterRightSlide = slideRow(grid, r_slide, 'right');
    if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
  }

  // 3. Check all possible tile swaps
  for (let r_swap = 0; r_swap < rows; r_swap++) {
    for (let c_swap = 0; c_swap < cols; c_swap++) {
      if (grid[r_swap][c_swap]) { 
        const neighbors = getNeighbors(r_swap, c_swap, grid);
        for (const neighbor of neighbors) {
          const gridAfterSwap = swapTiles(grid, r_swap, c_swap, neighbor.r, neighbor.c);
          if (findAndMarkMatches(gridAfterSwap).hasMatches) return false;
        }
      }
    }
  }
  
  // 4. Check all possible triad rotations
  const checkedTriads = new Set<string>();
  for (let r1 = 0; r1 < rows; r1++) {
    for (let c1 = 0; c1 < cols; c1++) {
      if (!grid[r1][c1]) continue;
      const t1Coords = {r: r1, c: c1};
      const t1Neighbors = getNeighbors(r1, c1, grid);

      for (const t2Coords of t1Neighbors) {
        if (!grid[t2Coords.r][t2Coords.c]) continue;
        const t2Neighbors = getNeighbors(t2Coords.r, t2Coords.c, grid);

        for (const t3Coords of t2Neighbors) {
          if (!grid[t3Coords.r][t3Coords.c]) continue;

          const t3IsNeighborOfT1 = t1Neighbors.some(n => n.r === t3Coords.r && n.c === t3Coords.c);
          
          const isT1T2Same = t1Coords.r === t2Coords.r && t1Coords.c === t2Coords.c;
          const isT1T3Same = t1Coords.r === t3Coords.r && t1Coords.c === t3Coords.c;
          const isT2T3Same = t2Coords.r === t3Coords.r && t2Coords.c === t3Coords.c;
          if (isT1T2Same || isT1T3Same || isT2T3Same) continue;

          if (t3IsNeighborOfT1) {
            // (t1Coords, t2Coords, t3Coords) form a triad.
            const coordsSet = [t1Coords, t2Coords, t3Coords].sort((a,b) => a.r === b.r ? a.c - b.c : a.r - b.r);
            const triadKey = coordsSet.map(crd => `${crd.r},${crd.c}`).join('|');
            
            if (checkedTriads.has(triadKey)) continue;
            checkedTriads.add(triadKey);

            // Simulate rotation in one direction (e.g., t1_data -> t2_pos, t2_data -> t3_pos, t3_data -> t1_pos)
            const gridAfterRotation = rotateTriad(grid, t1Coords, t2Coords, t3Coords);
            if (findAndMarkMatches(gridAfterRotation).hasMatches) return false;

            // Simulate rotation in the other direction (e.g., t1_data -> t3_pos, t3_data -> t2_pos, t2_data -> t1_pos)
            // This means swapping the roles of t2 and t3 in the rotateTriad call
            const gridAfterReverseRotation = rotateTriad(grid, t1Coords, t3Coords, t2Coords);
            if (findAndMarkMatches(gridAfterReverseRotation).hasMatches) return false;
          }
        }
      }
    }
  }

  return true; 
};

