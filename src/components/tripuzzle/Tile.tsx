
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
  let currentBorderStroke = `hsl(${GAME_SETTINGS.TILE_BORDER_COLOR_HSL})`;
  let currentBorderStrokeWidth = GAME_SETTINGS.TILE_BORDER_WIDTH;
  let tileClassName = "";
  let tileInlineStyle: React.CSSProperties = { pointerEvents: 'none' };
  let filterStyle: string | undefined = undefined;


  if (tile.isMatched) {
    tileClassName = "animate-tile-vanish";
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
        opacity: tile.isMatched ? undefined : 1
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
      {!tile.isMatched && (
        <polygon
          points={points}
          style={{ fill: `url(#${uniqueGlossyId})` }}
        />
      )}
      {/* Display a number on the tile */}
      <text
        x={SVG_WIDTH / 2}
        y={tile.orientation === 'up' ? SVG_HEIGHT * 0.65 : SVG_HEIGHT * 0.45}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={tileStyle.color}
        fontSize={SVG_WIDTH / 2.5}
        fontWeight="bold"
        className="select-none"
        style={{pointerEvents: 'none'}}
      >
        {GAME_SETTINGS.COLORS.indexOf(tile.color)}
      </text>
    </svg>
  );
}
