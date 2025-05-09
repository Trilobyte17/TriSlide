
"use client";

import type { GridData, Tile as TileType } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { cn } from '@/lib/utils';

interface GridDisplayProps {
  gridData: GridData;
  onTileDragStart: (e: React.DragEvent<HTMLDivElement>, tile: TileType) => void;
  onTileDrop: (e: React.DragEvent<HTMLDivElement>, targetTile: TileType) => void;
  draggedTile: TileType | null;
}

export function GridDisplay({ gridData, onTileDragStart, onTileDrop, draggedTile }: GridDisplayProps) {
  const numRows = gridData.length;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  return (
    <div className="flex flex-col items-center space-y-1 p-4 bg-secondary/50 rounded-lg shadow-inner" role="grid" aria-label="TriPuzzle game grid">
      {gridData.map((row, r) => (
        <div 
          key={`row-${r}`} 
          className="flex justify-center space-x-1"
          style={{ paddingLeft: `${(numRows - 1 - r) * ( ( (16*4) + 4) / 2 / numRows )}px` }} // Approximate centering logic based on w-16 (4rem) tiles + 0.25rem margin. Needs refinement for responsiveness.
          role="row"
        >
          {row.map((tile, c) => (
            <div
              key={tile ? tile.id : `empty-${r}-${c}`}
              className={cn(
                "w-16 h-16 md:w-20 md:h-20 flex items-center justify-center m-0.5", // Cell container
                !tile && "bg-muted/50 rounded-full opacity-50" // Empty cell styling
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => tile && onTileDrop(e, tile)}
              role="gridcell"
              aria-label={tile ? `Tile at row ${r+1} column ${c+1}` : `Empty cell at row ${r+1} column ${c+1}`}
            >
              {tile && (
                <Tile
                  tile={tile}
                  onDragStart={onTileDragStart}
                  isPotentialTarget={!!(draggedTile && tile.id !== draggedTile.id && tile.value === draggedTile.value && tile.value !== 0)}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

    