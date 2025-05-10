
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { GridData, Tile as TileType } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';

interface GridDisplayProps {
  gridData: GridData;
  isProcessingMove: boolean;
  onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void;
}

export function GridDisplay({
  gridData,
  isProcessingMove,
  onRowSlide,
}: GridDisplayProps) {
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES;
  const numGridCols = GAME_SETTINGS.GRID_WIDTH_TILES;

  const [dragState, setDragState] = useState<{
    rowIndex: number | null;
    startX: number;
    currentX: number;
    isDragging: boolean;
  }>({ rowIndex: null, startX: 0, currentX: 0, isDragging: false });

  const gridRef = useRef<HTMLDivElement>(null);

  // Refs for props to use in global event handlers
  const onRowSlideRef = useRef(onRowSlide);
  useEffect(() => {
    onRowSlideRef.current = onRowSlide;
  }, [onRowSlide]);

  const isProcessingMoveRef = useRef(isProcessingMove);
  useEffect(() => {
    isProcessingMoveRef.current = isProcessingMove;
  }, [isProcessingMove]);

  const getTilesForRow = (grid: GridData, rowIndex: number): TileType[] => {
    return grid[rowIndex]?.filter(tile => tile !== null) as TileType[] || [];
  };

  let maxWidthForRow = 0;
  for (let r = 0; r < numGridRows; r++) {
    let currentWidth = 0;
    for (let c = 0; c < numGridCols; c++) {
      const tileExistsInConceptualGrid = (r % 2 === 0) ? (c % 2 === 0) : (c % 2 !== 0);
      if (tileExistsInConceptualGrid || gridData[r]?.[c]) {
        currentWidth = Math.max(currentWidth, c * (TILE_BASE_WIDTH / 2) + TILE_BASE_WIDTH);
      }
    }
    maxWidthForRow = Math.max(maxWidthForRow, currentWidth);
  }
  const containerWidth = maxWidthForRow;
  const containerHeight = numGridRows * TILE_HEIGHT;

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, rowIndex: number) => {
    if (isProcessingMoveRef.current || dragState.isDragging) return;
    
    // Prevent default for mouse events to avoid text selection, etc.
    // For touch events, this might be handled by passive:false if preventDefault is needed in move.
    if (event.type === 'mousedown') {
      event.preventDefault();
    }

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    setDragState({
      rowIndex,
      startX: clientX,
      currentX: clientX,
      isDragging: true,
    });
  };

  useEffect(() => {
    const handleDragMove = (event: MouseEvent | TouchEvent) => {
      setDragState(prev => {
        if (!prev.isDragging) return prev;
        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        return { ...prev, currentX: clientX };
      });
    };

    const handleDragEnd = () => {
      setDragState(prevDragState => {
        if (!prevDragState.isDragging || prevDragState.rowIndex === null) return prevDragState;

        const deltaX = prevDragState.currentX - prevDragState.startX;
        const dragThreshold = TILE_BASE_WIDTH * 0.4; // 40% of a tile's width

        if (Math.abs(deltaX) > dragThreshold) {
          const direction = deltaX > 0 ? 'right' : 'left';
          onRowSlideRef.current(prevDragState.rowIndex, direction);
        }
        // Reset drag state, CSS transition will handle snap-back if no slide
        return { rowIndex: null, startX: 0, currentX: 0, isDragging: false };
      });
    };

    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: true }); // passive true if not calling preventDefault
      document.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [dragState.isDragging]); // Effect depends only on isDragging state

  return (
    <div
      className="relative p-1 bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none"
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        overflow: 'hidden',
      }}
      ref={gridRef}
    >
      {Array.from({ length: numGridRows }).map((_, rIndex) => {
        const rowTiles = getTilesForRow(gridData, rIndex);
        const rowYOffset = rIndex * TILE_HEIGHT;
        const currentTransform = dragState.isDragging && dragState.rowIndex === rIndex
          ? `translateX(${dragState.currentX - dragState.startX}px)`
          : 'translateX(0px)';

        return (
          <div
            key={`row-wrapper-${rIndex}`}
            className="row-drag-container"
            style={{
              position: 'absolute',
              top: `${rowYOffset}px`,
              left: `0px`,
              width: `${containerWidth}px`, 
              height: `${TILE_HEIGHT}px`,
              transform: currentTransform,
              transition: dragState.isDragging ? 'none' : `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out`,
              cursor: dragState.isDragging ? 'grabbing' : (isProcessingMove ? 'default' : 'grab'),
              zIndex: dragState.isDragging && dragState.rowIndex === rIndex ? 10 : 1,
            }}
            onMouseDown={(e) => handleDragStart(e, rIndex)}
            onTouchStart={(e) => handleDragStart(e, rIndex)}
            role="row"
            aria-label={`Row ${rIndex + 1}`}
          >
            {rowTiles.map((tileData) => {
              if (!tileData) return null;
              const tileX = tileData.col * (TILE_BASE_WIDTH / 2);
              const tileY = 0; // Relative to row container

              return (
                <div
                  key={tileData.id}
                  style={{
                    position: 'absolute',
                    left: `${tileX}px`,
                    top: `${tileY}px`,
                    width: `${TILE_BASE_WIDTH}px`,
                    height: `${TILE_HEIGHT}px`,
                    pointerEvents: 'none',
                  }}
                  role="gridcell"
                  aria-label={`Tile at visual row ${rIndex + 1}, conceptual column ${tileData.col} with color ${tileData.color}`}
                >
                  <Tile tile={tileData} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
