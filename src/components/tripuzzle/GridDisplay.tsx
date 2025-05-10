
"use client";

import React from 'react';
import type { GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
// Removed Button, ArrowLeftCircle, ArrowRightCircle as row slide buttons are removed.
// Will re-evaluate if drag interactions need different UI elements later.

interface GridDisplayProps {
  gridData: GridData;
  // onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void; // Keeping for potential future use or if drag reuses similar logic
  isProcessingMove: boolean;
  // onTileClick: (r: number, c: number) => void; // Removed
  // selectedTileCoords: { r: number; c: number } | null; // Removed
}

export function GridDisplay({ 
  gridData, 
  // onRowSlide, // Commented out as direct row slide buttons are gone. Drag will be different.
  isProcessingMove,
  // onTileClick, // Removed
  // selectedTileCoords // Removed
}: GridDisplayProps) {
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;
  
  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES; 
  const numGridCols = GAME_SETTINGS.GRID_WIDTH_TILES; 

  let maxWidthForRow = 0;
  for (let r = 0; r < numGridRows; r++) {
    let currentWidth = 0;
    for (let c = 0; c < numGridCols; c++) {
      const tileExistsInConceptualGrid = (r % 2 === 0) ? (c % 2 === 0) : (c % 2 !== 0);
      if(tileExistsInConceptualGrid || gridData[r]?.[c]) { // Check if a tile potentially exists
         currentWidth = Math.max(currentWidth, c * (TILE_BASE_WIDTH / 2) + TILE_BASE_WIDTH);
      }
    }
    maxWidthForRow = Math.max(maxWidthForRow, currentWidth);
  }
  
  const containerWidth = maxWidthForRow;
  // Height calculation based on number of rows and effective height of each row.
  // Each row of triangles contributes TILE_HEIGHT.
  // The total height is simply numGridRows * TILE_HEIGHT.
  const containerHeight = numGridRows * TILE_HEIGHT; 
  
  // const slideButtonSize = TILE_HEIGHT * 0.8; // Not used anymore

  return (
    <div className="flex items-center justify-center my-4">
      <div 
        className="relative p-1 bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner" 
        role="grid" 
        aria-label="TriPuzzle game grid"
        style={{ 
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
        }}
      >
        {gridData.map((row) => { 
          return row.map((tileData) => { 
            if (!tileData) {
              return null;
            }
            const tileY = tileData.row * TILE_HEIGHT; 
            const tileX = tileData.col * (TILE_BASE_WIDTH / 2);
            
            // const isSelected = selectedTileCoords?.r === tileData.row && selectedTileCoords?.c === tileData.col; // Removed

            return (
              <div
                key={tileData.id}
                style={{
                  position: 'absolute',
                  left: `${tileX}px`,
                  top: `${tileY}px`,
                  width: `${TILE_BASE_WIDTH}px`, 
                  height: `${TILE_HEIGHT}px`,
                  transition: 'left 0.2s ease, top 0.2s ease', 
                  pointerEvents: 'none', 
                }}
                role="gridcell"
                aria-label={`Tile at data row ${tileData.row}, data col ${tileData.col} with color ${tileData.color}`}
              >
                <Tile
                  tile={tileData}
                  // onClick={() => onTileClick(tileData.row,tileData.col)} // Removed
                  // isSelected={isSelected} // Removed
                />
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
