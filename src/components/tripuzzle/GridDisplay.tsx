
"use client";

import React from 'react';
import type { GridData, Tile as TileType } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { Button } from '@/components/ui/button';
import { ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';

interface GridDisplayProps {
  gridData: GridData;
  onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void;
  isProcessingMove: boolean;
  onTileClick: (r: number, c: number) => void;
  selectedTileCoords: { r: number; c: number } | null;
}

export function GridDisplay({ 
  gridData, 
  onRowSlide, 
  isProcessingMove,
  onTileClick,
  selectedTileCoords 
}: GridDisplayProps) {
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;
  
  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES; 
  const numGridCols = GAME_SETTINGS.GRID_WIDTH_TILES; 

  // Calculate the maximum width needed for any row
  let maxWidthForRow = 0;
  for (let r = 0; r < numGridRows; r++) {
    let currentWidth = 0;
    for (let c = 0; c < numGridCols; c++) {
      if (gridData[r]?.[c]) { // Check if a tile exists at this conceptual coordinate
        // For 'up' tiles, the base starts at c * (TILE_BASE_WIDTH / 2) and extends to c * (TILE_BASE_WIDTH / 2) + TILE_BASE_WIDTH
        // For 'down' tiles, it's similar.
        // The rightmost point of any tile in column c is c * (TILE_BASE_WIDTH / 2) + TILE_BASE_WIDTH
        currentWidth = Math.max(currentWidth, c * (TILE_BASE_WIDTH / 2) + TILE_BASE_WIDTH);
      }
    }
    maxWidthForRow = Math.max(maxWidthForRow, currentWidth);
  }
  
  const containerWidth = maxWidthForRow;
  const containerHeight = numGridRows * TILE_HEIGHT; 
  
  const slideButtonSize = TILE_HEIGHT * 0.8; 

  return (
    <div className="flex items-center justify-center space-x-1 my-4">
      <div 
        className="relative p-1 bg-black/20 dark:bg-black/40 rounded-lg shadow-inner" 
        role="grid" 
        aria-label="TriPuzzle game grid"
        style={{ 
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
        }}
      >
        {gridData.map((row, r_idx) => { 
          return row.map((tileData, c_idx) => { 
            if (!tileData) {
              return null;
            }
            // Use tileData.row and tileData.col for positioning, as these are the source of truth
            const tileY = tileData.row * TILE_HEIGHT; 
            // Stagger 'down' pointing triangles by half a base width
            // tileData.col determines the horizontal position index.
            // If a tile is (r,0) up, its left point is at 0. If it is (r,1) down, its left point is at 0.5 * TILE_BASE_WIDTH
            // If it is (r,2) up, its left point is at 1.0 * TILE_BASE_WIDTH
            const tileX = tileData.col * (TILE_BASE_WIDTH / 2);
            
            const isSelected = selectedTileCoords?.r === tileData.row && selectedTileCoords?.c === tileData.col;
            
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
                  onClick={() => onTileClick(tileData.row,tileData.col)}
                  isSelected={isSelected}
                />
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
