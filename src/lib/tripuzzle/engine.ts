
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
  const newGrid = grid.map(r => r.map(t => t ? {...t, isNew: false, isMatched: false} : null));
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

  // Update column indices for the slided tiles
  rowToSlide.forEach((tile, newColIndex) => {
    if (tile) {
      tile.col = newColIndex;
      // Orientation is fixed by (row, col) position in this model, ensure it's up-to-date
      tile.orientation = getExpectedOrientation(tile.row, tile.col);
    }
  });

  return newGrid;
};

const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];

  const potentialNeighbors: {dr: number, dc: number, requiredOwnOrientation?: 'up' | 'down'}[] = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
    // Vertical neighbor depends on current tile's orientation
    ...(tile.orientation === 'up' ? [{ dr: 1, dc: 0, requiredOwnOrientation: 'up' as const }] : []), // Tile below (current is UP)
    ...(tile.orientation === 'down' ? [{ dr: -1, dc: 0, requiredOwnOrientation: 'down' as const }] : []), // Tile above (current is DOWN)
  ];

  for (const pn of potentialNeighbors) {
    const nr = r + pn.dr;
    const nc = c + pn.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const neighborTile = grid[nr][nc];
      if (neighborTile) {
        // Basic adjacency: must exist.
        // For horizontal, orientations must be opposite.
        // For vertical, orientations must be opposite.
        // This is ensured by getExpectedOrientation if grid is consistent.
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
  const { rows, cols } = getGridDimensions(newGrid);
  let hasMatches = false;
  let totalMatchedTiles = 0;
  
  const visitedForMatchFinding = new Set<string>(); // Stores "r,c"

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const currentTile = newGrid[r]?.[c];
      if (currentTile && !currentTile.isMatched && !visitedForMatchFinding.has(`${r},${c}`)) {
        const component: {r: number, c: number}[] = [];
        const q: {r: number, c: number}[] = [{r, c}];
        
        visitedForMatchFinding.add(`${r},${c}`);
        
        let head = 0;
        while(head < q.length) {
          const {r: currR, c: currC} = q[head++];
          component.push({r: currR, c: currC});
          const tileForBFS = newGrid[currR][currC]!; // Should exist

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
  let newGrid = grid.map(row => row.map(t => t ? {...t, isNew: false, isMatched: false} : null));
  const { rows, cols } = getGridDimensions(newGrid);

  // Apply gravity: Iterate columns. For each column, let tiles fall down.
  for (let c = 0; c < cols; c++) {
    let writeHead = rows - 1; // Points to the next slot to fill (bottom-up)
    for (let readHead = rows - 1; readHead >= 0; readHead--) {
      if (newGrid[readHead][c] !== null) {
        const tileToMove = newGrid[readHead][c]!;
        if (readHead !== writeHead) {
          newGrid[writeHead][c] = {
            ...tileToMove,
            row: writeHead,
            // Orientation is determined by the new (r,c) position to maintain tessellation
            orientation: getExpectedOrientation(writeHead, c), 
          };
          newGrid[readHead][c] = null;
        }
        // Ensure tile at writeHead has correct orientation if it wasn't moved (i.e. readHead === writeHead)
        // This handles the case where the tile was already in its correct bottom-most position.
        if (newGrid[writeHead][c]) {
            newGrid[writeHead][c]!.orientation = getExpectedOrientation(writeHead, c);
        }
        writeHead--;
      }
    }
  }
  
  // Spawn new tiles in empty cells (guaranteed to be at the top of columns after gravity)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (newGrid[r][c] === null) {
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
  }
  return newGrid;
};

export const checkGameOver = (grid: GridData): boolean => {
  const { rows } = getGridDimensions(grid);

  // Try all possible slides
  for (let r = 0; r < rows; r++) {
    // Try sliding left
    const gridAfterLeftSlide = slideRow(grid, r, 'left');
    const { hasMatches: leftMatches } = findAndMarkMatches(gridAfterLeftSlide);
    if (leftMatches) return false; // A move exists

    // Try sliding right
    const gridAfterRightSlide = slideRow(grid, r, 'right');
    const { hasMatches: rightMatches } = findAndMarkMatches(gridAfterRightSlide);
    if (rightMatches) return false; // A move exists
  }
  
  // If no slide results in a match, check if the board is full.
  // If not full, gravity might spawn new tiles, potentially creating matches.
  // A more robust check would see if new spawns could lead to matches.
  // For now, if no immediate slide causes a match, it's game over IF the board is also static (no empty spaces for new tiles to cause cascade)
  // This simplification: if no slide makes a match, it's game over.
  const { hasMatches: currentMatches } = findAndMarkMatches(grid); // Check current board too
  if (currentMatches) return false;


  // If grid is full and no current matches and no slide makes matches, game over.
  let isFull = true;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) {
        isFull = false;
        break;
      }
    }
    if (!isFull) break;
  }
  // If not full, new tiles will spawn, so not game over yet unless spawning is stuck.
  // This basic checkGameOver mainly relies on "no possible slide leads to a match".
  // If the board has empty spaces, applyGravityAndSpawn would fill them. The question is if THOSE can then be matched.
  // This simple checkGameOver is a starting point.
  return !isFull ? false : true; // If full and no moves make matches, then game over. If not full, spawns happen, so not over.
};
