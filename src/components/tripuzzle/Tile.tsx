"use client";

import type { Tile as TileType, TileColor } from '@/lib/tripuzzle/types';
import { getTileColorStyle, GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
}

const SVG_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
const SVG_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;
// Points for an upward-pointing equilateral triangle: (width/2, 0), (0, height), (width, height)
const points = `${SVG_WIDTH / 2},0 0,${SVG_HEIGHT} ${SVG_WIDTH},${SVG_HEIGHT}`;

export function Tile({ tile }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color as TileColor);

  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={cn(
        "select-none shadow-md transition-all duration-300 ease-out",
        tile.isNew && "animate-tile-spawn",
        tile.isMatched && "animate-tile-vanish",
      )}
      aria-label={`Tile with color ${tile.color}`}
    >
      <polygon points={points} style={{ fill: tileStyle.backgroundColor }} />
    </svg>
  );
}
