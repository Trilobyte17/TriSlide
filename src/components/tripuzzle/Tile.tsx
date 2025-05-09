
"use client";

import type { Tile as TileType } from '@/lib/tripuzzle/types';
import { getTileColorStyle }
from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, tile: TileType) => void;
  isPotentialTarget: boolean;
}

export function Tile({ tile, onDragStart, isPotentialTarget }: TileProps) {
  const tileStyle = getTileColorStyle(tile.value);

  return (
    <div
      id={`tile-${tile.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, tile)}
      className={cn(
        "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center select-none cursor-grab shadow-md transition-all duration-300 ease-out",
        "text-2xl md:text-3xl font-bold",
        tile.isNew && "animate-tile-spawn", // Animation for new tiles
        tile.isMerging && "animate-tile-merge", // Animation for tile being merged into
        tile.isVanishing && "animate-tile-vanish", // Animation for tile that is merging and disappearing
        isPotentialTarget && "ring-4 ring-offset-2 ring-[hsl(var(--tile-potential-merge-glow))]"
      )}
      style={tileStyle}
      aria-label={`Tile with value ${tile.value}`}
    >
      {tile.value}
    </div>
  );
}

    