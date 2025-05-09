
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { 
  initializeGrid, 
  addInitialTiles, 
  // slideRow, // Temporarily disable
  findAndMarkMatches,
  removeMatchedTiles,
  applyGravityAndSpawn,
  checkGameOver 
} from '@/lib/tripuzzle/engine';
import { GridDisplay } from '@/components/tripuzzle/GridDisplay';
import { GameControls } from '@/components/tripuzzle/GameControls';
import { GameOverDialog } from '@/components/tripuzzle/GameOverDialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const LOCAL_STORAGE_KEY = 'triPuzzleGameState_colorMatch_v3_tessellated_rect'; // New key for new game type

export default function TriPuzzlePage() {
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameState>({
    grid: initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES), // Use new dimensions
    score: 0,
    isGameOver: false,
    isGameStarted: false,
    isLoading: true,
  });
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);


  const createNewGame = useCallback(() => {
    setIsProcessingMove(true);
    // Initialize with new dimensions
    const initialGrid = initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithTiles = addInitialTiles(initialGrid); 
    
    let currentGrid = gridWithTiles;
    // Initial match check can be simplified or adjusted if engine's match finding is placeholder
    const { newGrid: gridAfterInitialMatchCheck, hasMatches: initialHasMatches } = findAndMarkMatches(currentGrid);
    if (initialHasMatches) {
      const gridWithoutMatched = removeMatchedTiles(gridAfterInitialMatchCheck);
      currentGrid = applyGravityAndSpawn(gridWithoutMatched); // Gravity logic also needs update for tessellation
    }

    setGameState({
      grid: currentGrid,
      score: 0,
      isGameOver: checkGameOver(currentGrid), // Game over logic needs update
      isGameStarted: true,
      isLoading: false,
    });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Match 3+ colors on the new grid!" });
    setIsProcessingMove(false);
  }, [toast]);
  
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        // Basic validation for grid structure mismatch if settings change drastically
        if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
            savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES &&
            savedState.isGameStarted && !savedState.isGameOver) {
           setGameState({...savedState, isLoading: true}); 
           setShowRestorePrompt(true); 
        } else {
          console.warn("Saved game state has incompatible grid dimensions or is invalid. Starting new game.");
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
          // Additional validation before restoring might be needed
         setGameState({...savedState, isLoading: false});
         toast({ title: "Game Restored", description: "Welcome back!" });
       }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      createNewGame();
    }
  };

  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading && !isProcessingMove) {
      // Basic check to ensure grid isn't empty before saving
      if (gameState.grid && gameState.grid.length > 0 && gameState.grid[0].length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState, isProcessingMove]);

  const processMatchesAndGravity = useCallback(async (currentGrid: GridData, initialScore: number): Promise<GameState> => {
    let score = initialScore;
    let grid = currentGrid;
    let madeChangesInLoop;

    do {
      madeChangesInLoop = false;
      const { newGrid: gridWithMatchesMarked, hasMatches, matchCount } = findAndMarkMatches(grid);
      
      if (hasMatches) {
        madeChangesInLoop = true;
        score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;
        
        setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

        const gridAfterRemoval = removeMatchedTiles(gridWithMatchesMarked);
        setGameState(prev => ({ ...prev, grid: gridAfterRemoval, score }));

        grid = applyGravityAndSpawn(gridAfterRemoval);
        setGameState(prev => ({ ...prev, grid, score }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION));

      } else {
        break;
      }
    } while (madeChangesInLoop);

    const gameOver = checkGameOver(grid);
    if (gameOver && !gameState.isGameOver) { // Check previous gameState.isGameOver
       toast({ title: "Game Over!", description: `Final Score: ${score}`});
    }
    // Ensure gameState being returned here is the latest version from setGameState calls within the loop
    // or rather, construct it from the final `grid`, `score`, `gameOver`
    return { ...gameState, grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
  }, [gameState, toast]); // Rely on gameState to carry over properties like isGameStarted, isLoading

  // const handleRowSlide = useCallback(async (rowIndex: number, direction: 'left' | 'right') => {
  //   if (isProcessingMove || gameState.isGameOver) return;
  //   setIsProcessingMove(true);

  //   const gridAfterSlide = slideRow(gameState.grid, rowIndex, direction); // slideRow needs update for new grid
  //   setGameState(prev => ({ ...prev, grid: gridAfterSlide }));
  //   await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

  //   const newState = await processMatchesAndGravity(gridAfterSlide, gameState.score);
  //   setGameState(newState);
    
  //   setIsProcessingMove(false);
  // }, [gameState.grid, gameState.score, gameState.isGameOver, processMatchesAndGravity, isProcessingMove]);


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
              // onRowSlide={handleRowSlide} // Temporarily disabled
            />
            {isProcessingMove && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/30 z-40">
                <p className="text-lg font-semibold p-4 bg-card rounded-md shadow-lg">Processing...</p>
              </div>
            )}
            <GameOverDialog
              isOpen={gameState.isGameOver}
              score={gameState.score}
              onNewGame={createNewGame}
            />
            <footer className="mt-8 text-center text-sm text-muted-foreground">
              <p>Match 3 or more tiles of the same color. Sliding mechanics coming soon!</p>
              <p>Inspired by Trism. Built with Next.js & ShadCN UI.</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
