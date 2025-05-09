"use client";

import React from 'react';
import type { GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { cn } from '@/lib/utils';

interface GridDisplayProps {
  gridData: GridData;
  // onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void; // Temporarily removed
}

export function GridDisplay({ gridData }: GridDisplayProps) {
  const numRows = gridData.length;
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

  // Calculate container dimensions needed for the large triangle of tessellated tiles
  const containerWidth = numRows * TILE_BASE_WIDTH;
  // Height: (numRows - 1) half-steps + 1 full tile height for the last part
  const containerHeight = (numRows > 0 ? (numRows - 1) * (TILE_HEIGHT / 2) + TILE_HEIGHT : 0);

  return (
    <div 
      className="relative p-2 bg-secondary/30 rounded-lg shadow-inner" 
      role="grid" 
      aria-label="TriPuzzle game grid"
      style={{ 
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
      }}
    >
      {gridData.map((row, r) => {
        // Determine if triangles in this row point up or down
        // For a tessellated grid where rows interlock, orientations often alternate
        const isUp = (r % 2 === 0);
        const orientation = isUp ? 'up' : 'down';

        return row.map((tileData, c) => {
          if (!tileData) {
            // Optionally render placeholders for empty slots if needed for debugging
            // For now, just skip empty slots
            return null;
          }

          // Calculate position for tessellation
          // y: Each row steps down by half a tile height to allow interlocking
          const tileY = r * (TILE_HEIGHT / 2);
          // x: Base indent for the large triangle shape, then position within row.
          //    Downward rows are shifted by half a tile width to interlock.
          const rowIndentX = (numRows - 1 - r) * (TILE_BASE_WIDTH / 2);
          const tileXInRow = c * TILE_BASE_WIDTH;
          const orientationShiftX = isUp ? 0 : TILE_BASE_WIDTH / 2;
          const tileX = rowIndentX + tileXInRow + orientationShiftX;
          
          return (
            <div
              key={tileData.id}
              style={{
                position: 'absolute',
                left: `${tileX}px`,
                top: `${tileY}px`,
                width: `${TILE_BASE_WIDTH}px`, // For click area and layout debugging
                height: `${TILE_HEIGHT}px`,
              }}
              role="gridcell"
              aria-label={`Tile at logical row ${r+1} column ${c+1}`}
            >
              <Tile
                tile={tileData}
                orientation={orientation}
              />
            </div>
          );
        });
      })}
    </div>
  );
}
