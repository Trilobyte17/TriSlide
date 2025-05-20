
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { getExpectedOrientation } from '@/lib/tripuzzle/engine';
import { Tile } from './Tile';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine';
import Image from 'next/image';

interface GridDisplayProps {
  gridData: GridData;
  isProcessingMove: boolean;
  onSlideCommit: (
    lineType: 'row' | DiagonalType,
    identifier: number | { r: number; c: number },
    direction: SlideDirection | ('left' | 'right'),
    numSteps: number
  ) => void;
}

interface ActiveDragState {
  startScreenX: number;
  startScreenY: number;
  currentScreenX: number;
  currentScreenY: number;
  startTileR: number;
  startTileC: number;
  dragAxisLocked: DragAxis | null;
  draggedLineCoords: { r: number; c: number }[] | null; // These are cell coordinates, tiles might be null
  visualOffset: number;
}
type DragAxis = 'row' | DiagonalType | null;

export function GridDisplay({
  gridData,
  isProcessingMove,
  onSlideCommit,
}: GridDisplayProps) {
  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;
  const TILE_BORDER_WIDTH = GAME_SETTINGS.TILE_BORDER_WIDTH;

  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES;
  const visualTilesPerRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; 

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const activeDragRef = useRef<ActiveDragState | null>(null);
  useEffect(() => { activeDragRef.current = activeDrag; }, [activeDrag]);

  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);

  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  
  const gridRef = useRef<HTMLDivElement>(null);

  const mathGridWidth = (visualTilesPerRow + 1) * TILE_BASE_WIDTH / 2;
  const mathGridHeight = numGridRows * TILE_HEIGHT;

  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;
  const positionOffset = TILE_BORDER_WIDTH / 2;

  const getTilePosition = (r: number, c: number) => {
    const x = c * (TILE_BASE_WIDTH / 2);
    const y = r * TILE_HEIGHT;
    return {
      x: x + positionOffset,
      y: y + positionOffset,
      orientation: getExpectedOrientation(r, effectiveCol)
    };
  };

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMove || activeDragRef.current) return;
    // Allow drag start even if gridDataRef.current[r]?.[c] is null, as user might drag an empty part of a line
  
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
  }, [isProcessingMove]);


  const handleDragMove = useCallback(async (event: MouseEvent | TouchEvent) => {
    const currentDragState = activeDragRef.current;
    if (!currentDragState) return;

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

        if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) { // Horizontal
          determinedAxis = 'row';
        } else if (angle > 30 && angle < 90) { // Down-right
          determinedAxis = 'diff'; // '\'
        } else if (angle > 90 && angle < 150) { // Down-left
          determinedAxis = 'sum'; // '/'
        } else if (angle < -30 && angle > -90) { // Up-right
          determinedAxis = 'sum'; // '/'
        } else if (angle < -90 && angle > -150) { // Up-left
          determinedAxis = 'diff'; // '\'
        }
        newDragAxisLocked = determinedAxis;

        if (determinedAxis === 'row') {
            newDraggedLineCoords = [];
            for(let colIdx = 0; colIdx < visualTilesPerRow; colIdx++) {
                 newDraggedLineCoords.push({r: currentDragState.startTileR, c: colIdx});
            }
        } else if (determinedAxis && gridDataRef.current) {
            // getTilesOnDiagonalEngine already returns all cells (null or not)
            newDraggedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
      if (newDragAxisLocked === 'row') {
        newVisualOffset = deltaX;
      } else {
        const lineAngleRad = newDragAxisLocked === 'sum' ? (Math.PI * 2 / 3) : (Math.PI / 3);
        newVisualOffset = deltaX * Math.cos(lineAngleRad) + deltaY * Math.sin(lineAngleRad);
      }
    }
    
    setActiveDrag(prevState => prevState ? ({
      ...prevState,
      currentScreenX: clientX,
      currentScreenY: clientY,
      dragAxisLocked: newDragAxisLocked,
      draggedLineCoords: newDraggedLineCoords,
      visualOffset: newVisualOffset,
    }) : null);
  }, [visualTilesPerRow]);


  const handleDragEnd = useCallback(() => {
    const currentDragState = activeDragRef.current;
    setActiveDrag(null); // Update child state first

    if (currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = currentDragState;

      let effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.60; 
      if (dragAxisLocked === 'diff' || dragAxisLocked === 'sum') {
         effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.45; 
      }

      const numStepsRaw = Math.round(visualOffset / effectiveTileShiftUnit);
      const numActualSteps = Math.abs(numStepsRaw);
      
      if (numActualSteps > 0) {
        const lineTypeToCommit = dragAxisLocked;
        const identifierToCommit = dragAxisLocked === 'row' ? startTileR : { r: startTileR, c: startTileC };
        let directionForEngine: SlideDirection | ('left' | 'right');

        if (dragAxisLocked === 'row') {
            directionForEngine = numStepsRaw > 0 ? 'right' : 'left';
        } else { 
            directionForEngine = numStepsRaw > 0 ? 'forward' : 'backward';
        }
        
        // Defer parent state update
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
      document.addEventListener('touchmove', handleDragMove, { passive: true }); // Allow scroll on touch devices if drag not locked
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
    // Use visualTilesPerRow for rows, and actual lineCoords.length for diagonals
    // as diagonals can vary in length.
    numElementsInLine: number, // This should be the number of tile SLOTS in the line for wrapping purposes
    axis: DragAxis
  ): { dx: number, dy: number } => {
      if (numElementsInLine === 0 || !axis) return { dx: 0, dy: 0 };

      if (axis === 'row') {
          // A row of N tiles spans (N+1)/2 * TILE_BASE_WIDTH
          const displacementX = (numElementsInLine + 1) * (TILE_BASE_WIDTH / 2);
          return { dx: displacementX , dy: 0 };
      } else { // 'sum' or 'diff'
          const effectiveStepDistance = TILE_BASE_WIDTH * 0.85; // Increased from 0.7
          const angleRad = axis === 'sum' ? (Math.PI * 2 / 3) : (Math.PI / 3); 
          return {
              dx: numElementsInLine * effectiveStepDistance * Math.cos(angleRad),
              dy: numElementsInLine * effectiveStepDistance * Math.sin(angleRad)
          };
      }
  };

  return (
    <div
      className="relative rounded-lg shadow-inner select-none touch-none"
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`,
        height: `${styledContainerHeight}px`,
        overflow: 'hidden', 
      }}
      ref={gridRef}
    >
      <Image
        src="https://placehold.co/240x420.png" 
        alt="Game board background"
        layout="fill"
        objectFit="cover"
        className="z-0"
        data-ai-hint="dark texture"
      />
      {gridData.map((row, rIndex) => {
        return row.slice(0, visualTilesPerRow).map((tileData, cIndex) => {
          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);

          if (activeDrag && isPartOfActiveDrag && activeDrag.draggedLineCoords && activeDrag.dragAxisLocked) {
            // For dragged lines, draggedLineCoords contains all cells (some may be null if gridData had nulls)
            // The number of elements for displacement should be fixed for rows, dynamic for diagonals
            const numElementsForDisplacement = activeDrag.dragAxisLocked === 'row' 
                ? visualTilesPerRow 
                : activeDrag.draggedLineCoords.length;

            const lineDisplacement = getLineDisplacementVector(numElementsForDisplacement, activeDrag.dragAxisLocked);
            
            let primaryDeltaX = 0, primaryDeltaY = 0;
            if (activeDrag.dragAxisLocked === 'row') {
              primaryDeltaX = activeDrag.visualOffset;
            } else { 
              const angleRad = activeDrag.dragAxisLocked === 'sum' ? (Math.PI * 2 / 3) : (Math.PI / 3);
              primaryDeltaX = activeDrag.visualOffset * Math.cos(angleRad);
              primaryDeltaY = activeDrag.visualOffset * Math.sin(angleRad);
            }

            const transformsToRender = [
              { dx: primaryDeltaX, dy: primaryDeltaY, keySuffix: '-main', opacity: 1 }
            ];
            
            const wrapDisplayThreshold = TILE_BASE_WIDTH / 2.5; // Show wrapped tile after dragging ~40% of a tile width

            if (lineDisplacement.dx !== 0 || lineDisplacement.dy !== 0) {
                if (activeDrag.visualOffset > wrapDisplayThreshold) {
                  transformsToRender.push({
                    dx: primaryDeltaX - lineDisplacement.dx,
                    dy: primaryDeltaY - lineDisplacement.dy,
                    keySuffix: '-wrap-past', 
                    opacity: 1 
                  });
                }
                if (activeDrag.visualOffset < -wrapDisplayThreshold) {
                  transformsToRender.push({
                    dx: primaryDeltaX + lineDisplacement.dx,
                    dy: primaryDeltaY + lineDisplacement.dy,
                    keySuffix: '-wrap-future',
                    opacity: 1
                  });
                }
            }
            
            // Key for React.Fragment should be stable based on cell, not tileData.id which might be null
            const fragmentKey = tileData ? tileData.id : `${rIndex}-${cIndex}`;

            return (
              <React.Fragment key={`${fragmentKey}-draggroup`}>
                {transformsToRender.map(transform => (
                  tileData ? // Only render if there's actual tileData for this original cell
                  <div
                    // Key for individual transformed divs, tileData.id is fine if tileData exists
                    key={tileData.id + transform.keySuffix}
                    style={{
                      position: 'absolute',
                      left: `${baseX}px`,
                      top: `${baseY}px`,
                      width: `${TILE_BASE_WIDTH}px`,
                      height: `${TILE_HEIGHT}px`,
                      transform: `translate(${transform.dx}px, ${transform.dy}px)`,
                      transition: 'none', 
                      zIndex: 10, 
                      cursor: 'grabbing',
                      opacity: transform.opacity,
                    }}
                  >
                    <Tile tile={tileData} />
                  </div>
                  : null // If original tileData is null, don't render anything for this slot
                ))}
              </React.Fragment>
            );
          } else { // Tile is not part of active drag line
            if (!tileData) return null; // If no tile and not part of drag, render nothing
            return (
              <div
                key={tileData.id}
                style={{
                  position: 'absolute',
                  left: `${baseX}px`,
                  top: `${baseY}px`,
                  width: `${TILE_BASE_WIDTH}px`,
                  height: `${TILE_HEIGHT}px`,
                  transform: 'translate(0px,0px)',
                  transition: (activeDrag === null && !isProcessingMove) ? `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out, opacity ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out` : 'none',
                  zIndex: isProcessingMove && !activeDrag ? 5 : 1, 
                  cursor: (activeDrag || isProcessingMove) ? 'default' : 'grab',
                  // Dim non-dragged tiles slightly if a drag is active elsewhere
                  opacity: (activeDrag && activeDrag.draggedLineCoords && !activeDrag.draggedLineCoords.some(coord => coord.r === rIndex && coord.c === cIndex)) ? 0.7 : 1,
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

