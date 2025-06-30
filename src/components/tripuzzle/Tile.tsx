
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
  // Default border, can be overridden for matched state
  let currentBorderStroke = `hsl(${GAME_SETTINGS.TILE_BORDER_COLOR_HSL})`;
  let currentBorderStrokeWidth = GAME_SETTINGS.TILE_BORDER_WIDTH;
  let tileClassName = "";
  let tileInlineStyle: React.CSSProperties = { pointerEvents: 'none' }; // Keep pointer events off individual SVGs
  let filterStyle: string | undefined = undefined;


  if (tile.isMatched) {
    // Debug highlight for matched tiles (thick black border, original color)
    currentBorderStroke = `hsl(0 0% 0%)`; // Thick black border
    currentBorderStrokeWidth = 3;
    // The tile-matched-highlighting class (defined in page.tsx) prevents
    // the vanish animation from running, allowing us to see the matched tiles for debugging.
    tileClassName = "tile-matched-highlighting";
  } else if (tile.isNew) {
    tileClassName = "animate-tile-spawn";
  }


  return (
    <svg
      id={`tile-${tile.id}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={cn(
        "select-none transition-all duration-300 ease-out", 
        "focus:outline-none",
        tileClassName
      )}
      style={{
        ...tileInlineStyle,
        filter: filterStyle,
      }}
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
