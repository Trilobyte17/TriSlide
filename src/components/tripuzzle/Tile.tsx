
"use client";

import type { Tile as TileType } from '@/lib/tripuzzle/types';
import { getTileColorStyle, GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
}

const SVG_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
const SVG_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

// Points for an upward-pointing equilateral triangle:
// Tip: (width/2, 0)
// Bottom-left: (0, height)
// Bottom-right: (width, height)
const upPoints = `${SVG_WIDTH / 2},0 0,${SVG_HEIGHT} ${SVG_WIDTH},${SVG_HEIGHT}`;

// Points for a downward-pointing equilateral triangle:
// Top-left: (0, 0)
// Top-right: (width, 0)
// Tip: (width/2, height)
const downPoints = `0,0 ${SVG_WIDTH},0 ${SVG_WIDTH / 2},${SVG_HEIGHT}`;

export function Tile({ tile }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color);
  const points = tile.orientation === 'up' ? upPoints : downPoints;
  const uniqueGlossyId = `glossy-${tile.id}`;

  const borderStroke = tile.isMatched ? `hsl(var(--debug-match-border-color))` : `hsl(${GAME_SETTINGS.TILE_BORDER_COLOR_HSL})`;
  const borderStrokeWidth = tile.isMatched ? 3 : GAME_SETTINGS.TILE_BORDER_WIDTH;

  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={cn(
        "select-none transition-all duration-300 ease-out",
        "focus:outline-none", 
        tile.isNew && "animate-tile-spawn",
        // tile.isMatched && "animate-tile-vanish" // Keep matched tiles visible for debug
      )}
      style={
        {
           pointerEvents: 'none', 
        }
      }
      aria-label={`Tile with color ${tile.color} pointing ${tile.orientation}`}
    >
      <defs>
        <linearGradient id={uniqueGlossyId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.4)' }} />
          <stop offset="50%" style={{ stopColor: 'rgba(255,255,255,0.1)' }} />
          <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.0)' }} />
        </linearGradient>
      </defs>
      <polygon
        points={points}
        style={{
          fill: tileStyle.backgroundColor,
          stroke: borderStroke, 
          strokeWidth: borderStrokeWidth,
        }}
      />
      <polygon
        points={points}
        style={{ fill: `url(#${uniqueGlossyId})` }}
      />
    </svg>
  );
}
