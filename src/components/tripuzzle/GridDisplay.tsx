
"use client";

import React, { useState, useRef } from 'react';
import type { GridData, Tile as TileType } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { cn } from '@/lib/utils';

interface GridDisplayProps {
  gridData: GridData;
  onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void;
  // Removed props related to individual tile drag/drop
  // onTileDragStart: (e: React.DragEvent<HTMLDivElement>, tile: TileType) => void;
  // onTileDrop: (e: React.DragEvent<HTMLDivElement>, targetTile: TileType) => void;
  // draggedTile: TileType | null;
}

export function GridDisplay({ gridData, onRowSlide }: GridDisplayProps) {
  const numRows = gridData.length;
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  const handleRowDragStart = (e: React.DragEvent<HTMLDivElement>, rowIndex: number) => {
    setDraggedRowIndex(rowIndex);
    setDragStartX(e.clientX);
    // Minimal drag image
    const crt = e.currentTarget.cloneNode(true) as HTMLElement;
    crt.style.opacity = "0.5"; 
    document.body.appendChild(crt);
    e.dataTransfer.setDragImage(crt, 20, 20);
    setTimeout(() => crt.remove(),0); // remove clone
  };

  const handleRowDragEnd = (e: React.DragEvent<HTMLDivElement>, rowIndex: number) => {
    if (dragStartX === null || draggedRowIndex !== rowIndex) return;

    const dragEndX = e.clientX;
    const deltaX = dragEndX - dragStartX;
    const slideThreshold = 30; // Minimum pixels to count as a slide

    if (Math.abs(deltaX) > slideThreshold) {
      const direction = deltaX > 0 ? 'right' : 'left';
      onRowSlide(rowIndex, direction);
    }

    setDraggedRowIndex(null);
    setDragStartX(null);
  };
  
  // Dragging over a row is needed to allow drop (even if drop does nothing here, it completes drag)
  const handleRowDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };


  return (
    <div 
      className="flex flex-col items-center space-y-1 p-4 bg-secondary/50 rounded-lg shadow-inner" 
      role="grid" 
      aria-label="TriPuzzle game grid"
    >
      {gridData.map((row, r) => (
        <div
          key={`row-${r}`}
          ref={el => rowRefs.current[r] = el}
          className="flex justify-center space-x-1 cursor-grab"
          style={{ 
            // Approximate centering logic - might need adjustment
            // paddingLeft: `${(numRows - 1 - r) * ( ( (16*4) + 4) / 2 / numRows / 2)}px` // Adjusted for new tile size assumption for centering
             marginLeft: `${(numRows - 1 - r) * 20}px`, // Simpler centering for demo
             marginRight: `${(numRows - 1 - r) * 20}px`,
          }}
          role="row"
          draggable={row.length > 1} // Rows with 1 or 0 tiles cannot be slid
          onDragStart={(e) => row.length > 1 && handleRowDragStart(e, r)}
          onDragEnd={(e) => row.length > 1 && handleRowDragEnd(e, r)}
          onDragOver={handleRowDragOver} // Required for dragEnd to fire correctly
        >
          {row.map((tile, c) => (
            <div
              key={tile ? tile.id : `empty-${r}-${c}`}
              className={cn(
                "w-16 h-16 md:w-20 md:h-20 flex items-center justify-center m-0.5", // Cell container
                !tile && "bg-muted/50 rounded-full opacity-50" // Empty cell styling
              )}
              // onDragOver={handleDragOver} // Moved to row
              // onDrop={(e) => tile && onTileDrop(e, tile)} // Removed
              role="gridcell"
              aria-label={tile ? `Tile at row ${r+1} column ${c+1}` : `Empty cell at row ${r+1} column ${c+1}`}
            >
              {tile && (
                <Tile
                  tile={tile}
                  // Removed props: onDragStart, isPotentialTarget
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
