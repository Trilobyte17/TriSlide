
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { 
  initializeGrid, 
  addInitialTiles, 
  slideRow, // Kept for game logic, UI interaction will change
  findAndMarkMatches,
  removeMatchedTiles,
  applyGravityAndSpawn,
  checkGameOver,
  swapTiles, // Kept for checkGameOver
  getNeighbors, // Kept for checkGameOver
  rotateTriad,  // Kept for checkGameOver
} from '@/lib/tripuzzle/engine';
import { GridDisplay } from '@/components/tripuzzle/GridDisplay';
import { GameControls } from '@/components/tripuzzle/GameControls';
import { GameOverDialog } from '@/components/tripuzzle/GameOverDialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const LOCAL_STORAGE_KEY = 'triPuzzleGameState_colorMatch_v6_noClickSelect';

export default function TriPuzzlePage() {
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameState>({
    grid: initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES),
    score: 0,
    isGameOver: false,
    isGameStarted: false,
    isLoading: true,
  });
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  // const [selectedTileCoords, setSelectedTileCoords] = useState<{ r: number; c: number } | null>(null); // Removed

  // updateGridWithSelection is removed as isSelected is removed from Tile type

  const processMatchesAndGravity = useCallback(async (currentGrid: GridData, initialScore: number): Promise<GameState> => {
    setIsProcessingMove(true);
    let score = initialScore;
    let grid = currentGrid;
    let madeChangesInLoop;
    let loopCount = 0; 
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * 2; 

    do {
      madeChangesInLoop = false;
      loopCount++;
      if (loopCount > maxLoops) {
        console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
        toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"});
        break;
      }

      const { newGrid: gridWithMatchesMarked, hasMatches, matchCount } = findAndMarkMatches(grid);
      
      if (hasMatches) {
        madeChangesInLoop = true;
        score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;
        
        setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

        const gridAfterRemoval = removeMatchedTiles(gridWithMatchesMarked);
        setGameState(prev => ({ ...prev, grid: gridAfterRemoval, score, isLoading: false }));
        
        grid = applyGravityAndSpawn(gridAfterRemoval);
        setGameState(prev => ({ ...prev, grid: grid, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION));

      } else {
        grid = gridWithMatchesMarked; 
        break; 
      }
    } while (madeChangesInLoop);

    const gameOver = checkGameOver(grid);
    if (gameOver && !gameState.isGameOver) { 
       toast({ title: "Game Over!", description: `Final Score: ${score}`});
    }
    setIsProcessingMove(false);
    return { ...gameState, grid: grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
  }, [toast, gameState.isGameOver]); // Removed updateGridWithSelection from dependencies

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true);
    // setSelectedTileCoords(null); // Removed
    const initialGridData = initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = addInitialTiles(initialGridData); 
    
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);
    
    setGameState({
      ...finalInitialState,
      grid: finalInitialState.grid, // Simplified
      isGameStarted: true,
      isLoading: false,
    });

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Match 3+ colors. Drag functionality coming soon!" });
    setIsProcessingMove(false);
  }, [processMatchesAndGravity, toast]); // Removed updateGridWithSelection
  
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
            savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES &&
            savedState.isGameStarted && !savedState.isGameOver) {
           setGameState({...savedState, grid: savedState.grid, isLoading: true}); // Simplified
           setShowRestorePrompt(true); 
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
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
         if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
             savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES) {
            setGameState({...savedState, grid: savedState.grid, isLoading: false}); // Simplified
            processMatchesAndGravity(savedState.grid, savedState.score).then(newState => {
              setGameState(ns => ({...ns, ...newState, grid: newState.grid})); // Simplified
            });
            toast({ title: "Game Restored", description: "Welcome back!" });
         } else {
           localStorage.removeItem(LOCAL_STORAGE_KEY);
           createNewGame(); 
         }
       } else { 
           createNewGame();
       }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      createNewGame();
    }
  };

  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading && !isProcessingMove && !gameState.isGameOver) {
      if (gameState.grid && gameState.grid.length > 0 && gameState.grid[0]?.length > 0) {
        // isSelected property is removed from Tile, so no need to map and remove it
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState, isProcessingMove]); 


  // handleRowSlide is kept for game logic, but UI trigger (buttons) are removed from GridDisplay
  // It might be adapted for drag-and-drop later.
  const handleRowSlide = useCallback(async (rowIndex: number, direction: 'left' | 'right') => {
    if (isProcessingMove || gameState.isGameOver) return;
    
    setIsProcessingMove(true);
    // setSelectedTileCoords(null); // Removed
    // Reset isNew/isMatched on tiles before slide
    const gridWithResets = gameState.grid.map(r_val => r_val.map(t => t ? {...t, isNew: false, isMatched: false } : null));
    setGameState(prev => ({ ...prev, grid: gridWithResets }));

    const gridAfterSlide = slideRow(gridWithResets, rowIndex, direction); // Pass the grid with resets
    setGameState(prev => ({ ...prev, grid: gridAfterSlide })); 
    await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

    const newState = await processMatchesAndGravity(gridAfterSlide, gameState.score);
    setGameState(ns => ({...ns, ...newState})); 
        
  }, [gameState.grid, gameState.score, gameState.isGameOver, processMatchesAndGravity, isProcessingMove]); // Removed updateGridWithSelection

  // handleTileClick function is completely removed as click-to-select is removed.
  // The logic for swapTiles and rotateTriad was here. These actions are no longer user-triggerable via click.

  if (gameState.isLoading && !showRestorePrompt) {
    return <div className="flex items-center justify-center min-h-screen text-xl">Loading TriPuzzle...</div>;
  }

  return (
    <>
      <style jsx global>{`
        @keyframes tile-spawn {
          0% { transform: scale(0.5) translateY(-10px) rotate(15deg); opacity: 0; }
          100% { transform: scale(1) translateY(0) rotate(0deg); opacity: 1; }
        }
        .animate-tile-spawn { animation: tile-spawn ${GAME_SETTINGS.SPAWN_ANIMATION_DURATION}ms ease-out forwards; }

        @keyframes tile-vanish { 
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1) rotate(-5deg); opacity: 0.5; filter: brightness(1.5); }
          100% { transform: scale(0.3) rotate(10deg); opacity: 0; }
        }
        .animate-tile-vanish { animation: tile-vanish ${GAME_SETTINGS.MATCH_ANIMATION_DURATION}ms ease-in forwards; }
      `}</style>
      <main className="flex flex-col items-center justify-start min-h-screen p-4 md:p-8 pt-6 md:pt-12 bg-background">
        {showRestorePrompt && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card p-6 rounded-lg shadow-xl text-center">
              <h3 className="text-lg font-semibold mb-2">Restore Game?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Found a saved game. Continue where you left off?
              </p>
              <div className="flex justify-center space-x-3">
                <Button onClick={() => handleRestoreGame(true)} variant="default">Yes, Restore</Button>
                <Button onClick={() => handleRestoreGame(false)} variant="outline">No, Start New</Button>
              </div>
            </div>
          </div>
        )}

        {!gameState.isLoading && !showRestorePrompt && gameState.grid.length > 0 && (
          <>
            <GameControls
              score={gameState.score}
              isGameStarted={gameState.isGameStarted}
              onRestart={createNewGame} 
              onNewGame={createNewGame}
            />
            <GridDisplay
              gridData={gameState.grid}
              // onRowSlide={handleRowSlide} // Row slide buttons are removed from GridDisplay, interaction will be drag
              isProcessingMove={isProcessingMove}
              // onTileClick={handleTileClick} // Removed
              // selectedTileCoords={selectedTileCoords} // Removed
            />
            {isProcessingMove && !gameState.isGameOver && ( 
              <div className="fixed inset-0 flex items-center justify-center bg-background/10 z-40 backdrop-blur-sm">
                <p className="text-lg font-semibold p-4 bg-card rounded-md shadow-lg animate-pulse">Processing...</p>
              </div>
            )}
            <GameOverDialog
              isOpen={gameState.isGameOver}
              score={gameState.score}
              onNewGame={createNewGame}
            />
            <footer className="mt-8 text-center text-sm text-muted-foreground">
              <p>Drag rows to match 3+ colors. (Drag functionality coming soon!)</p>
              <p>Inspired by Trism. Built with Next.js & ShadCN UI.</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
