
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
  const maxTilesInRow = GAME_SETTINGS.GRID_WIDTH_TILES; 

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  const isProcessingMoveRef = useRef(isProcessingMove);
  useEffect(() => { isProcessingMoveRef.current = isProcessingMove; }, [isProcessingMove]);
  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);

  const mathGridWidth = ((maxTilesInRow -1) * 0.5 + 1) * TILE_BASE_WIDTH;
  const mathGridHeight = numGridRows * TILE_HEIGHT;

  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;

  const positionOffset = TILE_BORDER_WIDTH / 2;

  const getTilePosition = (r: number, c: number) => {
    let x = c * (TILE_BASE_WIDTH / 2);

    // Odd rows (1, 3, 5...) are shifted to the right by half a tile width to interlock
    if (r % 2 !== 0) {
      x += TILE_BASE_WIDTH / 2;
    }

    const y = r * TILE_HEIGHT;
    
    return { 
      x: x + positionOffset,
      y: y + positionOffset 
    };
  };
  
  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMoveRef.current || activeDrag) return;
    
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

        if (!currentDragAxis) { 
          const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dragDistance > GAME_SETTINGS.DRAG_THRESHOLD) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI; 
            
            if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) {
              currentDragAxis = 'row';
              const rowPath: {r:number, c:number}[] = [];
              const numTilesInCurrentDataRow = (prevDrag.startTileR % 2 === 0) ? maxTilesInRow : maxTilesInRow -1;
              for(let colIdx = 0; colIdx < numTilesInCurrentDataRow; colIdx++) {
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
          } else { 
            const angleRad = currentDragAxis === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3); 
            currentVisualOffset = deltaX * Math.cos(angleRad) + deltaY * Math.sin(angleRad);
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
      const currentActiveDragState = activeDrag; 
      
      setActiveDrag(null); 

      if (!currentActiveDragState || !currentActiveDragState.dragAxisLocked || !currentActiveDragState.draggedLineCoords || currentActiveDragState.draggedLineCoords.length < 2) {
        return; 
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
      document.addEventListener('touchcancel', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [activeDrag, TILE_BASE_WIDTH, maxTilesInRow]);

  return (
    <div
      className="relative p-1 bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none touch-none" 
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`, 
        height: `${styledContainerHeight}px`, 
        overflow: 'hidden', 
      }}
      ref={gridRef}
    >
      {gridData.map((row, rIndex) => 
        row.map((tileData, cIndex) => {
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
      )}
    </div>
  );
}

