
"use client";

import type { Tile as TileType, TileColor } from '@/lib/tripuzzle/types';
import { getTileColorStyle } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
  // onDragStart is removed as rows will be dragged, not individual tiles
  // isPotentialTarget is removed as merging logic changed
}

export function Tile({ tile }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color as TileColor);

  return (
    <div
      id={`tile-${tile.id}`}
      // draggable // Removed, rows will be draggable
      // onDragStart={(e) => onDragStart(e, tile)} // Removed
      className={cn(
        "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center select-none shadow-md transition-all duration-300 ease-out",
        // text-2xl md:text-3xl font-bold, // Text content (value) removed for color-based tiles
        tile.isNew && "animate-tile-spawn",
        tile.isMatched && "animate-tile-vanish", // Use vanish animation for matched tiles
        // tile.isMerging and tile.isVanishing might need new roles or removal
        // isPotentialTarget && "ring-4 ring-offset-2 ring-[hsl(var(--tile-potential-merge-glow))]" // Removed
      )}
      style={tileStyle}
      aria-label={`Tile with color ${tile.color}`}
    >
      {/* Display color name for debugging, or keep empty for pure visual */}
      {/* {tile.color.substring(0,1).toUpperCase()} */}
    </div>
  );
}
