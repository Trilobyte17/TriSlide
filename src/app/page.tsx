
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { 
  initializeGrid, 
  addInitialTiles, 
  slideRow, 
  slideLine, // Keep if directly used, though likely not
  getTilesOnDiagonal, // Keep for handleSlideCommit
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
    grid: [], 
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

    try {
      do {
        madeChangesInLoop = false;
        loopCount++;
        if (loopCount > maxLoops) {
          console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
          toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"});
          break;
        }

        const { newGrid: gridWithMatchesMarked, hasMatches: currentPassHasMatches, matchCount } = await findAndMarkMatches(grid);
        
        if (currentPassHasMatches) {
          madeChangesInLoop = true;
          score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;
          
          // Update state to show vanishing animation
          setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
          await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

          const gridAfterRemoval = await removeMatchedTiles(gridWithMatchesMarked);
          const gridAfterGravity = await applyGravityAndSpawn(gridAfterRemoval);
          grid = gridAfterGravity; // Update grid for the next iteration or final state
          
          setGameState(prev => ({ ...prev, grid, score, isLoading: false })); // Update state with grid after removal & gravity
          // Optionally, add a small delay for spawn animation if needed
          await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION / 2));


        } else {
          grid = gridWithMatchesMarked; // No matches, keep the grid as is
        }
      } while (madeChangesInLoop);

      const gameOver = await checkGameOver(grid);
      if (gameOver && !gameState.isGameOver) { 
         toast({ title: "Game Over!", description: `Final Score: ${score}`});
      }
      return { ...gameState, grid: grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
    } finally {
      setIsProcessingMove(false); 
    }
  }, [toast, gameState, setGameState, setIsProcessingMove]); 

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true); 
    const initialGridData = await initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = await addInitialTiles(initialGridData); 
    
    // Process initial matches (if any from random generation)
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);
    
    setGameState({
      ...finalInitialState, 
      isGameStarted: true,
      isLoading: false,
    });

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Drag rows or diagonals to match 3+ colors." });
  }, [processMatchesAndGravity, toast, setGameState, setIsProcessingMove]); 
  
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        // Basic validation of saved state structure
        if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
            savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES &&
            savedState.isGameStarted && !savedState.isGameOver) { // Only restore if game was active
           setGameState({...savedState, isLoading: true}); // Mark as loading while deciding
           setShowRestorePrompt(true); 
        } else {
          // Invalid saved state, clear it and start new
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
  }, []); // createNewGame will be memoized

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    if (restore) {
       // gameState is already set from useEffect if savedState was valid
       // Just need to process matches and gravity from the restored state
       // and ensure isLoading is false eventually.
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY); // Re-fetch in case
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         // Additional validation if needed
         if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
             savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES) {
            
            // Set the game state fully before processing
            setGameState({...savedState, isLoading: true }); // Mark as loading
            
            // Re-process the grid to catch any matches from a restored state and check game over
            processMatchesAndGravity(savedState.grid, savedState.score).then(newStateFromProcessing => {
              setGameState(currentState => ({
                ...currentState, // Keep potentially updated score, isGameOver
                ...newStateFromProcessing, // Apply grid, potentially new score/gameOver from processing
                isLoading: false // Done loading
              })); 
            });
            toast({ title: "Game Restored", description: "Welcome back!" });
         } else {
           // Saved state became invalid somehow
           localStorage.removeItem(LOCAL_STORAGE_KEY);
           createNewGame(); 
         }
       } else { // Should not happen if showRestorePrompt was true
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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState, isProcessingMove]); // Persist state whenever it changes and conditions are met


  const handleSlideCommit = useCallback(async (
    lineType: 'row' | DiagonalType, 
    identifier: number | { r: number; c: number }, 
    direction: SlideDirection | ('left' | 'right') // Accept 'left'/'right' for rows
  ) => {
    if (isProcessingMove || gameState.isGameOver) return;
    
    setIsProcessingMove(true);
    try {
      // Make a fresh copy of the grid, resetting isNew and isMatched flags
      const gridForSlide = gameState.grid.map(r_val => r_val.map(t => t ? {...t, isNew: false, isMatched: false } : null));

      let gridAfterSlide: GridData;

      if (lineType === 'row' && typeof identifier === 'number') {
        gridAfterSlide = await slideRow(gridForSlide, identifier, direction as 'left' | 'right');
      } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
        const lineCoords = await getTilesOnDiagonal(gridForSlide, identifier.r, identifier.c, lineType);
        if (lineCoords.length > 0) { // Ensure lineCoords is not empty
          gridAfterSlide = await slideLine(gridForSlide, lineCoords, direction as SlideDirection);
        } else {
          console.warn("Attempted to slide an empty diagonal line. No action taken.");
          gridAfterSlide = gridForSlide; // No change if line is empty
        }
      } else {
        console.warn("Invalid slide commit parameters:", { lineType, identifier, direction });
        gridAfterSlide = gridForSlide; // Default to no change on invalid params
      }
      
      setGameState(prev => ({ ...prev, grid: gridAfterSlide })); // Show slide animation
      await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

      const newStateFromProcessing = await processMatchesAndGravity(gridAfterSlide, gameState.score);
      setGameState(prev => ({...prev, ...newStateFromProcessing})); // Update with processed state
    } catch (error) {
      console.error("Error during slide commit:", error);
      toast({title: "Slide Error", description: "Could not complete the move.", variant: "destructive"});
      // Ensure isProcessingMove is reset even on error, handled by finally block in processMatchesAndGravity
      // but if error happens before processMatchesAndGravity, we need to reset it here too.
      setIsProcessingMove(false); 
    }
        
  }, [gameState, isProcessingMove, processMatchesAndGravity, toast, setIsProcessingMove, setGameState]); // Dependencies

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

        {/* Only render game components if not loading and not showing restore prompt, and grid is initialized */}
        {!gameState.isLoading && !showRestorePrompt && gameState.grid.length > 0 && (
          <>
            <GameControls
              score={gameState.score}
              isGameStarted={gameState.isGameStarted}
              onRestart={createNewGame} // Restart current game progress
              onNewGame={createNewGame} // Start entirely new game (clears localStorage)
            />
            <GridDisplay
              gridData={gameState.grid}
              isProcessingMove={isProcessingMove}
              onSlideCommit={handleSlideCommit}
            />
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
