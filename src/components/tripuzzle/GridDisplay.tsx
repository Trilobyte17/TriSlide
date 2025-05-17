
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine';

// Helper to get number of visual tiles in a specific row for Trism grid
const getNumVisualTilesInRow = (r: number): number => {
    return (r % 2 === 0) ? GAME_SETTINGS.VISUAL_TILES_PER_ROW : GAME_SETTINGS.VISUAL_TILES_PER_ROW - 1;
};

interface GridDisplayProps {
  gridData: GridData;
  isProcessingMove: boolean;
  onSlideCommit: (
    lineType: 'row' | DiagonalType,
    identifier: number | { r: number, c: number },
    direction: SlideDirection | ('left' | 'right'),
    numSteps: number
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
  const TILE_BORDER_WIDTH = GAME_SETTINGS.TILE_BORDER_WIDTH;

  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES; // 11
  const maxVisualTilesInAnyRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // 6 (for widest rows)

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const activeDragRef = useRef<ActiveDragState | null>(null);
  useEffect(() => { activeDragRef.current = activeDrag; }, [activeDrag]);

  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);
  
  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);


  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate overall width for the Trism grid (6/5 pattern)
  // Widest part is 6 tiles. (6 tiles * 0.5 W) + 0.5 W for the last half = 3.5 * W
  const mathGridWidth = (maxVisualTilesInAnyRow + 1) * TILE_BASE_WIDTH / 2;
  const mathGridHeight = numGridRows * TILE_HEIGHT;

  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;
  const positionOffset = TILE_BORDER_WIDTH / 2;

  const getTilePosition = (r: number, c: number) => {
    let x = c * (TILE_BASE_WIDTH / 2);
    if (r % 2 !== 0) { // Odd rows are shifted right by half a tile width
      x += TILE_BASE_WIDTH / 2;
    }
    const y = r * TILE_HEIGHT;
    return {
      x: x + positionOffset,
      y: y + positionOffset
    };
  };

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMove || activeDragRef.current) return;
    
    const numTilesInStartRow = getNumVisualTilesInRow(r);
    if (c < 0 || c >= numTilesInStartRow || !gridDataRef.current[r]?.[c]) return;


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
  }, [isProcessingMove, maxVisualTilesInAnyRow]);


  const handleDragMove = useCallback(async (event: MouseEvent | TouchEvent) => {
    const currentDragState = activeDragRef.current;
    if (!currentDragState) return;

    if (event.type === 'touchmove' && event.cancelable) {
      event.preventDefault();
    }

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const deltaX = clientX - currentDragState.startScreenX;
    const deltaY = clientY - currentDragState.startScreenY;

    let newDragAxisLocked = currentDragState.dragAxisLocked;
    let newDraggedLineCoords = currentDragState.draggedLineCoords;
    let newVisualOffset = currentDragState.visualOffset;

    if (!newDragAxisLocked) {
      const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (dragDistance > GAME_SETTINGS.DRAG_THRESHOLD) {
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        let determinedAxis: DragAxis | null = null;

        if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) { 
          determinedAxis = 'row';
        } else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) { 
          determinedAxis = 'diff'; // '\'
        } else { 
          determinedAxis = 'sum'; // '/'
        }
        newDragAxisLocked = determinedAxis;

        if (determinedAxis === 'row') {
            newDraggedLineCoords = [];
            const numTilesInDraggedRow = getNumVisualTilesInRow(currentDragState.startTileR);
            for(let colIdx = 0; colIdx < numTilesInDraggedRow; colIdx++) {
                 newDraggedLineCoords.push({r: currentDragState.startTileR, c: colIdx});
            }
        } else if (determinedAxis) { 
            newDraggedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
      if (newDragAxisLocked === 'row') {
        newVisualOffset = deltaX;
      } else { // Diagonals: project delta onto the line's axis
        // Angle of sum diagonal is approx 120 deg (2PI/3), diff is approx 60 deg (PI/3) from positive X-axis
        const lineAngleRad = newDragAxisLocked === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3); 
        newVisualOffset = deltaX * Math.cos(lineAngleRad) + deltaY * Math.sin(lineAngleRad);
      }
    }

    setActiveDrag({
      ...currentDragState,
      currentScreenX: clientX,
      currentScreenY: clientY,
      dragAxisLocked: newDragAxisLocked,
      draggedLineCoords: newDraggedLineCoords,
      visualOffset: newVisualOffset,
    });
  }, [maxVisualTilesInAnyRow]); 


  const handleDragEnd = useCallback(() => {
    const currentDragState = activeDragRef.current; // Capture current state
    setActiveDrag(null); // Reset drag state for UI first

    if (currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = currentDragState;

      let effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.60; 
      if (dragAxisLocked === 'diff' || dragAxisLocked === 'sum') {
         effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.35; 
      }
      
      const numStepsRaw = Math.round(visualOffset / effectiveTileShiftUnit);

      if (numStepsRaw !== 0) {
        const lineTypeToCommit = dragAxisLocked;
        // For rows, identifier is rowIndex. For diagonals, it's the start {r,c} of the drag.
        const identifierToCommit = dragAxisLocked === 'row' ? startTileR : { r: startTileR, c: startTileC };
        
        let directionForEngine: SlideDirection | ('left' | 'right');
        if (dragAxisLocked === 'row') {
            directionForEngine = numStepsRaw > 0 ? 'right' : 'left';
        } else { // 'sum' or 'diff'
            directionForEngine = numStepsRaw > 0 ? 'forward' : 'backward';
        }
        
        const numActualSteps = Math.abs(numStepsRaw);

        // Defer commit to avoid React state update errors during render, if any
        setTimeout(() => {
            onSlideCommitRef.current(lineTypeToCommit, identifierToCommit, directionForEngine, numActualSteps);
        }, 0);
      }
    }
  }, [TILE_BASE_WIDTH]); 

  useEffect(() => {
    if (activeDrag) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
      document.addEventListener('touchcancel', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [activeDrag, handleDragMove, handleDragEnd]);


  const getLineDisplacementVector = (
    lineCoords: { r: number; c: number }[], // Should be non-null here
    axis: DragAxis // Should be non-null here
  ): { dx: number, dy: number } => {
      if (lineCoords.length === 0) return { dx: 0, dy: 0 };

      if (axis === 'row') {
          // Visual width of a row of tiles. Each tile effectively contributes TILE_BASE_WIDTH / 2 to the row's span.
          // If lineCoords has L items, the visual span is L * (TILE_BASE_WIDTH/2) if they were all full width.
          // However, for wrapping, we need the length of the data line (numVisualTilesInRow).
          const numTilesInRow = getNumVisualTilesInRow(lineCoords[0].r);
          return { dx: numTilesInRow * (TILE_BASE_WIDTH / 2) + (TILE_BASE_WIDTH /2) , dy: 0 }; // Total width of visual line
      } else { // Diagonals: 'sum' or 'diff'
          // For diagonals, the "length" for wrapping is more complex.
          // Approximate by the number of tiles in the line times an effective width.
          // This is a visual approximation for the carousel effect.
          const unitShiftDistance = TILE_BASE_WIDTH * 0.7; // Effective visual width along diagonal
          const angleRad = axis === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3);
          return {
              dx: lineCoords.length * unitShiftDistance * Math.cos(angleRad),
              dy: lineCoords.length * unitShiftDistance * Math.sin(angleRad)
          };
      }
  };


  return (
    <div
      className="relative bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none touch-none"
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`,
        height: `${styledContainerHeight}px`,
        overflow: 'hidden', 
      }}
      ref={gridRef}
    >
      {gridData.map((row, rIndex) => {
        const numVisualTilesInThisRow = getNumVisualTilesInRow(rIndex);
        return row.slice(0, numVisualTilesInThisRow).map((tileData, cIndex) => { // Only render visual tiles
           if (!tileData) return null;

          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);

          if (activeDrag && isPartOfActiveDrag && activeDrag.draggedLineCoords && activeDrag.dragAxisLocked) {
            const lineCoords = activeDrag.draggedLineCoords;
            const lineDisplacement = getLineDisplacementVector(lineCoords, activeDrag.dragAxisLocked);
            // Threshold for showing wrapped tiles, e.g., 25% of a tile's width
            const wrapThreshold = TILE_BASE_WIDTH * 0.25; 

            let primaryDeltaX = 0, primaryDeltaY = 0;
            if (activeDrag.dragAxisLocked === 'row') {
              primaryDeltaX = activeDrag.visualOffset;
            } else {
              const angleRad = activeDrag.dragAxisLocked === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3);
              primaryDeltaX = activeDrag.visualOffset * Math.cos(angleRad);
              primaryDeltaY = activeDrag.visualOffset * Math.sin(angleRad);
            }

            const transformsToRender = [
              { dx: primaryDeltaX, dy: primaryDeltaY, keySuffix: '-main', opacity: 1 }
            ];

            if (lineDisplacement.dx !== 0 || lineDisplacement.dy !== 0) { // Only add wrapped if line has some length
                // Wrapped from the "past" (tile moving in from left/top-diag)
                if (activeDrag.visualOffset > wrapThreshold) {
                  transformsToRender.push({
                    dx: primaryDeltaX - lineDisplacement.dx,
                    dy: primaryDeltaY - lineDisplacement.dy,
                    keySuffix: '-wrap-past',
                    opacity: 1
                  });
                }
                // Wrapped from the "future" (tile moving in from right/bottom-diag)
                if (activeDrag.visualOffset < -wrapThreshold) {
                  transformsToRender.push({
                    dx: primaryDeltaX + lineDisplacement.dx,
                    dy: primaryDeltaY + lineDisplacement.dy,
                    keySuffix: '-wrap-future',
                    opacity: 1
                  });
                }
            }
            
            return (
              <React.Fragment key={`${tileData.id}-draggroup`}>
                {transformsToRender.map(transform => (
                  <div
                    key={tileData.id + transform.keySuffix}
                    style={{
                      position: 'absolute',
                      left: `${baseX}px`,
                      top: `${baseY}px`,
                      width: `${TILE_BASE_WIDTH}px`,
                      height: `${TILE_HEIGHT}px`,
                      transform: `translate(${transform.dx}px, ${transform.dy}px)`,
                      transition: 'none', // Drag uses direct transform
                      zIndex: 10, // Dragged tiles on top
                      cursor: 'grabbing',
                      opacity: transform.opacity,
                    }}
                  >
                    <Tile tile={tileData} />
                  </div>
                ))}
              </React.Fragment>
            );
          } else { // Tile is not part of active drag line, or no drag is active
            return (
              <div
                key={tileData.id}
                style={{
                  position: 'absolute',
                  left: `${baseX}px`,
                  top: `${baseY}px`,
                  width: `${TILE_BASE_WIDTH}px`,
                  height: `${TILE_HEIGHT}px`,
                  transform: 'translate(0px,0px)', // Base position
                  transition: (activeDrag === null && !isProcessingMove) ? `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out, opacity ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out` : 'none',
                  zIndex: isProcessingMove && !activeDrag ? 5 : 1,
                  cursor: (activeDrag || isProcessingMove) ? 'default' : 'grab',
                  // Dim original tiles in the dragged line if we are showing a copy
                  opacity: (activeDrag && activeDrag.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex)) ? 0.3 : 1, 
                }}
                onMouseDown={(e) => handleDragStart(e, rIndex, cIndex)}
                onTouchStart={(e) => handleDragStart(e, rIndex, cIndex)}
                role="gridcell"
                aria-label={`Tile at row ${rIndex + 1}, col ${cIndex + 1} with color ${tileData.color}`}
              >
                <Tile tile={tileData} />
              </div>
            );
          }
        })
      })}
    </div>
  );
}
