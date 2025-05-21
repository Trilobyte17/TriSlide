
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { getExpectedOrientation } from '@/lib/tripuzzle/engine';
import { Tile } from './Tile';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine';
import Image from 'next/image'; // Import next/image

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
  draggedLineCoords: { r: number; c: number }[] | null; // Stores actual grid coords of tiles in the line
  visualOffset: number; // Offset along the drag axis (pixels)
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

  const numGridRows = GAME_SETTINGS.GRID_HEIGHT_TILES; // Should be 12
  const visualTilesPerRow = GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Should be 11

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const activeDragRef = useRef<ActiveDragState | null>(null);
  useEffect(() => { activeDragRef.current = activeDrag; }, [activeDrag]);

  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);

  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate width for a row of 11 tessellating triangles
  const mathGridWidth = (visualTilesPerRow + 1) * TILE_BASE_WIDTH / 2; // (11+1)/2 * W = 6 * W
  const mathGridHeight = numGridRows * TILE_HEIGHT; // 12 * H

  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;
  const positionOffset = TILE_BORDER_WIDTH / 2;

  const getTilePosition = (r: number, c: number) => {
    // For no horizontal offset grid
    const xBase = c * (TILE_BASE_WIDTH / 2);
    const yBase = r * TILE_HEIGHT;
    return {
      x: xBase + positionOffset,
      y: yBase + positionOffset
    };
  };

  // Calculate displacement vector for one full wrap of the line
  const getLineDisplacementVector = useCallback((
    lineCoords: { r: number; c: number }[] | null,
    dragAxis: DragAxis | null
  ): { dx: number; dy: number } => {
    if (!lineCoords || lineCoords.length === 0 || !dragAxis) {
      return { dx: 0, dy: 0 };
    }
    const numElementsInLine = lineCoords.length;

    if (dragAxis === 'row') {
      // Visual span of a row of N tessellating triangles: (N+1) * TILE_BASE_WIDTH / 2
      const displacementX = (numElementsInLine + 1) * (TILE_BASE_WIDTH / 2);
      return { dx: displacementX, dy: 0 };
    } else { // Diagonal
      // Heuristic: Use an effective step distance along the diagonal per tile
      // This needs to be tuned to visually match the span of numElementsInLine tiles
      const effectiveStepDistance = TILE_BASE_WIDTH * 0.75; // Tunable factor
      const totalLength = numElementsInLine * effectiveStepDistance;
      
      // Determine angle of the diagonal drag axis (could be 60 or 120 deg for sum/diff)
      // For simplicity, let's approximate based on common angles.
      // A more robust way would be to use the angle of vector from first to last tile in lineCoords.
      let angleRad = dragAxis === 'sum' ? (Math.PI * 2 / 3) : (Math.PI / 3); // Approx 120 deg for sum, 60 deg for diff

      // If activeDragRef.current exists, use its actual drag angle for better precision
      if(activeDragRef.current && activeDragRef.current.startScreenX !== activeDragRef.current.currentScreenX) {
          const dX = activeDragRef.current.currentScreenX - activeDragRef.current.startScreenX;
          const dY = activeDragRef.current.currentScreenY - activeDragRef.current.startScreenY;
          angleRad = Math.atan2(dY, dX);
      } else if (dragAxis === 'sum') { // fallback if no drag delta
          angleRad = (Math.PI * 2 / 3); 
      } else { // diff
          angleRad = (Math.PI / 3);
      }

      return {
        dx: totalLength * Math.cos(angleRad),
        dy: totalLength * Math.sin(angleRad)
      };
    }
  }, [TILE_BASE_WIDTH]);


  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMove || activeDragRef.current) return;
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
    if (!currentDragState || !gridDataRef.current) return;

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
        } else if (angle > 30 && angle < 90) { // bottom-right-ish for '\' (diff)
          determinedAxis = 'diff'; 
        } else if (angle > 90 && angle < 150) { // bottom-left-ish for '/' (sum)
          determinedAxis = 'sum'; 
        } else if (angle < -30 && angle > -90) { // top-right-ish for '/' (sum)
          determinedAxis = 'sum'; 
        } else if (angle < -90 && angle > -150) { // top-left-ish for '\' (diff)
          determinedAxis = 'diff'; 
        }
        newDragAxisLocked = determinedAxis;

        if (determinedAxis === 'row') {
            newDraggedLineCoords = [];
            for(let colIdx = 0; colIdx < visualTilesPerRow; colIdx++) {
                 newDraggedLineCoords.push({r: currentDragState.startTileR, c: colIdx});
            }
        } else if (determinedAxis && gridDataRef.current) {
            // Get ALL cells on the diagonal, including nulls
            newDraggedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
      if (newDragAxisLocked === 'row') {
        newVisualOffset = deltaX;
      } else { 
        // Project deltaX, deltaY onto the drag axis angle
        const dragAngleRad = Math.atan2(deltaY, deltaX); // Actual angle of current drag gesture
        newVisualOffset = deltaX * Math.cos(dragAngleRad) + deltaY * Math.sin(dragAngleRad);
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
  }, [visualTilesPerRow, getTilesOnDiagonalEngine]); // Include engine func if used


  const handleDragEnd = useCallback(() => {
    const currentDragState = activeDragRef.current; // Capture before setting to null
    
    // Store commit parameters *before* calling setActiveDrag(null)
    const commitParams = currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1
      ? {
          dragAxisLocked: currentDragState.dragAxisLocked,
          startTileR: currentDragState.startTileR,
          startTileC: currentDragState.startTileC,
          visualOffset: currentDragState.visualOffset,
        }
      : null;

    setActiveDrag(null); // Update child state first

    if (commitParams) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset } = commitParams;

      // Effective width of one tile slot along its axis for snapping
      let effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.75; 
      if (dragAxisLocked === 'diff' || dragAxisLocked === 'sum') {
         effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.6; 
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
        
        setTimeout(() => { // Defer parent state update
            onSlideCommitRef.current(lineTypeToCommit, identifierToCommit, directionForEngine, numActualSteps);
        }, 0);
      }
    }
  }, [TILE_BASE_WIDTH]); 

  useEffect(() => {
    if (activeDrag) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: true }); 
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


  const lineDisplacement = getLineDisplacementVector(activeDrag?.draggedLineCoords || null, activeDrag?.dragAxisLocked || null);
  const wrapDisplayThreshold = TILE_BASE_WIDTH / 2.5; // Threshold for showing wrapped tiles


  return (
    <div
      className="relative rounded-lg shadow-inner select-none touch-none"
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`,
        height: `${styledContainerHeight}px`,
        overflow: 'hidden', 
        // backgroundColor: 'hsl(var(--background))' // Fallback if image fails
      }}
      ref={gridRef}
    >
      <Image
        src="https://placehold.co/240x420.png" 
        alt="Game board background"
        fill // Use fill for Next.js 13+ Image
        style={{ objectFit: 'cover' }} // Ensure image covers the area
        className="z-0" // Ensure background is behind tiles
        data-ai-hint="dark texture"
      />
      {gridData.map((row, rIndex) => {
        return row.slice(0, visualTilesPerRow).map((tileData, cIndex) => {
          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);
          const originalTileAtCoord = gridDataRef.current[rIndex]?.[cIndex]; // Tile from the *actual* grid state

          let transformsToRender = [{ dx: 0, dy: 0, keySuffix: '-orig' }];

          if (activeDrag && isPartOfActiveDrag && activeDrag.draggedLineCoords && lineDisplacement.dx !== 0) { // Check dx to avoid issues with 0 displacement
            // Primary dragged position
            let primaryDeltaX = 0, primaryDeltaY = 0;
            if (activeDrag.dragAxisLocked === 'row') {
              primaryDeltaX = activeDrag.visualOffset;
            } else if (activeDrag.dragAxisLocked) { // 'sum' or 'diff'
              const dX = activeDrag.currentScreenX - activeDrag.startScreenX;
              const dY = activeDrag.currentScreenY - activeDrag.startScreenY;
              const dragAngleRad = Math.atan2(dY, dX);
              primaryDeltaX = activeDrag.visualOffset * Math.cos(dragAngleRad);
              primaryDeltaY = activeDrag.visualOffset * Math.sin(dragAngleRad);
            }
            transformsToRender[0] = { dx: primaryDeltaX, dy: primaryDeltaY, keySuffix: '-drag' };

            // Wrapped "past" tile (fills void on left when dragging right)
            if (activeDrag.visualOffset > wrapDisplayThreshold) {
              transformsToRender.push({ dx: primaryDeltaX - lineDisplacement.dx, dy: primaryDeltaY - lineDisplacement.dy, keySuffix: '-wrap-past' });
            }
            // Wrapped "future" tile (fills void on right when dragging left)
            if (activeDrag.visualOffset < -wrapDisplayThreshold) {
              transformsToRender.push({ dx: primaryDeltaX + lineDisplacement.dx, dy: primaryDeltaY + lineDisplacement.dy, keySuffix: '-wrap-future' });
            }
          }
          
          // Use originalTileAtCoord for rendering, as tileData from map might be null
          // if part of a dragged line that includes empty cells
          const currentRenderTileData = isPartOfActiveDrag ? originalTileAtCoord : tileData;

          if (!currentRenderTileData && !isPartOfActiveDrag) return null; // Don't render for non-dragged empty slots
          if (!currentRenderTileData && isPartOfActiveDrag && transformsToRender.length === 1 && transformsToRender[0].keySuffix === '-orig') {
            // If it's an empty slot in a dragged line, and not being actively transformed (e.g. initial render of drag), skip
            return null; 
          }


          return (
            <React.Fragment key={`${rIndex}-${cIndex}${currentRenderTileData ? '-'+currentRenderTileData.id : '-empty'}`}>
              {transformsToRender.map(transform => {
                 // Only render if there's data, or if it's a dragged empty slot (which will look empty)
                 if (!currentRenderTileData && !isPartOfActiveDrag) return null;

                 let tileStyle: React.CSSProperties = {
                    position: 'absolute',
                    left: `${baseX}px`,
                    top: `${baseY}px`,
                    width: `${TILE_BASE_WIDTH}px`,
                    height: `${TILE_HEIGHT}px`,
                    transform: `translate(${transform.dx}px, ${transform.dy}px)`,
                    transition: (activeDrag === null && !isProcessingMove) ? `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out, opacity ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out` : 'none',
                    zIndex: 1, 
                    cursor: (activeDrag || isProcessingMove) ? 'default' : 'grab',
                 };
      
                 if (activeDrag && isPartOfActiveDrag) {
                   tileStyle.zIndex = 10; 
                   tileStyle.cursor = 'grabbing';
                 } else if (activeDrag && activeDrag.draggedLineCoords && !isPartOfActiveDrag) {
                   tileStyle.opacity = 0.7;
                 }
                 
                 if (isProcessingMove && !activeDrag) {
                    tileStyle.zIndex = 5; 
                 }

                 // If it's a dragged empty slot, render an empty div or a placeholder visual
                 if (!currentRenderTileData && isPartOfActiveDrag) {
                    return (
                      <div
                        key={`empty-${rIndex}-${cIndex}${transform.keySuffix}`}
                        style={tileStyle}
                        // Optionally, add a very faint placeholder style for empty dragged slots
                        // className="bg-neutral-700/10" 
                      />
                    );
                 }
                 
                 // Render actual tile if data exists
                 return currentRenderTileData ? (
                   <div
                     key={currentRenderTileData.id + transform.keySuffix} 
                     style={tileStyle}
                     onMouseDown={(e) => !isPartOfActiveDrag ? handleDragStart(e, rIndex, cIndex) : undefined} // Only allow drag start on non-dragged part
                     onTouchStart={(e) => !isPartOfActiveDrag ? handleDragStart(e, rIndex, cIndex) : undefined}
                     role="gridcell"
                     aria-label={`Tile at row ${rIndex + 1}, col ${cIndex + 1} with color ${currentRenderTileData.color}`}
                   >
                     <Tile tile={currentRenderTileData} />
                   </div>
                 ) : null;
              })}
            </React.Fragment>
          );
        })
      })}
    </div>
  );
}
