"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, Tile as TileType, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine'; 

interface GridDisplayProps {
  gridData: GridData;
  isProcessingMove: boolean;
  onSlideCommit: (
    lineType: 'row' | DiagonalType, 
    identifier: number | { r: number, c: number }, 
    direction: SlideDirection | ('left' | 'right')
  ) => void;
}

type DragAxis = 'row' | DiagonalType | null;

interface ActiveDragState {
  startScreenX: number;
  startScreenY: number;
  currentScreenX: number;
  currentScreenY: number;
  startTileR: number;
  startTileC: number;
  dragAxisLocked: DragAxis;
  draggedLineCoords: { r: number; c: number }[] | null;
  visualOffset: number; 
}

export function GridDisplay({
  gridData,
  isProcessingMove,
  onSlideCommit,
}: GridDisplayProps) {
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;
  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES;
  const numGridCols = GAME_SETTINGS.GRID_WIDTH_TILES;

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  const isProcessingMoveRef = useRef(isProcessingMove);
  useEffect(() => { isProcessingMoveRef.current = isProcessingMove; }, [isProcessingMove]);
  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);


  const containerWidth = numGridCols * (TILE_BASE_WIDTH * 0.75) + (TILE_BASE_WIDTH * 0.25);
  const containerHeight = numGridRows * TILE_HEIGHT + TILE_HEIGHT * 0.5; 

  const getTilePosition = (r: number, c: number, orientation: 'up' | 'down') => {
    let finalX = c * (TILE_BASE_WIDTH * 0.75);
    let finalY = r * TILE_HEIGHT;
    if (c % 2 !== 0) { 
        finalY += TILE_HEIGHT / 2;
    }
    return { x: finalX, y: finalY };
  };
  
  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMoveRef.current || activeDrag) return;
    
    if (event.type === 'mousedown') event.preventDefault();

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    setActiveDrag({
      startScreenX: clientX,
      startScreenY: clientY,
      currentScreenX: clientX,
      currentScreenY: clientY,
      startTileR: r,
      startTileC: c,
      dragAxisLocked: null,
      draggedLineCoords: null,
      visualOffset: 0,
    });
  }, [activeDrag]); // Removed TILE_HEIGHT, TILE_BASE_WIDTH from deps as they are from GAME_SETTINGS

  useEffect(() => {
    const handleDragMove = (event: MouseEvent | TouchEvent) => {
      setActiveDrag(prevDrag => {
        if (!prevDrag) return null;

        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
        const deltaX = clientX - prevDrag.startScreenX;
        const deltaY = clientY - prevDrag.startScreenY;
        
        let currentDragAxis = prevDrag.dragAxisLocked;
        let currentLineCoords = prevDrag.draggedLineCoords;
        let currentVisualOffset = 0;

        if (!currentDragAxis) { 
          const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dragDistance > GAME_SETTINGS.DRAG_THRESHOLD) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI; 
            
            if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) {
              currentDragAxis = 'row';
              const rowPath: {r:number, c:number}[] = [];
              for(let colIdx = 0; colIdx < numGridCols; colIdx++) {
                if(gridDataRef.current[prevDrag.startTileR]?.[colIdx]) {
                  rowPath.push({r: prevDrag.startTileR, c: colIdx});
                }
              }
              currentLineCoords = rowPath;
            } else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) { 
              currentDragAxis = 'diff'; 
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'diff');
            } else if ((angle >= 90 && angle <= 150) || (angle <= -30 && angle >= -90)) { 
              currentDragAxis = 'sum'; 
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'sum');
            }
          }
        }

        if (currentDragAxis && currentLineCoords) {
          if (currentDragAxis === 'row') {
            currentVisualOffset = deltaX;
          } else if (currentDragAxis === 'diff') { 
            currentVisualOffset = deltaX * 0.5 + deltaY * (Math.sqrt(3)/2);
          } else if (currentDragAxis === 'sum') { 
            currentVisualOffset = deltaX * (-0.5) + deltaY * (Math.sqrt(3)/2);
          }
        }
        
        return { 
          ...prevDrag, 
          currentScreenX: clientX, 
          currentScreenY: clientY,
          dragAxisLocked: currentDragAxis,
          draggedLineCoords: currentLineCoords,
          visualOffset: currentVisualOffset,
        };
      });
    };

    const handleDragEnd = () => {
      const currentActiveDragState = activeDrag; // Capture state before resetting
      
      setActiveDrag(null); // Reset GridDisplay's internal drag state first

      if (!currentActiveDragState || !currentActiveDragState.dragAxisLocked || !currentActiveDragState.draggedLineCoords || currentActiveDragState.draggedLineCoords.length < 2) {
        return; // No valid drag to commit
      }

      const { dragAxisLocked, startTileR, startTileC, visualOffset } = currentActiveDragState;
      const slideThreshold = TILE_BASE_WIDTH * 0.4; 
      
      if (Math.abs(visualOffset) > slideThreshold) {
        const direction = visualOffset > 0 ? 
          (dragAxisLocked === 'row' ? 'right' : 'forward') : 
          (dragAxisLocked === 'row' ? 'left' : 'backward');

        if (dragAxisLocked === 'row') {
          onSlideCommitRef.current('row', startTileR, direction as 'left' | 'right');
        } else if (dragAxisLocked === 'sum' || dragAxisLocked === 'diff') {
          onSlideCommitRef.current(dragAxisLocked, { r: startTileR, c: startTileC }, direction as SlideDirection);
        }
      }
    };

    if (activeDrag) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false }); 
      document.addEventListener('touchend', handleDragEnd);
      document.addEventListener('touchcancel', handleDragEnd); // Added for robustness
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd); // Cleanup
    };
  }, [activeDrag, TILE_BASE_WIDTH, numGridCols]); // numGridCols and TILE_BASE_WIDTH are stable. onSlideCommitRef is a ref.

  return (
    <div
      className="relative p-1 bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none touch-none" 
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        overflow: 'hidden', 
      }}
      ref={gridRef}
    >
      {gridData.map((row, rIndex) => 
        row.map((tileData, cIndex) => {
          if (!tileData) return null;
          
          const { x, y } = getTilePosition(rIndex, cIndex, tileData.orientation);
          let transform = 'translate(0px, 0px)';

          if (activeDrag && activeDrag.draggedLineCoords) {
            const isTileInDraggedLine = activeDrag.draggedLineCoords.some(coord => coord.r === rIndex && coord.c === cIndex);
            if (isTileInDraggedLine) {
              if (activeDrag.dragAxisLocked === 'row') {
                transform = `translateX(${activeDrag.visualOffset}px)`;
              } else if (activeDrag.dragAxisLocked === 'diff') { 
                const normX = 0.5; const normY = Math.sqrt(3)/2;
                transform = `translate(${activeDrag.visualOffset * normX}px, ${activeDrag.visualOffset * normY}px)`;
              } else if (activeDrag.dragAxisLocked === 'sum') { 
                const normX = -0.5; const normY = Math.sqrt(3)/2;
                transform = `translate(${activeDrag.visualOffset * normX}px, ${activeDrag.visualOffset * normY}px)`;
              }
            }
          }

          return (
            <div
              key={tileData.id}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${TILE_BASE_WIDTH}px`,
                height: `${TILE_HEIGHT}px`,
                transform: transform,
                transition: activeDrag ? 'none' : `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out`,
                zIndex: (activeDrag && activeDrag.draggedLineCoords?.some(c => c.r === rIndex && c.c === cIndex)) ? 10 : 1,
                cursor: activeDrag ? 'grabbing' : (isProcessingMove ? 'default' : 'grab'),
              }}
              onMouseDown={(e) => handleDragStart(e, rIndex, cIndex)}
              onTouchStart={(e) => handleDragStart(e, rIndex, cIndex)}
              role="gridcell"
              aria-label={`Tile at row ${rIndex + 1}, col ${cIndex + 1} color ${tileData.color}`}
            >
              <Tile tile={tileData} />
            </div>
          );
        })
      )}
    </div>
  );
}
