
"use client";

import React from 'react';
import type { GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
// import { cn } from '@/lib/utils'; // Not used currently

interface GridDisplayProps {
  gridData: GridData;
  // onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void; // Temporarily removed
}

export function GridDisplay({ gridData }: GridDisplayProps) {
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;
  
  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES;
  const numGridCols = GAME_SETTINGS.GRID_WIDTH_TILES;

  // Calculate container dimensions
  // Width: (numGridCols / 2 + 0.5) * TILE_BASE_WIDTH effectively
  const containerWidth = numGridCols * (TILE_BASE_WIDTH / 2) + (TILE_BASE_WIDTH / 2);
  // Height: numGridRows * (3/4 * TILE_HEIGHT) + (1/4 * TILE_HEIGHT)
  const containerHeight = numGridRows * (TILE_HEIGHT * 0.75) + (TILE_HEIGHT * 0.25);

  return (
    <div 
      className="relative p-1 bg-black rounded-lg shadow-inner" // bg-black for gaps between tiles
      role="grid" 
      aria-label="TriPuzzle game grid"
      style={{ 
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        // overflow: 'hidden', // Optional: if tiles might slightly exceed bounds due to filters
      }}
    >
      {gridData.map((row, r) => {
        return row.map((tileData, c) => {
          if (!tileData) {
            return null;
          }

          // Calculate position for tessellation
          // Each row of triangles steps down by 3/4 of a tile's height
          const tileY = r * (TILE_HEIGHT * 0.75);
          // Each column of triangles steps right by 1/2 of a tile's width
          const tileX = c * (TILE_BASE_WIDTH / 2);
          
          return (
            <div
              key={tileData.id}
              style={{
                position: 'absolute',
                left: `${tileX}px`,
                top: `${tileY}px`,
                width: `${TILE_BASE_WIDTH}px`, 
                height: `${TILE_HEIGHT}px`,
                // transition for smooth movement if tiles ever move (e.g. gravity)
                // transition: 'left 0.3s ease, top 0.3s ease', 
              }}
              role="gridcell"
              aria-label={`Tile at data row ${r}, data col ${c}`}
            >
              <Tile
                tile={tileData}
                // orientation is now part of tileData
              />
            </div>
          );
        });
      })}
    </div>
  );
}
