
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
    identifier: number | { r: number, c: number }, // rowIndex for 'row', {r,c} of a tile on diagonal for 'sum'/'diff'
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
  visualOffset: number; // For row: deltaX; For diagonal: projected delta along diagonal axis
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
  const maxTilesInRow = GAME_SETTINGS.GRID_WIDTH_TILES; // e.g., 6 for widest rows

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Refs for functions/state to avoid stale closures in event listeners
  const onSlideCommitRef = useRef(onSlideCommit);
  useEffect(() => { onSlideCommitRef.current = onSlideCommit; }, [onSlideCommit]);
  const isProcessingMoveRef = useRef(isProcessingMove);
  useEffect(() => { isProcessingMoveRef.current = isProcessingMove; }, [isProcessingMove]);
  const gridDataRef = useRef(gridData);
  useEffect(() => { gridDataRef.current = gridData; }, [gridData]);


  // Calculate the geometric width and height of the grid content
  // For a Trism-like grid with max N tiles (e.g., 6), and rows alternating N, N-1:
  // The effective width is (N/2 + (N-1)/2) / 2 * TILE_BASE_WIDTH if we average? No.
  // It's (maxTilesInRow + 1) * TILE_BASE_WIDTH / 2.
  // e.g. for 6 tiles in a row, it spans 0.5 + 5*0.5 + 0.5 = 3.5 tile widths if perfectly centered.
  // Or, (6 tiles * 0.5 width_step) + 0.5 initial_offset = 3.5 widths
  const mathGridWidth = (maxTilesInRow + 1) * TILE_BASE_WIDTH / 2;
  const mathGridHeight = numGridRows * TILE_HEIGHT;

  // Container size includes borders on both sides
  const styledContainerWidth = mathGridWidth + TILE_BORDER_WIDTH;
  const styledContainerHeight = mathGridHeight + TILE_BORDER_WIDTH;

  // Offset for tile positioning to account for half the border width
  const positionOffset = TILE_BORDER_WIDTH / 2;


  const getTilePosition = (r: number, c: number) => {
    let x = c * (TILE_BASE_WIDTH / 2);
    // Odd rows are shifted horizontally by half a tile width for tessellation
    if (r % 2 !== 0) { 
      x += TILE_BASE_WIDTH / 2;
    }
    const y = r * TILE_HEIGHT;
    return {
      // Add positionOffset to account for the container's border effect
      x: x + positionOffset,
      y: y + positionOffset
    };
  };

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, r: number, c: number) => {
    if (isProcessingMoveRef.current || activeDrag) return; // Prevent new drag if one is active or processing
    if (!gridDataRef.current[r]?.[c]) return; // Ensure tile exists

    // Prevent default for mouse down to avoid text selection, etc.
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
      dragAxisLocked: null, // Axis not locked yet
      draggedLineCoords: null,
      visualOffset: 0,
    });
  }, [activeDrag]); // Dependency on activeDrag to prevent re-creating if already dragging

  useEffect(() => {
    const handleDragMove = (event: MouseEvent | TouchEvent) => {
      // Use a functional update for setActiveDrag to ensure we have the latest state
      setActiveDrag(prevDrag => {
        if (!prevDrag) return null;

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
            // Horizontal: -30 to 30 deg and 150 to 180 deg (-180 to -150)
            if ((angle >= -30 && angle <= 30) || angle >= 150 || angle <= -150) {
              currentDragAxis = 'row';
              const rowPath: {r:number, c:number}[] = [];
              // Get all tiles in the current row
              const numTilesInRowData = gridDataRef.current[prevDrag.startTileR]?.filter(tile => tile !== null).length || 0;
              for(let colIdx = 0; colIdx < numTilesInRowData; colIdx++) {
                  // Only add if tile actually exists at this visual column index
                  if(gridDataRef.current[prevDrag.startTileR]?.[colIdx]) {
                     rowPath.push({r: prevDrag.startTileR, c: colIdx});
                  }
              }
              currentLineCoords = rowPath;

            } 
            // Sum diagonal ('/'): approx 90 to 150 deg and -30 to -90 deg
            // More precisely, sum diagonals are roughly 120 or -60 degrees
            else if ((angle > 30 && angle < 90) || (angle < -90 && angle > -150)) { // Favor 'diff' if ambiguous close to vertical
              currentDragAxis = 'diff'; // Corresponds to r-c=k (roughly 60 or -120 deg from positive x-axis)
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'diff');
            } else if ((angle >= 90 && angle <= 150) || (angle <= -30 && angle >= -90)) {
              currentDragAxis = 'sum';  // Corresponds to r+c=k (roughly 120 or -60 deg from positive x-axis)
              currentLineCoords = getTilesOnDiagonalEngine(gridDataRef.current, prevDrag.startTileR, prevDrag.startTileC, 'sum');
            }
          }
        }
        
        // If axis is locked, calculate visual offset
        if (currentDragAxis && currentLineCoords) {
          if (currentDragAxis === 'row') {
            currentVisualOffset = deltaX;
          } else { // For diagonals
            // Project the (deltaX, deltaY) vector onto the diagonal's direction vector
            // 'sum' diagonal (r+c=k) slope is -1 (angle 135 or -45). Normalized vector: (-1/sqrt(2), 1/sqrt(2)) or (1/sqrt(2), -1/sqrt(2))
            // 'diff' diagonal (r-c=k) slope is 1 (angle 45 or -135). Normalized vector: (1/sqrt(2), 1/sqrt(2)) or (-1/sqrt(2), -1/sqrt(2))
            // For simplicity, use approximate angles of grid lines.
            // diff ('\') lines are approx. 60 deg from horizontal.
            // sum ('/') lines are approx. 120 deg from horizontal.
            const angleRad = currentDragAxis === 'sum' ? (2 * Math.PI / 3) : (Math.PI / 3); // 120 deg for sum, 60 deg for diff
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
      // Use a callback for setActiveDrag to get the latest state value for processing
      setActiveDrag(currentActiveDragState => {
        if (!currentActiveDragState || !currentActiveDragState.dragAxisLocked || !currentActiveDragState.draggedLineCoords || currentActiveDragState.draggedLineCoords.length < 2) {
          return null; // No valid drag to process, reset state
        }
  
        const { dragAxisLocked, startTileR, startTileC, visualOffset, draggedLineCoords } = currentActiveDragState;
        // Use a fraction of tile width as threshold
        const slideThreshold = TILE_BASE_WIDTH * 0.40; // 40% of tile width
  
        if (Math.abs(visualOffset) > slideThreshold) {
          const direction = visualOffset > 0 ?
            (dragAxisLocked === 'row' ? 'right' : 'forward') :
            (dragAxisLocked === 'row' ? 'left' : 'backward');
  
          if (dragAxisLocked === 'row') {
            onSlideCommitRef.current('row', startTileR, direction as 'left' | 'right');
          } else if (dragAxisLocked === 'sum' || dragAxisLocked === 'diff') {
            // For diagonals, identifier is one of the tiles on the diagonal
            onSlideCommitRef.current(dragAxisLocked, { r: startTileR, c: startTileC }, direction as SlideDirection);
          }
        }
        return null; // Reset activeDrag state after processing
      });
    };

    if (activeDrag) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false }); // passive: false to allow preventDefault if needed
      document.addEventListener('touchend', handleDragEnd);
      document.addEventListener('touchcancel', handleDragEnd); // Handle cancelled touches
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [activeDrag, TILE_BASE_WIDTH]); // Rerun if activeDrag changes

  return (
    <div
      className="relative bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-inner select-none touch-none" // Ensure touch-none
      role="grid"
      aria-label="TriSlide game grid"
      style={{
        width: `${styledContainerWidth}px`,
        height: `${styledContainerHeight}px`,
        overflow: 'hidden', // Important: clips tiles during "infinite" slide
      }}
      ref={gridRef}
    >
      {gridData.map((row, rIndex) =>
        row.map((tileData, cIndex) => {
          if (!tileData) return null; // Skip rendering for null tiles (empty spots)

          const { x, y } = getTilePosition(rIndex, cIndex);
          let transform = 'translate(0px, 0px)';
          let zIndex = 1; // Default z-index

          if (activeDrag && activeDrag.draggedLineCoords) {
            const isTileInDraggedLine = activeDrag.draggedLineCoords.some(coord => coord.r === rIndex && coord.c === cIndex);
            if (isTileInDraggedLine) {
              zIndex = 10; // Elevate dragged tiles
              if (activeDrag.dragAxisLocked === 'row') {
                transform = `translateX(${activeDrag.visualOffset}px)`;
              } else if (activeDrag.dragAxisLocked === 'diff') { // '\' diagonal, approx 60 deg
                const angleRad = Math.PI / 3; // 60 degrees
                const dx = activeDrag.visualOffset * Math.cos(angleRad);
                const dy = activeDrag.visualOffset * Math.sin(angleRad);
                transform = `translate(${dx}px, ${dy}px)`;
              } else if (activeDrag.dragAxisLocked === 'sum') { // '/' diagonal, approx 120 deg
                const angleRad = 2 * Math.PI / 3; // 120 degrees
                const dx = activeDrag.visualOffset * Math.cos(angleRad);
                const dy = activeDrag.visualOffset * Math.sin(angleRad);
                transform = `translate(${dx}px, ${dy}px)`;
              }
            }
          }

          return (
            <div
              key={tileData.id} // Use tile's unique ID as key
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${TILE_BASE_WIDTH}px`,
                height: `${TILE_HEIGHT}px`,
                transform: transform,
                transition: activeDrag ? 'none' : `transform ${GAME_SETTINGS.SLIDE_ANIMATION_DURATION}ms ease-out`, // Animate slide back if not committed
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
