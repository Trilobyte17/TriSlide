"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { getExpectedOrientation } from '@/lib/tripuzzle/utils'; // Fixed import
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
  draggedLineCoords: { r: number; c: number }[] | null;
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

  const getTilePosition = (r: number, c: number, virtualCol?: number) => {
    // virtualCol allows for correct positioning of wrapped tiles
    const effectiveCol = virtualCol !== undefined ? virtualCol : c;
    const x = effectiveCol * (TILE_BASE_WIDTH / 2);
    const y = r * TILE_HEIGHT;
    return {
      x: x + positionOffset,
      y: y + positionOffset,
      orientation: getExpectedOrientation(r, effectiveCol)
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
      // Intentionally not preventing default unless absolutely necessary
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

        // Improved angle detection for triangular grid diagonals
        if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) { 
          determinedAxis = 'row';
        } else if (angle > 30 && angle < 150) {
          // Upper half: down-left to down-right
          if (angle > 30 && angle < 90) {
            // Down-right: diff diagonal (\)
            determinedAxis = 'diff';
          } else {
            // Down-left: sum diagonal (/)
            determinedAxis = 'sum';
          }
        } else {
          // Lower half: up-right to up-left
          if (angle < -30 && angle > -90) {
            // Up-right: diff diagonal (\)
            determinedAxis = 'diff';
          } else {
            // Up-left: sum diagonal (/)
            determinedAxis = 'sum';
          }
        }
        
        newDragAxisLocked = determinedAxis;
        
        if (determinedAxis === 'row') {
            newDraggedLineCoords = [];
            for(let colIdx = 0; colIdx < visualTilesPerRow; colIdx++) {
                 newDraggedLineCoords.push({r: currentDragState.startTileR, c: colIdx});
            }
        } else if (determinedAxis && gridDataRef.current) { 
            newDraggedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
      if (newDragAxisLocked === 'row') {
        newVisualOffset = deltaX;
      } else {
        // For diagonal slides, project the drag vector onto the diagonal direction
        // Sum diagonal (/) goes from top-right to bottom-left
        // Diff diagonal (\) goes from top-left to bottom-right
        const lineAngleRad = newDragAxisLocked === 'sum' ? (Math.PI * 3 / 4) : (Math.PI / 4);
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
    setActiveDrag(null); 

    if (currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = currentDragState;
      
      let effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.60; 
      if (dragAxisLocked === 'diff' || dragAxisLocked === 'sum') {
         effectiveTileShiftUnit = TILE_BASE_WIDTH * 0.45; 
      }
      
      const numStepsRaw = Math.round(visualOffset / effectiveTileShiftUnit);
      
      const lineTypeToCommit = dragAxisLocked;
      const identifierToCommit = dragAxisLocked === 'row' ? startTileR : { r: startTileR, c: startTileC };
      
      let directionForEngine: SlideDirection | ('left' | 'right');
      if (dragAxisLocked === 'row') {
          directionForEngine = numStepsRaw > 0 ? 'right' : 'left';
      } else { 
          directionForEngine = numStepsRaw > 0 ? 'forward' : 'backward';
      }
      
      const numActualSteps = Math.abs(numStepsRaw);
      
      if (numActualSteps > 0) {
        setTimeout(() => { // Defer to avoid React warning about updating parent during child render
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

  const getLineDisplacementVector = (
    lineCoordsLength: number, 
    axis: DragAxis 
  ): { dx: number, dy: number } => {
      if (lineCoordsLength === 0 || !axis) return { dx: 0, dy: 0 };

      if (axis === 'row') {
          return { dx: visualTilesPerRow * (TILE_BASE_WIDTH / 2) + (TILE_BASE_WIDTH/2) , dy: 0 }; 
      } else { 
          const unitShiftDistance = TILE_BASE_WIDTH * 0.5; 
          // Corrected angles for proper triangular grid tessellation
          const angleRad = axis === 'sum' ? (Math.PI * 3 / 4) : (Math.PI / 4);
          return {
              dx: lineCoordsLength * unitShiftDistance * Math.cos(angleRad),
              dy: lineCoordsLength * unitShiftDistance * Math.sin(angleRad)
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
           if (!tileData) return null;

          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);

          if (activeDrag && isPartOfActiveDrag && activeDrag.draggedLineCoords && activeDrag.dragAxisLocked) {
            const lineCoords = activeDrag.draggedLineCoords;
            const lineDisplacement = getLineDisplacementVector(lineCoords.length, activeDrag.dragAxisLocked);
            
            let primaryDeltaX = 0, primaryDeltaY = 0;
            if (activeDrag.dragAxisLocked === 'row') {
              primaryDeltaX = activeDrag.visualOffset;
            } else {
              const angleRad = activeDrag.dragAxisLocked === 'sum' ? (Math.PI * 3 / 4) : (Math.PI / 4);
              primaryDeltaX = activeDrag.visualOffset * Math.cos(angleRad);
              primaryDeltaY = activeDrag.visualOffset * Math.sin(angleRad);
            }

            const transformsToRender = [
              { dx: primaryDeltaX, dy: primaryDeltaY, keySuffix: '-main', opacity: 1 }
            ];

            if (lineDisplacement.dx !== 0 || lineDisplacement.dy !== 0) {
                const tilesInLine = lineCoords.length;
                const virtualColOffset = activeDrag.dragAxisLocked === 'row' ? tilesInLine : 0;
                
                if (activeDrag.visualOffset > 0) { 
                  const virtualPos = getTilePosition(rIndex, cIndex - virtualColOffset);
                  transformsToRender.push({
                    dx: primaryDeltaX - lineDisplacement.dx,
                    dy: primaryDeltaY - lineDisplacement.dy,
                    keySuffix: '-wrap-past',
                    opacity: 1,
                    orientation: virtualPos.orientation
                  });
                }
                if (activeDrag.visualOffset < 0) { 
                  const virtualPos = getTilePosition(rIndex, cIndex + virtualColOffset);
                  transformsToRender.push({
                    dx: primaryDeltaX + lineDisplacement.dx,
                    dy: primaryDeltaY + lineDisplacement.dy,
                    keySuffix: '-wrap-future',
                    opacity: 1,
                    orientation: virtualPos.orientation
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
                      transition: 'none', 
                      zIndex: 10, 
                      cursor: 'grabbing',
                      opacity: transform.opacity,
                    }}
                  >
                    <Tile tile={tileData} />
                  </div>
                ))}
              </React.Fragment>
            );
          } else { 
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