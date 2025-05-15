
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

  const mathGridWidth = (visualTilesPerRow + 1) * TILE_BASE_WIDTH / 2;
  const mathGridHeight = numGridRows * TILE_HEIGHT;

  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;
  const positionOffset = TILE_BORDER_WIDTH / 2;

  const getTilePosition = (r: number, c: number) => {
    let x = c * (TILE_BASE_WIDTH / 2);
    // No horizontal shift for odd rows in the current 11-wide, 12-high configuration
    // if (r % 2 !== 0) { 
    //   x += TILE_BASE_WIDTH / 2;
    // }
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
        let determinedLineCoords: { r: number; c: number }[] | null = null;

        if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) {
          determinedAxis = 'row';
          const rowPath: {r:number, c:number}[] = [];
          for(let colIdx = 0; colIdx < visualTilesPerRow; colIdx++) {
             rowPath.push({r: currentDragState.startTileR, c: colIdx});
          }
          determinedLineCoords = rowPath;
        } else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) {
          determinedAxis = 'diff';
          determinedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, 'diff');
        } else if ((angle >= 90 && angle <= 150) || (angle <= -30 && angle >= -90)) {
          determinedAxis = 'sum';
          determinedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, 'sum');
        }
        newDragAxisLocked = determinedAxis;
        newDraggedLineCoords = determinedLineCoords;
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
      if (newDragAxisLocked === 'row') {
        newVisualOffset = deltaX;
      } else {
        const angleRad = newDragAxisLocked === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3);
        newVisualOffset = deltaX * Math.cos(angleRad) + deltaY * Math.sin(angleRad);
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
    const currentDragState = activeDragRef.current; // Use the ref for the most current state
    let slideInfo: {
      lineType: 'row' | DiagonalType;
      identifier: number | { r: number; c: number };
      direction: SlideDirection | ('left' | 'right');
    } | null = null;
  
    if (currentDragState && currentDragState.dragAxisLocked && currentDragState.draggedLineCoords && currentDragState.draggedLineCoords.length >= 1) {
      const { dragAxisLocked, startTileR, startTileC, visualOffset } = currentDragState;
      const slideThreshold = TILE_BASE_WIDTH * 0.40;
  
      if (Math.abs(visualOffset) > slideThreshold) {
        const direction = visualOffset > 0 ?
          (dragAxisLocked === 'row' ? 'right' : 'forward') :
          (dragAxisLocked === 'row' ? 'left' : 'backward');
  
        const lineTypeToCommit = dragAxisLocked;
        const identifierToCommit = dragAxisLocked === 'row' ? startTileR : { r: startTileR, c: startTileC };
        const directionToCommit = direction as SlideDirection | ('left' | 'right');
        
        slideInfo = { lineType: lineTypeToCommit, identifier: identifierToCommit, direction: directionToCommit };
      }
    }
    
    setActiveDrag(null); 
  
    if (slideInfo) {
      setTimeout(() => {
        onSlideCommit(slideInfo!.lineType, slideInfo!.identifier, slideInfo!.direction);
      }, 0);
    }
  }, [onSlideCommit, TILE_BASE_WIDTH]);

  useEffect(() => {
    // handleDragMove and handleDragEnd are stable due to useCallback
    // The effect re-runs when `activeDrag` changes its truthiness (null vs. object)
    // We use activeDragRef.current inside handleDragStart to check if a drag is already active.
    // And activeDrag (the state) to decide whether to attach listeners.
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
        return row.slice(0, visualTilesPerRow).map((tileData, cIndex) => {
           if (!tileData) return null;

          const { x, y } = getTilePosition(rIndex, cIndex);
          let transform = 'translate(0px, 0px)';
          let zIndex = 1;

          if (activeDrag && activeDrag.draggedLineCoords) {
            const isTileInDraggedLine = activeDrag.draggedLineCoords.some(coord => coord.r === rIndex && coord.c === cIndex);
            if (isTileInDraggedLine) {
              zIndex = 10;
              if (activeDrag.dragAxisLocked === 'row') {
                transform = `translateX(${activeDrag.visualOffset}px)`;
              } else if (activeDrag.dragAxisLocked === 'diff') {
                const angleRad = Math.PI / 3;
                const dx = activeDrag.visualOffset * Math.cos(angleRad);
                const dy = activeDrag.visualOffset * Math.sin(angleRad);
                transform = `translate(${dx}px, ${dy}px)`;
              } else if (activeDrag.dragAxisLocked === 'sum') {
                const angleRad = 2 * Math.PI / 3;
                const dx = activeDrag.visualOffset * Math.cos(angleRad);
                const dy = activeDrag.visualOffset * Math.sin(angleRad);
                transform = `translate(${dx}px, ${dy}px)`;
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
                zIndex: zIndex,
                cursor: activeDrag ? 'grabbing' : (isProcessingMove ? 'default' : 'grab'),
              }}
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

    