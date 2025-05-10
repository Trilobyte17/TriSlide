
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, Tile as TileType, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine'; // Renamed to avoid conflict

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
  visualOffset: number; // Translation amount along the drag axis
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

  // Refs for props to use in global event handlers
  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  const isProcessingMoveRef = useRef(isProcessingMove);
  useEffect(() => { isProcessingMoveRef.current = isProcessingMove; }, [isProcessingMove]);
  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);


  const containerWidth = numGridCols * (TILE_BASE_WIDTH * 0.75) + (TILE_BASE_WIDTH * 0.25);
  const containerHeight = numGridRows * TILE_HEIGHT + TILE_HEIGHT * 0.5; // Adjusted for full visibility

  const getTilePosition = (r: number, c: number, orientation: 'up' | 'down') => {
    const x = c * (TILE_BASE_WIDTH * 0.75);
    const y = r * TILE_HEIGHT + (orientation === 'down' ? TILE_HEIGHT * 0.5 : 0) - (c % 2 !== 0 ? TILE_HEIGHT * 0.5 : 0) ;
    
    // Adjustment for the current staggered grid where (0,0) is up, (0,1) is down AND shifted.
    // A simpler model:
    // x-offset for each column: c * TILE_BASE_WIDTH * 0.75
    // y-offset for each row: r * TILE_HEIGHT
    // Additional y-offset for odd columns to nest: if (c % 2 !== 0) y += TILE_HEIGHT / 2;
    // This positioning ensures tiles fit together.
    let finalX = c * (TILE_BASE_WIDTH * 0.75);
    let finalY = r * TILE_HEIGHT;
    if (c % 2 !== 0) { // Odd columns are shifted down by half a tile height
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
  }, [activeDrag]);


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

        if (!currentDragAxis) { // Axis not yet locked
          const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dragDistance > GAME_SETTINGS.DRAG_THRESHOLD) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI; // Degrees
            
            if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) {
              currentDragAxis = 'row';
              const rowPath: {r:number, c:number}[] = [];
              for(let colIdx = 0; colIdx < numGridCols; colIdx++) {
                if(gridDataRef.current[prevDrag.startTileR]?.[colIdx]) {
                  rowPath.push({r: prevDrag.startTileR, c: colIdx});
                }
              }
              currentLineCoords = rowPath;
            } else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) { // Approx for '\' diagonal (r-c=k)
              currentDragAxis = 'diff'; // (r-c = k)
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'diff');
            } else if ((angle >= 90 && angle <= 150) || (angle <= -30 && angle >= -90)) { // Approx for '/' diagonal (r+c=k)
              currentDragAxis = 'sum'; // (r+c = k)
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'sum');
            }
          }
        }

        if (currentDragAxis && currentLineCoords) {
          if (currentDragAxis === 'row') {
            currentVisualOffset = deltaX;
          } else if (currentDragAxis === 'diff') { // '\' diagonal, movement roughly along (1,1) vector in screen space
            // Project delta onto the diagonal's primary direction vector
            // Vector for '\' is roughly (cos(60), sin(60)) = (0.5, sqrt(3)/2)
            currentVisualOffset = deltaX * 0.5 + deltaY * (Math.sqrt(3)/2);
          } else if (currentDragAxis === 'sum') { // '/' diagonal, movement roughly along (-1,1) vector
             // Vector for '/' is roughly (cos(120), sin(120)) = (-0.5, sqrt(3)/2)
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
      setActiveDrag(prevDrag => {
        if (!prevDrag || !prevDrag.dragAxisLocked || !prevDrag.draggedLineCoords || prevDrag.draggedLineCoords.length < 2) {
          return null; // No valid drag to commit
        }

        const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = prevDrag;
        const slideThreshold = TILE_BASE_WIDTH * 0.4; 
        
        let slideCommitted = false;
        if (Math.abs(visualOffset) > slideThreshold) {
          const direction = visualOffset > 0 ? 
            (dragAxisLocked === 'row' ? 'right' : 'forward') : 
            (dragAxisLocked === 'row' ? 'left' : 'backward');

          if (dragAxisLocked === 'row') {
            onSlideCommitRef.current('row', startTileR, direction as 'left' | 'right');
            slideCommitted = true;
          } else if (dragAxisLocked === 'sum' || dragAxisLocked === 'diff') {
            onSlideCommitRef.current(dragAxisLocked, { r: startTileR, c: startTileC }, direction as SlideDirection);
            slideCommitted = true;
          }
        }
        // Reset visual offset on tiles if not committed, or let re-render handle it
        return null; // Reset drag state
      });
    };

    if (activeDrag) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false }); // Need to preventDefault for scroll sometimes
      document.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [activeDrag]);

  return (
    <div
      className="relative p-1 bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none touch-none" // Added touch-none
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        overflow: 'hidden', // Important to clip tiles during visual slide
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
              } else if (activeDrag.dragAxisLocked === 'diff') { // '\' diagonal
                 // Approximate screen vector: (1, sqrt(3)) normalized
                const normX = 0.5; const normY = Math.sqrt(3)/2;
                transform = `translate(${activeDrag.visualOffset * normX}px, ${activeDrag.visualOffset * normY}px)`;
              } else if (activeDrag.dragAxisLocked === 'sum') { // '/' diagonal
                // Approximate screen vector: (-1, sqrt(3)) normalized
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
