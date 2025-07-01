
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { getTilesOnDiagonal as getTilesOnDiagonalEngine } from '@/lib/tripuzzle/engine';
import { Tile } from './Tile';

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

  const getTilePosition = (r: number, c: number) => {
    const xBase = c * (TILE_BASE_WIDTH / 2);
    const yBase = r * TILE_HEIGHT;
    return {
      x: xBase + positionOffset,
      y: yBase + positionOffset
    };
  };

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

  const handleDragMove = useCallback((event: MouseEvent | TouchEvent) => {
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
        } else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) {
            // This is a '\' diagonal (top-left to bottom-right or vice versa)
            determinedAxis = 'diff';
        } else if ((angle > 90 && angle < 150) || (angle < -30 && angle > -90)) {
            // This is a '/' diagonal (top-right to bottom-left or vice versa)
            determinedAxis = 'sum';
        }

        newDragAxisLocked = determinedAxis;

        if (determinedAxis === 'row') {
            newDraggedLineCoords = Array.from({ length: visualTilesPerRow }, (_, colIdx) => ({
                r: currentDragState.startTileR,
                c: colIdx
            }));
        } else if (determinedAxis && gridDataRef.current) {
            newDraggedLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
        // `sum` is '/' which is ~150deg. `diff` is '\' which is ~30deg.
        const axisAngleRad = newDragAxisLocked === 'row' ? 0 
                             : newDragAxisLocked === 'sum' ? (5 * Math.PI) / 6 // 150 degrees
                             : Math.PI / 6; // 30 degrees
        
        const axisUnitVectorX = Math.cos(axisAngleRad);
        const axisUnitVectorY = Math.sin(axisAngleRad);
        newVisualOffset = deltaX * axisUnitVectorX + deltaY * axisUnitVectorY;
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
    
    const commitParams = currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1
      ? {
          dragAxisLocked: currentDragState.dragAxisLocked,
          startTileR: currentDragState.startTileR,
          startTileC: currentDragState.startTileC,
          visualOffset: currentDragState.visualOffset,
        }
      : null;

    setActiveDrag(null);

    if (commitParams) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset } = commitParams;

      // The distance between the centers of two adjacent tiles in a row is TILE_BASE_WIDTH.
      // We use this as a consistent unit for determining slide steps.
      const effectiveTileShiftUnit = TILE_BASE_WIDTH / 2;

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
  
  return (
    <div
      className="relative rounded-lg shadow-inner select-none touch-none bg-muted"
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
        return row.slice(0, visualTilesPerRow).map((tileData, cIndex) => {
          if (!tileData) return null;

          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);
          
          let deltaX = 0;
          let deltaY = 0;

          if (activeDrag && isPartOfActiveDrag && activeDrag.dragAxisLocked) {
              const axisAngleRad = activeDrag.dragAxisLocked === 'row' ? 0 
                                 : activeDrag.dragAxisLocked === 'sum' ? (5 * Math.PI) / 6 // 150 degrees
                                 : Math.PI / 6; // 30 degrees
              
              deltaX = activeDrag.visualOffset * Math.cos(axisAngleRad);
              deltaY = activeDrag.visualOffset * Math.sin(axisAngleRad);
          }

          let tileStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${baseX}px`,
            top: `${baseY}px`,
            width: `${TILE_BASE_WIDTH}px`,
            height: `${TILE_HEIGHT}px`,
            transform: `translate(${deltaX}px, ${deltaY}px)`,
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

          return (
            <div
              key={tileData.id} 
              style={tileStyle}
              onMouseDown={(e) => handleDragStart(e, rIndex, cIndex)}
              onTouchStart={(e) => handleDragStart(e, rIndex, cIndex)}
              role="gridcell"
              aria-label={`Tile at row ${rIndex + 1}, col ${cIndex + 1} with color ${tileData.color}`}
            >
              <Tile tile={tileData} />
            </div>
          );
        })
      })}
    </div>
  );
}

