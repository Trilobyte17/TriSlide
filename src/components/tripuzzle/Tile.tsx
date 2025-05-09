
"use client";

import type { Tile as TileType } from '@/lib/tripuzzle/types';
import { getTileColorStyle, GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
  onClick?: () => void;
  isSelected?: boolean;
}

// Use precise dimensions from GAME_SETTINGS
const SVG_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
const SVG_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

const upPoints = `${SVG_WIDTH / 2},0 0,${SVG_HEIGHT} ${SVG_WIDTH},${SVG_HEIGHT}`;
const downPoints = `0,0 ${SVG_WIDTH},0 ${SVG_WIDTH / 2},${SVG_HEIGHT}`;

export function Tile({ tile, onClick, isSelected }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color);
  const points = tile.orientation === 'up' ? upPoints : downPoints;
  const uniqueGlossyId = `glossy-${tile.id}`;

  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      onClick={onClick}
      className={cn(
        "select-none transition-all duration-300 ease-out cursor-pointer",
        tile.isNew && "animate-tile-spawn",
        tile.isMatched && "animate-tile-vanish",
        // Removed scale-105 from isSelected, relying on stroke for selection visual
        "hover:opacity-80 hover:scale-105" 
      )}
      style={
        {
          // Drop shadow can be added here if desired
        }
      }
      aria-label={`Tile with color ${tile.color} pointing ${tile.orientation}${isSelected ? ', selected' : ''}`}
      role="button" 
      tabIndex={onClick ? 0 : -1} 
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          onClick();
        }
      }}
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
          stroke: isSelected ? 'hsl(var(--accent))' : '#000000', 
          strokeWidth: isSelected ? 2 : 0.5 // Thicker stroke for selected tiles
        }} 
      />
      <polygon 
        points={points} 
        style={{ fill: `url(#${uniqueGlossyId})` }} 
      />
    </svg>
  );
}

