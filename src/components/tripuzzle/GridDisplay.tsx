
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

  // Use refs for frequently accessed props/state in drag handlers to avoid stale closures
  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  const isProcessingMoveRef = useRef(isProcessingMove);
  useEffect(() => { isProcessingMoveRef.current = isProcessingMove; }, [isProcessingMove]);
  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);


  // Max tiles in any row is maxTilesInRow.
  // The width for N triangles where each is shifted by half a width relative to the previous:
  // (N_max_visual + 1) * TILE_BASE_WIDTH / 2
  // For 6 tiles visually in a row (maxTilesInRow = 6), this is (6+1)*W/2 = 3.5W
  const mathGridWidth = (maxTilesInRow + 1) * TILE_BASE_WIDTH / 2;
  const mathGridHeight = numGridRows * TILE_HEIGHT;

  // Container needs to be big enough for the tiles AND their borders.
  // A border of width B extends B/2 outside the mathematical edge.
  // So, the container needs to be B wider and B taller.
  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;
  const positionOffset = TILE_BORDER_WIDTH / 2; // Shift tiles to account for their own border

  const getTilePosition = (r: number, c: number) => {
    let x = c * (TILE_BASE_WIDTH / 2);
    // Odd rows are shifted to the right by half a tile width for tessellation
    if (r % 2 !== 0) { 
      x += TILE_BASE_WIDTH / 2; 
    }
    const y = r * TILE_HEIGHT;
    return {
      // Add offset for container border
      x: x + positionOffset,
      y: y + positionOffset
    };
  };

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMoveRef.current || activeDrag) return; 
    if (!gridDataRef.current[r]?.[c]) return; // Ensure tile exists before starting drag

    // Prevent default for mouse events to avoid text selection, etc.
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
      dragAxisLocked: null, // Axis will be determined on first significant move
      draggedLineCoords: null,
      visualOffset: 0,
    });
  }, [activeDrag]); // activeDrag is a dependency to prevent re-drag if one is in progress.

  useEffect(() => {
    const handleDragMove = (event: MouseEvent | TouchEvent) => {
      setActiveDrag(prevDrag => {
        if (!prevDrag) return null;

        // For touch events, prevent scrolling while dragging
        if (event.type === 'touchmove' && prevDrag.dragAxisLocked) {
          event.preventDefault();
        }

        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
        const deltaX = clientX - prevDrag.startScreenX;
        const deltaY = clientY - prevDrag.startScreenY;

        let currentDragAxis = prevDrag.dragAxisLocked;
        let currentLineCoords = prevDrag.draggedLineCoords;
        let currentVisualOffset = 0;

        if (!currentDragAxis) { // Try to lock axis if not already locked
          const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dragDistance > GAME_SETTINGS.DRAG_THRESHOLD) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI; // Angle in degrees
            
            // Determine axis based on drag angle
            if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) { // Horizontal (roughly)
              currentDragAxis = 'row';
              const rowPath: {r:number, c:number}[] = [];
              // Determine the actual number of tiles in this specific row (5 or 6)
              const numTilesInRowData = gridDataRef.current[prevDrag.startTileR]?.filter(tile => tile !== null).length || 0;
              for(let colIdx = 0; colIdx < numTilesInRowData; colIdx++) {
                  // Ensure we only add valid tile positions for this row
                  if(gridDataRef.current[prevDrag.startTileR]?.[colIdx]) {
                     rowPath.push({r: prevDrag.startTileR, c: colIdx});
                  }
              }
              currentLineCoords = rowPath;
            } 
            // Angle for 'diff' diagonal (roughly top-left to bottom-right if positive Y is down)
            // Visual slope is like '/' (tiles are r-c = k)
            else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) { 
              currentDragAxis = 'diff'; 
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'diff');
            } 
            // Angle for 'sum' diagonal (roughly top-right to bottom-left)
            // Visual slope is like '\' (tiles are r+c = k)
            else if ((angle >= 90 && angle <= 150) || (angle <= -30 && angle >= -90)) {
              currentDragAxis = 'sum';  
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'sum');
            }
          }
        }
        
        // Calculate visual offset based on locked axis
        if (currentDragAxis && currentLineCoords) {
          if (currentDragAxis === 'row') {
            currentVisualOffset = deltaX;
          } else { // Diagonal drag
            // Project deltaX, deltaY onto the diagonal's direction vector
            // 'sum' diagonal lines slope like '\' (angle around 120 or -60 degrees from positive x-axis)
            // 'diff' diagonal lines slope like '/' (angle around 60 or -120 degrees from positive x-axis)
            // For simplicity, approximate with dominant component or a more precise projection
            // Using a simplified projection:
            const angleRad = currentDragAxis === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3); // Approx angles for '\' and '/'
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
      setActiveDrag(currentActiveDragState => {
        if (!currentActiveDragState || !currentActiveDragState.dragAxisLocked || !currentActiveDragState.draggedLineCoords || currentActiveDragState.draggedLineCoords.length < 2) {
          return null; // No valid drag to process
        }
  
        const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = currentActiveDragState;
        // Use a dynamic threshold based on tile width, perhaps a bit less for diagonals
        const slideThreshold = TILE_BASE_WIDTH * 0.40; 
  
        if (Math.abs(visualOffset) > slideThreshold) {
          // Determine direction based on the sign of visualOffset
          const direction = visualOffset > 0 ?
            (dragAxisLocked === 'row' ? 'right' : 'forward') : // 'right' for row, 'forward' for diagonal
            (dragAxisLocked === 'row' ? 'left' : 'backward');   // 'left' for row, 'backward' for diagonal
  
          if (dragAxisLocked === 'row') {
            onSlideCommitRef.current('row', startTileR, direction as 'left' | 'right');
          } else if (dragAxisLocked === 'sum' || dragAxisLocked === 'diff') {
            // For diagonals, the identifier is one of the tiles on that diagonal.
            // The startTileR, startTileC that initiated the drag is sufficient to identify the diagonal.
            onSlideCommitRef.current(dragAxisLocked, { r: startTileR, c: startTileC }, direction as SlideDirection);
          }
        }
        return null; // Reset drag state
      });
    };

    if (activeDrag) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false }); // passive: false to allow preventDefault
      document.addEventListener('touchend', handleDragEnd);
      document.addEventListener('touchcancel', handleDragEnd); // Handle unexpected touch interruptions
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [activeDrag, TILE_BASE_WIDTH]); // TILE_BASE_WIDTH for threshold calculation

  return (
    <div
      className="relative bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none touch-none" 
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`,
        height: `${styledContainerHeight}px`,
        overflow: 'hidden', // Important to clip tiles that slide "off" the visible grid edges
      }}
      ref={gridRef}
    >
      {gridData.map((row, rIndex) =>
        row.map((tileData, cIndex) => {
          if (!tileData) return null; // Skip rendering for null tiles (empty spots in jagged rows)

          const { x, y } = getTilePosition(rIndex, cIndex);
          let transform = 'translate(0px, 0px)';
          let zIndex = 1; // Default z-index

          // Apply visual offset if this tile is part of the actively dragged line
          if (activeDrag && activeDrag.draggedLineCoords) {
            const isTileInDraggedLine = activeDrag.draggedLineCoords.some(coord => coord.r === rIndex && coord.c === cIndex);
            if (isTileInDraggedLine) {
              zIndex = 10; // Bring dragged tiles to front
              if (activeDrag.dragAxisLocked === 'row') {
                transform = `translateX(${activeDrag.visualOffset}px)`;
              } else if (activeDrag.dragAxisLocked === 'diff') { 
                // For 'diff' (like '/'), positive offset moves roughly down-right along the diagonal axis
                const angleRad = Math.PI / 3; // 60 degrees, visual slope of '/'
                const dx = activeDrag.visualOffset * Math.cos(angleRad);
                const dy = activeDrag.visualOffset * Math.sin(angleRad);
                transform = `translate(${dx}px, ${dy}px)`;
              } else if (activeDrag.dragAxisLocked === 'sum') { 
                // For 'sum' (like '\'), positive offset moves roughly down-left along the diagonal axis
                const angleRad = 2 * Math.PI / 3; // 120 degrees, visual slope of '\'
                const dx = activeDrag.visualOffset * Math.cos(angleRad);
                const dy = activeDrag.visualOffset * Math.sin(angleRad);
                transform = `translate(${dx}px, ${dy}px)`;
              }
            }
          }

          return (
            <div
              key={tileData.id} // Use tile's unique ID for React key
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${TILE_BASE_WIDTH}px`,
                height: `${TILE_HEIGHT}px`,
                transform: transform,
                transition: activeDrag ? 'none' : `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out`, // Animate slide-back, not drag
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

    
