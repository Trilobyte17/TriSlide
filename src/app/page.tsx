
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, Tile as TileType, GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { initializeGrid, addInitialTiles, performMerge, checkGameOver, applyGravityAndSpawn } from '@/lib/tripuzzle/engine';
import { GridDisplay } from '@/components/tripuzzle/GridDisplay';
import { GameControls } from '@/components/tripuzzle/GameControls';
import { GameOverDialog } from '@/components/tripuzzle/GameOverDialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button'; // For restore prompt

const LOCAL_STORAGE_KEY = 'triPuzzleGameState_v1';

export default function TriPuzzlePage() {
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameState>({
    grid: initializeGrid(GAME_SETTINGS.NUM_ROWS),
    score: 0,
    isGameOver: false,
    isGameStarted: false,
    isLoading: true,
  });
  const [draggedTile, setDraggedTile] = useState<TileType | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const createNewGame = useCallback(() => {
    const initialGrid = initializeGrid(GAME_SETTINGS.NUM_ROWS);
    const gridWithTiles = addInitialTiles(initialGrid, GAME_SETTINGS.INITIAL_TILES_COUNT);
    setGameState({
      grid: gridWithTiles,
      score: 0,
      isGameOver: false,
      isGameStarted: true,
      isLoading: false,
    });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Good luck!" });
  }, [toast]);
  
  // Load game from localStorage
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        if (savedState.isGameStarted && !savedState.isGameOver) {
           // Keep isLoading true until user makes a choice on the prompt
           setGameState({...savedState, isLoading: true}); 
           setShowRestorePrompt(true); 
        } else {
          createNewGame(); 
        }
      } catch (error) {
        console.error("Failed to parse saved game state:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        createNewGame();
      }
    } else {
      createNewGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         setGameState({...savedState, isLoading: false}); // Now set isLoading to false
         toast({ title: "Game Restored", description: "Welcome back!" });
       }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      createNewGame(); // This already sets isLoading to false
    }
  };

  // Save game to localStorage
  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading) { // Only save if not loading
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, tile: TileType) => {
    setDraggedTile(tile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetTile: TileType) => {
    e.preventDefault();
    if (!draggedTile || draggedTile.id === targetTile.id || targetTile.value === 0) {
      setDraggedTile(null);
      return;
    }

    if (draggedTile.value !== targetTile.value) {
      toast({ title: "Invalid Move", description: "Tiles must have the same value to merge.", variant: "destructive" });
      setDraggedTile(null);
      return;
    }
    
    let tempGrid = gameState.grid.map(row => row.map(t => {
      if (t && t.id === draggedTile.id) return {...t, isVanishing: true};
      return t;
    }));
    setGameState(prev => ({...prev, grid: tempGrid}));

    await new Promise(resolve => setTimeout(resolve, 50));

    const { newGrid: gridAfterMerge, scoreBonus, merged } = performMerge(gameState.grid, draggedTile, targetTile);

    if (merged) {
      const gridWithMergingMarker = gridAfterMerge.map(row => row.map(t => {
        if (t && t.id === targetTile.id) return {...t, isMerging: true};
        return t;
      }));
      setGameState(prev => ({ ...prev, grid: gridWithMergingMarker, score: prev.score + scoreBonus }));
      
      setTimeout(() => {
        const gridAfterGravity = applyGravityAndSpawn(gridAfterMerge); 
        
        const gameOver = checkGameOver(gridAfterGravity);
        setGameState(prev => ({
          ...prev,
          grid: gridAfterGravity,
          isGameOver: gameOver,
        }));

        if (gameOver) {
          toast({ title: "Game Over!", description: `Final Score: ${gameState.score + scoreBonus}`});
        }
      }, 300); 

    } else {
       tempGrid = gameState.grid.map(row => row.map(t => {
        if (t && t.id === draggedTile.id) return {...t, isVanishing: false};
        return t;
      }));
      setGameState(prev => ({...prev, grid: tempGrid}));
    }
    setDraggedTile(null);
  };
  
  if (gameState.isLoading && !showRestorePrompt) { // Initial loading screen
    return <div className="flex items-center justify-center min-h-screen text-xl">Loading TriPuzzle...</div>;
  }

  return (
    <>
      <style jsx global>{`
        @keyframes tile-spawn {
          0% { transform: scale(0.5) translateY(-20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-tile-spawn { animation: tile-spawn 0.3s ease-out forwards; }

        @keyframes tile-merge {
          0% { transform: scale(1); }
          50% { transform: scale(1.25) rotate(5deg); box-shadow: 0 0 15px hsl(var(--tile-potential-merge-glow));}
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-tile-merge { animation: tile-merge 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards; }
        
        @keyframes tile-vanish {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(0.3) rotate(15deg); opacity: 0; }
        }
        .animate-tile-vanish { animation: tile-vanish 0.25s ease-in forwards; }
      `}</style>
      <main className="flex flex-col items-center justify-start min-h-screen p-4 md:p-8 pt-6 md:pt-12 bg-background">
        {showRestorePrompt && ( // This will show on top of "Loading..." if isLoading is still true
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card p-6 rounded-lg shadow-xl text-center">
              <h3 className="text-lg font-semibold mb-2">Restore Game?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We found a saved game. Would you like to continue?
              </p>
              <div className="flex justify-center space-x-3">
                <Button onClick={() => handleRestoreGame(true)} variant="default">Yes, Restore</Button>
                <Button onClick={() => handleRestoreGame(false)} variant="outline">No, Start New</Button>
              </div>
            </div>
          </div>
        )}

        {!gameState.isLoading && !showRestorePrompt && ( // Only render game UI if not loading and no prompt
          <>
            <GameControls
              score={gameState.score}
              isGameStarted={gameState.isGameStarted}
              onRestart={createNewGame} 
              onNewGame={createNewGame}
            />
            <GridDisplay
              gridData={gameState.grid}
              onTileDragStart={handleDragStart}
              onTileDrop={handleDrop}
              draggedTile={draggedTile}
            />
            <GameOverDialog
              isOpen={gameState.isGameOver}
              score={gameState.score}
              onNewGame={createNewGame}
            />
            <footer className="mt-8 text-center text-sm text-muted-foreground">
              <p>Drag tiles with the same number to combine them. Special rules for 1s and {GAME_SETTINGS.MAX_TILE_VALUE}s!</p>
              <p>Inspired by Trism. Built with Next.js & ShadCN UI.</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}

    