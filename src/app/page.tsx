
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { 
  initializeGrid, 
  addInitialTiles, 
  slideRow, 
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

const LOCAL_STORAGE_KEY = 'triPuzzleGameState_colorMatch_v4_slide';

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

  const processMatchesAndGravity = useCallback(async (currentGrid: GridData, initialScore: number): Promise<GameState> => {
    setIsProcessingMove(true);
    let score = initialScore;
    let grid = currentGrid;
    let madeChangesInLoop;
    let loopCount = 0; // Safety break for infinite loops
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * 2; // Max loops related to grid height

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
        
        // Update state to show matches before removing
        setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

        const gridAfterRemoval = removeMatchedTiles(gridWithMatchesMarked);
         // Update state to show removed tiles (empty spaces)
        setGameState(prev => ({ ...prev, grid: gridAfterRemoval, score }));
        // No delay here, gravity should apply immediately after removal visually

        grid = applyGravityAndSpawn(gridAfterRemoval);
        // Update state to show tiles after gravity and spawn
        setGameState(prev => ({ ...prev, grid, score }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION));

      } else {
        break; // No matches found, exit loop
      }
    } while (madeChangesInLoop);

    const gameOver = checkGameOver(grid);
    if (gameOver && !gameState.isGameOver) { 
       toast({ title: "Game Over!", description: `Final Score: ${score}`});
    }
    setIsProcessingMove(false);
    return { ...gameState, grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
  }, [toast, gameState.isGameOver]); // gameState.isGameOver to prevent multiple game over toasts

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true);
    const initialGridData = initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = addInitialTiles(initialGridData); 
    
    // Process initial automatic matches
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);
    
    setGameState({
      ...finalInitialState,
      isGameStarted: true,
      isLoading: false,
    });

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Slide rows to match 3+ colors!" });
    setIsProcessingMove(false);
  }, [processMatchesAndGravity, toast]);
  
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
            savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES &&
            savedState.isGameStarted && !savedState.isGameOver) {
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
  }, []); // createNewGame is memoized

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         setGameState({...savedState, isLoading: false});
         // After restoring, re-check for matches/gravity in case game was saved mid-cascade
         // or if game over conditions were met but not processed.
         processMatchesAndGravity(savedState.grid, savedState.score).then(newState => {
           setGameState(newState);
         });
         toast({ title: "Game Restored", description: "Welcome back!" });
       }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      createNewGame();
    }
  };

  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading && !isProcessingMove && !gameState.isGameOver) {
      if (gameState.grid && gameState.grid.length > 0 && gameState.grid[0]?.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState]);


  const handleRowSlide = useCallback(async (rowIndex: number, direction: 'left' | 'right') => {
    if (isProcessingMove || gameState.isGameOver) return;
    
    setIsProcessingMove(true);
    setGameState(prev => ({ ...prev, grid: prev.grid.map(r => r.map(t => t ? {...t, isNew: false, isMatched: false } : null)) }));


    const gridAfterSlide = slideRow(gameState.grid, rowIndex, direction);
    setGameState(prev => ({ ...prev, grid: gridAfterSlide })); // Show slide animation
    await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

    const newState = await processMatchesAndGravity(gridAfterSlide, gameState.score);
    setGameState(newState);
    
    // setIsProcessingMove already handled by processMatchesAndGravity
  }, [gameState.grid, gameState.score, gameState.isGameOver, processMatchesAndGravity, isProcessingMove]);


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
              onRowSlide={handleRowSlide}
              isProcessingMove={isProcessingMove}
            />
            {isProcessingMove && (
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
              <p>Slide rows to match 3 or more tiles of the same color.</p>
              <p>Inspired by Trism. Built with Next.js & ShadCN UI.</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
