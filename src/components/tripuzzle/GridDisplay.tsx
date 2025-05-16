
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine';

interface GridDisplayProps {
  gridData: GridData;
  isProcessingMove: boolean;
  onSlideCommit: (
    lineType: 'row' | DiagonalType,
    identifier: number | { r: number, c: number },
    direction: SlideDirection | ('left' | 'right'), // For engine: 'left'/'right' for rows, 'forward'/'backward' for diagonals
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
  draggedLineCoords: { r: number; c: number }[] | null; // Actual tile coordinates in the line
  visualOffset: number; // Displacement along the drag axis
}

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
  useEffect(() => {
    activeDragRef.current = activeDrag;
  }, [activeDrag]);

  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);
  
  const gridRef = useRef<HTMLDivElement>(null);

  const mathGridWidth = (visualTilesPerRow * TILE_BASE_WIDTH) - (visualTilesPerRow > 0 ? (visualTilesPerRow -1) * TILE_BASE_WIDTH / 2 : 0) ;
  const mathGridHeight = numGridRows * TILE_HEIGHT;
  
  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;
  const positionOffset = TILE_BORDER_WIDTH / 2;

  const getTilePosition = (r: number, c: number) => {
    let x = c * (TILE_BASE_WIDTH / 2);
    const y = r * TILE_HEIGHT;
    return {
      x: x + positionOffset,
      y: y + positionOffset
    };
  };

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMove || activeDragRef.current) return;
    if (!gridDataRef.current[r]?.[c]) return;

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
        
        if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) { // Horizontal
          determinedAxis = 'row';
        } else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) { // \ diagonal (diff)
          determinedAxis = 'diff';
        } else { // / diagonal (sum)
          determinedAxis = 'sum';
        }
        newDragAxisLocked = determinedAxis;
        
        if (determinedAxis === 'row') {
            newDraggedLineCoords = [];
            for(let colIdx = 0; colIdx < visualTilesPerRow; colIdx++) {
                 newDraggedLineCoords.push({r: currentDragState.startTileR, c: colIdx});
            }
        } else if (determinedAxis) { // 'sum' or 'diff'
            newDraggedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
      if (newDragAxisLocked === 'row') {
        newVisualOffset = deltaX;
      } else { // Diagonals
        // Angle of the diagonal itself relative to horizontal screen axis
        // Diff ('\') angle is approx 60 deg or PI/3. Sum ('/') angle is approx 120 deg or 2PI/3.
        const lineAngleRad = newDragAxisLocked === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3);
        // Project mouse delta onto the line's axis
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
  }, [visualTilesPerRow]);


  const handleDragEnd = useCallback(() => {
    const currentDragState = activeDragRef.current; 
    let slideInfo: {
      lineType: 'row' | DiagonalType;
      identifier: number | { r: number; c: number };
      directionForEngine: SlideDirection | ('left' | 'right');
      numSteps: number;
    } | null = null;
  
    if (currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = currentDragState;
      
      let effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.75; // Heuristic for snapping
      if (dragAxisLocked === 'diff' || dragAxisLocked === 'sum') {
         // For diagonals, visualOffset is already along the axis.
         // A consistent unit is needed. Let's use projected width of a tile.
         // An equilateral triangle height is sqrt(3)/2 * base.
         // The "width" along a 60-degree diagonal is related to this.
         // For simplicity, we can use TILE_BASE_WIDTH * 0.5 or TILE_HEIGHT as a rough unit.
         // Or stick to a similar pixel threshold as rows for simplicity.
         effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.4; // Use a smaller unit for diagonals, closer to drag threshold
      }

      const numShiftedRaw = visualOffset / effectiveTileShiftUnit;
      const numSteps = Math.round(numShiftedRaw);
  
      if (numSteps !== 0) {
        const lineTypeToCommit = dragAxisLocked;
        const identifierToCommit = dragAxisLocked === 'row' ? startTileR : { r: startTileR, c: startTileC };
        
        let directionForEngine: SlideDirection | ('left' | 'right');
        if (dragAxisLocked === 'row') {
            directionForEngine = numSteps > 0 ? 'right' : 'left';
        } else {
            directionForEngine = numSteps > 0 ? 'forward' : 'backward';
        }
        
        slideInfo = { 
            lineType: lineTypeToCommit, 
            identifier: identifierToCommit, 
            directionForEngine: directionForEngine,
            numSteps: Math.abs(numSteps) 
        };
      }
    }
    
    setActiveDrag(null); 
  
    if (slideInfo) {
      setTimeout(() => {
        onSlideCommit(slideInfo!.lineType, slideInfo!.identifier, slideInfo!.directionForEngine, slideInfo!.numSteps);
      }, 0);
    }
  }, [onSlideCommit, TILE_BASE_WIDTH]);

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

  // Helper to calculate the full line displacement vector for wrapping
  const getLineDisplacementVector = (
    lineCoords: { r: number; c: number }[] | null, 
    axis: DragAxis | null
  ): { dx: number, dy: number } => {
      if (!axis || !lineCoords || lineCoords.length === 0) return { dx: 0, dy: 0 };

      const lineDataLength = lineCoords.length;
      const unitShiftDistance = TILE_BASE_WIDTH; // This is the critical part for "how much is one tile"

      if (axis === 'row') {
          return { dx: lineDataLength * unitShiftDistance, dy: 0 };
      } else { // Diagonals
          const angleRad = axis === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3);
          return { 
              dx: lineDataLength * unitShiftDistance * Math.cos(angleRad), 
              dy: lineDataLength * unitShiftDistance * Math.sin(angleRad)
          };
      }
  };


  return (
    <div
      className="relative bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none"
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`,
        height: `${styledContainerHeight}px`,
        overflow: 'hidden', // Important for carousel illusion
      }}
      ref={gridRef}
    >
      {gridData.map((row, rIndex) => {
        return row.slice(0, visualTilesPerRow).map((tileData, cIndex) => {
           if (!tileData) return null;

          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);

          if (activeDrag && isPartOfActiveDrag && activeDrag.draggedLineCoords) {
            const lineCoords = activeDrag.draggedLineCoords;
            const lineDisplacement = getLineDisplacementVector(lineCoords, activeDrag.dragAxisLocked);
            const effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.75; // Threshold for showing wrapped tile

            let primaryDeltaX = 0, primaryDeltaY = 0;
            if (activeDrag.dragAxisLocked === 'row') {
              primaryDeltaX = activeDrag.visualOffset;
            } else {
              const angleRad = activeDrag.dragAxisLocked === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3);
              primaryDeltaX = activeDrag.visualOffset * Math.cos(angleRad);
              primaryDeltaY = activeDrag.visualOffset * Math.sin(angleRad);
            }

            const transformsToRender = [
              { dx: primaryDeltaX, dy: primaryDeltaY, keySuffix: '-main' }
            ];

            // Show tile wrapped from the "past" if dragging "forward" enough
            if (activeDrag.visualOffset > effectiveTileShiftUnit * 0.25) { 
              transformsToRender.push({ 
                dx: primaryDeltaX - lineDisplacement.dx, 
                dy: primaryDeltaY - lineDisplacement.dy, 
                keySuffix: '-wrap-past' 
              });
            }
            // Show tile wrapped from the "future" if dragging "backward" enough
            if (activeDrag.visualOffset < -effectiveTileShiftUnit * 0.25) {
              transformsToRender.push({ 
                dx: primaryDeltaX + lineDisplacement.dx, 
                dy: primaryDeltaY + lineDisplacement.dy, 
                keySuffix: '-wrap-future' 
              });
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
                      transition: 'none',
                      zIndex: 10,
                      cursor: 'grabbing',
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
                  transform: 'translate(0px,0px)',
                  transition: (activeDrag === null && !isProcessingMove) ? `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out, left ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out, top ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out` : 'none',
                  zIndex: isProcessingMove && !activeDrag ? 5 : 1, // Keep tiles that might animate slightly above others
                  cursor: (activeDrag || isProcessingMove) ? 'default' : 'grab',
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

    