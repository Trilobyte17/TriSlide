"use client";

import React, { useState, useRef } from 'react';
import type { GridData, Tile as TileType } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { Tile } from './Tile';
import { cn } from '@/lib/utils';

interface GridDisplayProps {
  gridData: GridData;
  onRowSlide: (rowIndex: number, direction: 'left' | 'right') => void;
}

export function GridDisplay({ gridData, onRowSlide }: GridDisplayProps) {
  const numRows = gridData.length;
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const TILE_BASE_WIDTH = GAME_SETTINGS.TILE_BASE_WIDTH;
  const TILE_HEIGHT = GAME_SETTINGS.TILE_HEIGHT;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  const handleRowDragStart = (e: React.DragEvent<HTMLDivElement>, rowIndex: number) => {
    setDraggedRowIndex(rowIndex);
    setDragStartX(e.clientX);
    const crt = e.currentTarget.cloneNode(true) as HTMLElement;
    crt.style.opacity = "0.5"; 
    document.body.appendChild(crt);
    e.dataTransfer.setDragImage(crt, 20, TILE_HEIGHT / 2); // Adjust drag image offset
    setTimeout(() => crt.remove(),0);
  };

  const handleRowDragEnd = (e: React.DragEvent<HTMLDivElement>, rowIndex: number) => {
    if (dragStartX === null || draggedRowIndex !== rowIndex) return;

    const dragEndX = e.clientX;
    const deltaX = dragEndX - dragStartX;
    const slideThreshold = TILE_BASE_WIDTH / 3; 

    if (Math.abs(deltaX) > slideThreshold) {
      const direction = deltaX > 0 ? 'right' : 'left';
      onRowSlide(rowIndex, direction);
    }

    setDraggedRowIndex(null);
    setDragStartX(null);
  };
  
  const handleRowDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div 
      className="flex flex-col items-center p-2 bg-secondary/30 rounded-lg shadow-inner" 
      role="grid" 
      aria-label="TriPuzzle game grid"
      style={{ width: `${numRows * TILE_BASE_WIDTH + (numRows > 1 ? (numRows-1)*4 : 0)}px`}} // Approximate width + spacing
    >
      {gridData.map((row, r) => (
        <div
          key={`row-${r}`}
          ref={el => rowRefs.current[r] = el}
          className="flex justify-center" // Removed space-x-1, using margin on cells
          style={{ 
             // Indent rows to form the triangular shape's left edge
             marginLeft: `${(numRows - (r + 1)) * (TILE_BASE_WIDTH / 2)}px`,
             // Negative margin to make triangles "nest" vertically if desired
             // marginTop: r > 0 ? `-${TILE_HEIGHT / 3}px` : '0px', // Example of nesting
             marginBottom: '2px', // Small gap between rows of triangles
          }}
          role="row"
          draggable={row.length > 1} 
          onDragStart={(e) => row.length > 1 && handleRowDragStart(e, r)}
          onDragEnd={(e) => row.length > 1 && handleRowDragEnd(e, r)}
          onDragOver={handleRowDragOver} 
        >
          {row.map((tile, c) => (
            <div
              key={tile ? tile.id : `empty-${r}-${c}`}
              className={cn(
                `w-[${TILE_BASE_WIDTH}px] h-[${TILE_HEIGHT}px] flex items-center justify-center mx-px`, // Cell container for triangle SVG
                !tile && "bg-muted/30 opacity-40" // Empty cell styling (no rounded-full for triangles)
              )}
              role="gridcell"
              aria-label={tile ? `Tile at row ${r+1} column ${c+1}` : `Empty cell at row ${r+1} column ${c+1}`}
            >
              {tile && (
                <Tile
                  tile={tile}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
