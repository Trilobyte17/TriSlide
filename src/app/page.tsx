
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { 
  initializeGrid, 
  addInitialTiles, 
  slideRow, 
  slideLine, 
  getTilesOnDiagonal, 
  findAndMarkMatches,
  removeMatchedTiles,
  applyGravityAndSpawn,
  checkGameOver,
} from '@/lib/tripuzzle/engine';
import { GridDisplay } from '@/components/tripuzzle/GridDisplay';
import { GameControls } from '@/components/tripuzzle/GameControls';
import { GameOverDialog } from '@/components/tripuzzle/GameOverDialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const LOCAL_STORAGE_KEY = 'triSlideGameState_v8_diagDrag';

export default function TriSlidePage() {
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
    let loopCount = 0; 
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * 2; // Prevent infinite loops

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
        
        // Update state to show matches before removal
        setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

        const gridAfterRemoval = await removeMatchedTiles(gridWithMatchesMarked);
        setGameState(prev => ({ ...prev, grid: gridAfterRemoval, score, isLoading: false }));
        
        grid = await applyGravityAndSpawn(gridAfterRemoval);
        setGameState(prev => ({ ...prev, grid: grid, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION));

      } else {
        grid = gridWithMatchesMarked; // No matches, use the grid as is (orientations might have updated)
        break; // Exit loop if no matches were found in this iteration
      }
    } while (madeChangesInLoop);

    const gameOver = await checkGameOver(grid);
    if (gameOver && !gameState.isGameOver) { // Check !gameState.isGameOver to only toast once
       toast({ title: "Game Over!", description: `Final Score: ${score}`});
    }
    setIsProcessingMove(false);
    return { ...gameState, grid: grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
  }, [toast, gameState.isGameOver, gameState]); // Added gameState to dependencies

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true);
    const initialGridData = initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = addInitialTiles(initialGridData); 
    
    // Process initial matches (if any, due to random generation)
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);
    
    setGameState({
      ...finalInitialState,
      isGameStarted: true,
      isLoading: false,
    });

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Drag rows or diagonals to match 3+ colors." });
    setIsProcessingMove(false);
  }, [processMatchesAndGravity, toast]);
  
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        // Validate saved state structure
        if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
            savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES &&
            savedState.isGameStarted && !savedState.isGameOver) { // Added checks for isGameStarted and !isGameOver
           setGameState({...savedState, isLoading: true}); // Set loading true until restore confirmed
           setShowRestorePrompt(true); // Show prompt to user
        } else {
          // Invalid saved state, clear it and start new game
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
  }, []); // createNewGame is memoized, so this should be fine

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         // Re-validate, just in case
         if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
             savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES) {
            setGameState({...savedState, isLoading: false}); // Set state and turn off loading
            // It might be good to run checkGameOver here too, or even processMatchesAndGravity
            // For now, just restore and let user continue
            processMatchesAndGravity(savedState.grid, savedState.score).then(newState => {
              setGameState(ns => ({...ns, ...newState})); // Use functional update
            });
            toast({ title: "Game Restored", description: "Welcome back!" });
         } else {
           // Invalid saved state during restore attempt
           localStorage.removeItem(LOCAL_STORAGE_KEY);
           createNewGame(); 
         }
       } else { 
           // No saved state found (e.g., cleared by another tab)
           createNewGame();
       }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      createNewGame();
    }
  };

  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading && !isProcessingMove && !gameState.isGameOver) {
      // Ensure grid is valid before saving
      if (gameState.grid && gameState.grid.length > 0 && gameState.grid[0]?.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState, isProcessingMove]); // Add isProcessingMove


  const handleSlideCommit = useCallback(async (
    lineType: 'row' | DiagonalType, 
    identifier: number | { r: number, c: number }, 
    direction: SlideDirection | ('left' | 'right') // 'left'|'right' for rows, SlideDirection for diagonals
  ) => {
    if (isProcessingMove || gameState.isGameOver) return;
    
    setIsProcessingMove(true);
    // Reset isNew and isMatched flags on the current grid before slide
    const gridWithResets = gameState.grid.map(r_val => r_val.map(t => t ? {...t, isNew: false, isMatched: false } : null));
    setGameState(prev => ({ ...prev, grid: gridWithResets })); // Update state with reset flags

    let gridAfterSlide: GridData;

    if (lineType === 'row' && typeof identifier === 'number') {
      gridAfterSlide = slideRow(gridWithResets, identifier, direction as 'left' | 'right');
    } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
      const lineCoords = getTilesOnDiagonal(gridWithResets, identifier.r, identifier.c, lineType);
      if (lineCoords.length > 1) { // Ensure there's a line to slide
        gridAfterSlide = slideLine(gridWithResets, lineCoords, direction as SlideDirection);
      } else {
        gridAfterSlide = gridWithResets; // No valid diagonal line, no change
      }
    } else {
      gridAfterSlide = gridWithResets; // Should not happen, but as a fallback
    }
    
    setGameState(prev => ({ ...prev, grid: gridAfterSlide })); // Show slide animation
    await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

    const newState = await processMatchesAndGravity(gridAfterSlide, gameState.score);
    setGameState(ns => ({...ns, ...newState})); // Use functional update to merge
        
  }, [gameState.grid, gameState.score, gameState.isGameOver, processMatchesAndGravity, isProcessingMove]);

  if (gameState.isLoading && !showRestorePrompt) {
    return <div className="flex items-center justify-center min-h-screen text-xl">Loading TriSlide...</div>;
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
              isProcessingMove={isProcessingMove}
              onSlideCommit={handleSlideCommit}
            />
            {isProcessingMove && !gameState.isGameOver && ( // Only show if processing AND game not over
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
              <p>Drag rows or diagonals to match 3+ colors.</p>
              <p>Inspired by Trism. Built with Next.js & ShadCN UI.</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}

