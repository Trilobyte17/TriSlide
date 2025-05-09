
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


export const getNeighbors = (r: number, c: number, grid: GridData): {r: number, c: number}[] => {
  const neighbors: {r: number, c: number}[] = [];
  const { rows, cols } = getGridDimensions(grid);
  const tile = grid[r]?.[c];

  if (!tile) return [];
  
  // Potential relative coordinates for neighbors of any triangle.
  // A triangle shares edges with three other triangles.
  // (dr, dc) pairs for neighbors
  const deltas = [
    { dr: 0, dc: -1 }, // Left
    { dr: 0, dc: 1 },  // Right
  ];

  // Vertical/diagonal neighbor depends on current tile's orientation
  if (tile.orientation === 'up') {
    deltas.push({ dr: 1, dc: 0 }); // Cell directly below
  } else { // 'down'
    deltas.push({ dr: -1, dc: 0 }); // Cell directly above
  }
  
  for (const delta of deltas) {
    const nr = r + delta.dr;
    const nc = c + delta.dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const neighborTile = grid[nr]?.[nc];
      // A valid neighbor must exist and have the opposite orientation to share an edge.
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

  for (let c = 0; c < cols; c++) {
    let writeHead = rows - 1; 
    for (let readHead = rows - 1; readHead >= 0; readHead--) {
      if (newGrid[readHead][c] !== null) {
        const tileToMove = newGrid[readHead][c]!;
        if (readHead !== writeHead) {
          newGrid[writeHead][c] = {
            ...tileToMove,
            row: writeHead,
            orientation: getExpectedOrientation(writeHead, c), 
          };
          newGrid[readHead][c] = null;
        }
        if (newGrid[writeHead][c]) {
            newGrid[writeHead][c]!.orientation = getExpectedOrientation(writeHead, c);
        }
        writeHead--;
      }
    }
  }
  
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
  const { rows, cols } = getGridDimensions(grid);

  // 1. Check for current matches
  if (findAndMarkMatches(grid).hasMatches) return false;

  // 2. Check all possible horizontal row slides
  for (let r = 0; r < rows; r++) {
    const gridAfterLeftSlide = slideRow(grid, r, 'left');
    if (findAndMarkMatches(gridAfterLeftSlide).hasMatches) return false;

    const gridAfterRightSlide = slideRow(grid, r, 'right');
    if (findAndMarkMatches(gridAfterRightSlide).hasMatches) return false;
  }

  // 3. Check all possible tile swaps
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) { // If there's a tile at (r,c)
        const neighbors = getNeighbors(r, c, grid);
        for (const neighbor of neighbors) {
          const gridAfterSwap = swapTiles(grid, r, c, neighbor.r, neighbor.c);
          if (findAndMarkMatches(gridAfterSwap).hasMatches) return false;
        }
      }
    }
  }
  
  // If no moves lead to matches, game is over.
  // (This simplified check assumes a full board or that gravity won't create new opportunities if no direct moves exist.
  // A more complex check might simulate gravity after hypothetical moves if the board isn't full.)
  return true; 
};
