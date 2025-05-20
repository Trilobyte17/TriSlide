
"use client";

import type { Tile as TileType } from '@/lib/tripuzzle/types';
import { getTileColorStyle, GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { cn } from '@/lib/utils';

interface TileProps {
  tile: TileType;
}

const SVG_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
const SVG_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

const upPoints = `${SVG_WIDTH / 2},0 0,${SVG_HEIGHT} ${SVG_WIDTH},${SVG_HEIGHT}`;
const downPoints = `0,0 ${SVG_WIDTH},0 ${SVG_WIDTH / 2},${SVG_HEIGHT}`;

export function Tile({ tile }: TileProps) {
  const tileStyle = getTileColorStyle(tile.color);
  const points = tile.orientation === 'up' ? upPoints : downPoints;
  const uniqueGlossyId = `glossy-${tile.id}`;

  let tileFillColor = tileStyle.backgroundColor;
  let currentBorderStroke = `hsl(${GAME_SETTINGS.TILE_BORDER_COLOR_HSL})`; // Default black border
  let currentBorderStrokeWidth = GAME_SETTINGS.TILE_BORDER_WIDTH; // Default 1px
  let tileClassName = "";
  let tileInlineStyle: React.CSSProperties = { pointerEvents: 'none' }; // Keep pointer events off for the SVG itself

  if (tile.isMatched) {
    // When matched, apply vanishing animation
    tileClassName = "animate-tile-vanish";
  } else if (tile.isNew) {
    // When new, apply spawn animation
    tileClassName = "animate-tile-spawn";
  }
  
  // Debug highlight for matches (no longer active in normal gameplay)
  // This section was for debugging and should be removed or conditional for production.
  // For now, we assume normal gameplay styling.
  // if (tile.isMatched) {
  //   tileFillColor = tileStyle.backgroundColor; // Keep original color
  //   currentBorderStroke = `hsl(0 0% 0%)`; // Thick black border for debug
  //   currentBorderStrokeWidth = 3;
  //   // tileInlineStyle.filter = `brightness(1.2) drop-shadow(0 0 3px hsl(0 0% 0%))`; // Example filter
  //   // No glossy effect for matched debug tiles
  // }


  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={cn(
        "select-none transition-all duration-300 ease-out", // Basic transition, can be overridden by specific animations
        "focus:outline-none",
        tileClassName // Apply spawn or vanish animations
      )}
      style={tileInlineStyle}
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
          fill: tileFillColor,
          stroke: currentBorderStroke,
          strokeWidth: currentBorderStrokeWidth,
        }}
      />
      {/* Only apply glossy effect if not matched (i.e., not vanishing) */}
      {!tile.isMatched && (
        <polygon
          points={points}
          style={{ fill: `url(#${uniqueGlossyId})` }}
        />
      )}
    </svg>
  );
}
