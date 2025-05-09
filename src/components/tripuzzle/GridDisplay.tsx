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

  // Adjusted container height calculation
  const containerWidth = numGridCols * (TILE_BASE_WIDTH / 2) + (TILE_BASE_WIDTH / 2);
  const containerHeight = numGridRows * TILE_HEIGHT; 
  
  const slideButtonSize = TILE_HEIGHT * 0.8; 

  return (
    <div className="flex items-center justify-center space-x-1 my-4">
      <div className="flex flex-col justify-around" style={{ height: `${containerHeight}px`, minWidth: `${slideButtonSize + 4}px`}}>
        {gridData.map((_, r) => (
          <Button
            key={`left-slide-${r}`}
            variant="ghost"
            size="icon"
            className="p-0"
            style={{ height: `${TILE_HEIGHT}px`, width: `${slideButtonSize}px` }}
            onClick={() => onRowSlide(r, 'left')}
            disabled={isProcessingMove}
            aria-label={`Slide row ${r + 1} left`}
          >
            <ArrowLeftCircle size={slideButtonSize} />
          </Button>
        ))}
      </div>

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
            const tileY = r_idx * TILE_HEIGHT; 
            const tileX = c_idx * (TILE_BASE_WIDTH / 2);
            const isSelected = selectedTileCoords?.r === r_idx && selectedTileCoords?.c === c_idx;
            
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
                  pointerEvents: 'none', // Ensure clicks pass through this div to the SVG
                }}
                role="gridcell"
                aria-label={`Tile at data row ${r_idx}, data col ${c_idx} with color ${tileData.color}`}
              >
                <Tile
                  tile={tileData}
                  onClick={() => onTileClick(r_idx,c_idx)}
                  isSelected={isSelected}
                />
              </div>
            );
          });
        })}
      </div>

       <div className="flex flex-col justify-around" style={{ height: `${containerHeight}px`, minWidth: `${slideButtonSize + 4}px` }}>
        {gridData.map((_, r) => ( 
          <Button
            key={`right-slide-${r}`}
            variant="ghost"
            size="icon"
            className="p-0"
            style={{ height: `${TILE_HEIGHT}px`, width: `${slideButtonSize}px`}}
            onClick={() => onRowSlide(r, 'right')}
            disabled={isProcessingMove}
            aria-label={`Slide row ${r + 1} right`}
          >
            <ArrowRightCircle size={slideButtonSize} />
          </Button>
        ))}
      </div>
    </div>
  );
}
