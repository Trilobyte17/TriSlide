
"use client";

import type { Tile as TileType } from '@/lib/tripuzzle/types';
import { getTileColorStyle, GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
  // orientation prop is removed as it's now part of TileType
}

const SVG_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
const SVG_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

// Points for an upward-pointing equilateral triangle: (width/2, 0), (0, height), (width, height)
const upPoints = `${SVG_WIDTH / 2},0 0,${SVG_HEIGHT} ${SVG_WIDTH},${SVG_HEIGHT}`;
// Points for a downward-pointing equilateral triangle: (0,0), (width,0), (width/2, height)
const downPoints = `0,0 ${SVG_WIDTH},0 ${SVG_WIDTH / 2},${SVG_HEIGHT}`;

export function Tile({ tile }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color);
  const points = tile.orientation === 'up' ? upPoints : downPoints;
  const uniqueGlossyId = `glossy-${tile.id}`;
  const uniqueShadowId = `dropShadow-${tile.id}`;

  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={cn(
        "select-none transition-all duration-300 ease-out",
        tile.isNew && "animate-tile-spawn",
        tile.isMatched && "animate-tile-vanish",
        // "absolute" // Position is handled by the parent div in GridDisplay
      )}
      style={{
        // filter: `url(#${uniqueShadowId})`, // Apply drop shadow via SVG filter
        // Using a simpler CSS drop-shadow for now to avoid filter issues on complex grids
        // If you prefer SVG filter, uncomment above and ensure <defs> are correctly handled (e.g. global or per SVG)
        // For performance on many tiles, CSS might be better. The image has soft shadows.
        filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3)) drop-shadow(-1px -1px 1px rgba(255,255,255,0.1))'
      }}
      aria-label={`Tile with color ${tile.color} pointing ${tile.orientation}`}
    >
      <defs>
        <linearGradient id={uniqueGlossyId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.4)' }} />
          <stop offset="50%" style={{ stopColor: 'rgba(255,255,255,0.1)' }} />
          <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.0)' }} />
        </linearGradient>
        {/* SVG filter for drop shadow - can be complex for many elements
        <filter id={uniqueShadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="0.5" floodColor="rgba(0,0,0,0.5)"/>
        </filter>
        */}
      </defs>
      <polygon 
        points={points} 
        style={{ 
          fill: tileStyle.backgroundColor,
          stroke: 'rgba(0,0,0,0.2)', // Subtle stroke for definition
          strokeWidth: 0.5 
        }} 
      />
      <polygon 
        points={points} 
        style={{ fill: `url(#${uniqueGlossyId})` }} 
      />
    </svg>
  );
}
