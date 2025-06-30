
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GridData, DiagonalType, SlideDirection, Tile as TileType } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
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

const getExpectedOrientation = (r: number, c: number): 'up' | 'down' => {
  if (r < 0 || c < 0) {
      const isEvenRow = r % 2 === 0;
      const isEvenCol = c % 2 === 0;
      if(isEvenRow) return isEvenCol ? 'up' : 'down';
      return isEvenCol ? 'down' : 'up';
  }
  if (r % 2 === 0) { 
    return c % 2 === 0 ? 'up' : 'down';
  } else { 
    return c % 2 === 0 ? 'down' : 'up';
  }
};


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

  const getLineDisplacementVector = useCallback((
    lineCoords: { r: number; c: number }[] | null,
    dragAxis: DragAxis | null
  ): { dx: number; dy: number } => {
    if (!lineCoords || lineCoords.length === 0 || !dragAxis) {
      return { dx: 0, dy: 0 };
    }
    const numElementsInLine = lineCoords.length;

    if (dragAxis === 'row') {
      const displacementX = (numElementsInLine + 1) * (TILE_BASE_WIDTH / 2);
      return { dx: displacementX, dy: 0 };
    } else { // Diagonals
      const angleRad = dragAxis === 'diff' ? (2 * Math.PI) / 3 : Math.PI / 3;
      const effectiveStepDistance = TILE_BASE_WIDTH * 0.75;
      const displacementMagnitude = numElementsInLine * effectiveStepDistance;
      
      return {
          dx: displacementMagnitude * Math.cos(angleRad),
          dy: displacementMagnitude * Math.sin(angleRad)
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
        } else if (angle > 30 && angle < 90) { // Top-left drag half
          determinedAxis = 'sum'; 
        } else if (angle > 90 && angle < 150) { // Top-right drag half
          determinedAxis = 'diff'; 
        } else if (angle < -30 && angle > -90) { // Bottom-right drag half
          determinedAxis = 'diff'; 
        } else if (angle < -90 && angle > -150) { // Bottom-left drag half
          determinedAxis = 'sum'; 
        }
        newDragAxisLocked = determinedAxis;

        if (determinedAxis === 'row') {
            newDraggedLineCoords = Array.from({ length: visualTilesPerRow }, (_, colIdx) => ({
                r: currentDragState.startTileR,
                c: colIdx
            }));
        } else if (determinedAxis && gridDataRef.current) {
            newDraggedLineCoords = await getTilesOnDiagonalEngine(gridDataRef.current, currentDragState.startTileR, currentDragState.startTileC, determinedAxis);
        }
      }
    }

    if (newDragAxisLocked && newDraggedLineCoords) {
        const axisAngleRad = newDragAxisLocked === 'row' ? 0 : (newDragAxisLocked === 'diff' ? (2 * Math.PI) / 3 : Math.PI / 3);
        
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
  
  const wrapDisplayThreshold = TILE_BASE_WIDTH / 2.5;

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
        fill
        style={{ objectFit: 'cover' }}
        className="z-0"
        data-ai-hint="dark texture"
        priority
      />
      {gridData.map((row, rIndex) => {
        return row.slice(0, visualTilesPerRow).map((tileData, cIndex) => {
          const { x: baseX, y: baseY } = getTilePosition(rIndex, cIndex);
          
          const isPartOfActiveDrag = activeDrag?.draggedLineCoords?.some(coord => coord.r === rIndex && coord.c === cIndex);
          const currentRenderTileData = (isPartOfActiveDrag && gridDataRef.current[rIndex]?.[cIndex]) || tileData;
          
          if (!currentRenderTileData) return null;

          let transformsToRender = [{ dx: 0, dy: 0, keySuffix: '-orig' }];

          if (activeDrag && isPartOfActiveDrag && activeDrag.draggedLineCoords && activeDrag.dragAxisLocked) {
              const axisAngleRad = activeDrag.dragAxisLocked === 'row' ? 0 : (activeDrag.dragAxisLocked === 'diff' ? (2 * Math.PI) / 3 : Math.PI / 3);
              
              const primaryDeltaX = activeDrag.visualOffset * Math.cos(axisAngleRad);
              const primaryDeltaY = activeDrag.visualOffset * Math.sin(axisAngleRad);
            
              transformsToRender[0] = { dx: primaryDeltaX, dy: primaryDeltaY, keySuffix: '-drag' };

              const lineDisplacement = getLineDisplacementVector(activeDrag.draggedLineCoords, activeDrag.dragAxisLocked);

              if (Math.abs(activeDrag.visualOffset) > wrapDisplayThreshold) {
                  if (activeDrag.visualOffset > 0) {
                      transformsToRender.push({ dx: primaryDeltaX - lineDisplacement.dx, dy: primaryDeltaY - lineDisplacement.dy, keySuffix: '-wrap-past' });
                  }
                  if (activeDrag.visualOffset < 0) {
                      transformsToRender.push({ dx: primaryDeltaX + lineDisplacement.dx, dy: primaryDeltaY + lineDisplacement.dy, keySuffix: '-wrap-future' });
                  }
              }
          }
          
          return (
            <React.Fragment key={`${rIndex}-${cIndex}-${currentRenderTileData.id || 'null'}`}>
              {transformsToRender.map(transform => {
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
                 
                 let tileToRender: TileType = { ...currentRenderTileData };

                 if (activeDrag && activeDrag.draggedLineCoords && isPartOfActiveDrag && transform.keySuffix.startsWith('-wrap')) {
                   const lineType = activeDrag.dragAxisLocked;
                   const numElementsInLine = activeDrag.draggedLineCoords.length;
                 
                   if (lineType === 'row') {
                     let conceptualCol = cIndex;
                     if (transform.keySuffix.endsWith('-past')) { // Wrapped from right to left
                       conceptualCol = cIndex - numElementsInLine;
                     } else if (transform.keySuffix.endsWith('-future')) { // Wrapped from left to right
                       conceptualCol = cIndex + numElementsInLine;
                     }
                     tileToRender.orientation = getExpectedOrientation(rIndex, conceptualCol);
                   }
                   // Note: Diagonal orientation fix would be more complex and is omitted for now
                 }

                 return (
                   <div
                     key={currentRenderTileData.id + transform.keySuffix} 
                     style={tileStyle}
                     onMouseDown={(e) => handleDragStart(e, rIndex, cIndex)}
                     onTouchStart={(e) => handleDragStart(e, rIndex, cIndex)}
                     role="gridcell"
                     aria-label={`Tile at row ${rIndex + 1}, col ${cIndex + 1} with color ${currentRenderTileData.color}`}
                   >
                     <Tile tile={tileToRender} />
                   </div>
                 );
              })}
            </React.Fragment>
          );
        })
      })}
    </div>
  );
}
