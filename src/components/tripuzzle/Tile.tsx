
"use client";

import type { Tile as TileType } from '@/lib/tripuzzle/types';
import { getTileColorStyle, GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
  // onClick?: () => void; // Removed
  // isSelected?: boolean; // Removed
}

const SVG_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
const SVG_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

const upPoints = `${SVG_WIDTH / 2},0 0,${SVG_HEIGHT} ${SVG_WIDTH},${SVG_HEIGHT}`;
const downPoints = `0,0 ${SVG_WIDTH},0 ${SVG_WIDTH / 2},${SVG_HEIGHT}`;

export function Tile({ tile }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color);
  const points = tile.orientation === 'up' ? upPoints : downPoints;
  const uniqueGlossyId = `glossy-${tile.id}`;

  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      // onClick={onClick} // Removed
      className={cn(
        "select-none transition-all duration-300 ease-out", // Removed cursor-pointer
        "focus:outline-none", 
        tile.isNew && "animate-tile-spawn",
        tile.isMatched && "animate-tile-vanish"
        // Removed hover:opacity-80 hover:scale-105 as interaction changes
      )}
      style={
        {
          // pointerEvents: onClick ? 'auto' : 'none', // Simplified: tiles are not directly clickable now
           pointerEvents: 'none', // Tiles themselves don't handle clicks for selection
        }
      }
      aria-label={`Tile with color ${tile.color} pointing ${tile.orientation}`}
      // role={onClick ? "button" : undefined} // Removed role
      // tabIndex={onClick ? 0 : -1} // Removed tabIndex
      // onKeyDown={(e) => { // Removed onKeyDown
      //   if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      //     onClick();
      //   }
      // }}
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
          stroke: `hsl(${GAME_SETTINGS.TILE_BORDER_COLOR_HSL})`, 
          strokeWidth: GAME_SETTINGS.TILE_BORDER_WIDTH,
        }}
      />
      <polygon
        points={points}
        style={{ fill: `url(#${uniqueGlossyId})` }}
      />
      {/* Removed selection highlight polygon */}
    </svg>
  );
}

