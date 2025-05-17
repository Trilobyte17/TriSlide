
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
    grid: [],
    score: 0,
    isGameOver: false,
    isGameStarted: false,
    isLoading: true,
  });
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  const processMatchesAndGravity = useCallback(async (currentGrid: GridData, initialScore: number): Promise<GameState> => {
    let score = initialScore;
    let grid = currentGrid;
    let madeChangesInLoop;
    let loopCount = 0;
    // In debug mode, loopCount > 1 check was used. For normal play, use a more robust maxLoops.
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * GAME_SETTINGS.VISUAL_TILES_PER_ROW; // Generous loop limit


    try {
      do {
        madeChangesInLoop = false;
        loopCount++;
        if (loopCount > maxLoops) {
          console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
          // toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"}); // This can be spammy
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
          grid = gridAfterGravity;

          // Update state after removal and gravity
          setGameState(prev => ({ ...prev, grid, score, isLoading: false }));
          await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION / 2)); // Shorter delay as tiles just settle

        } else {
          grid = gridWithMatchesMarked; // Ensure grid is updated with isMatched=false etc.
        }
      } while (madeChangesInLoop);

      const gameOver = await checkGameOver(grid);
      if (gameOver && !gameState.isGameOver) { 
         toast({ title: "Game Over!", description: `Final Score: ${score}`});
      }
      return { ...gameState, grid: grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
    } finally {
      // setIsProcessingMove(false) is handled by the caller (handleSlideCommit or createNewGame)
    }
  }, [toast, gameState, setGameState]);


  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true);
    const initialGridData = await initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    let gridWithInitialTiles = await addInitialTiles(initialGridData);
    
    // Process any initial matches that might form upon board creation
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);

    setGameState({
      ...finalInitialState, // grid will come from here
      score: 0, // Score explicitly reset
      isGameOver: false,
      isGameStarted: true,
      isLoading: false,
    });

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Drag rows or diagonals to match 3+ colors." });
    setIsProcessingMove(false);
  }, [processMatchesAndGravity, toast, setGameState, setIsProcessingMove]);


  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        // Basic validation of saved state structure
        if (savedState.grid && savedState.grid.length > 0 && savedState.grid[0]?.length > 0 &&
            savedState.isGameStarted && !savedState.isGameOver) {
           setGameState({...savedState, isLoading: true}); // Load it, then decide to restore or process
           setShowRestorePrompt(true);
        } else {
          console.warn("Invalid saved state structure. Starting new game.");
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
  }, []); // createNewGame dependency removed to prevent re-triggering on its own changes.

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    setIsProcessingMove(true); // Indicate processing
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         try {
            const savedState = JSON.parse(savedStateRaw) as GameState;
            if (savedState.grid && savedState.grid.length > 0 && savedState.grid[0]?.length > 0) {
                // Set the loaded state, then immediately process it for any pending matches/gravity
                // This ensures consistency if the game was saved mid-cascade.
                setGameState({...savedState, isLoading: true }); // Set isLoading while processing
                processMatchesAndGravity(savedState.grid, savedState.score).then(newStateFromProcessing => {
                  setGameState(currentState => ({
                    ...currentState, // Keep potentially loaded score if processing didn't change it
                    ...newStateFromProcessing, // Apply grid changes, game over status, etc.
                    isLoading: false // Done processing
                  }));
                  toast({ title: "Game Restored", description: "Welcome back!" });
                }).finally(() => setIsProcessingMove(false));
            } else {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                createNewGame().finally(() => setIsProcessingMove(false)); // createNewGame handles its own setIsProcessingMove
            }
         } catch (error) {
            console.error("Error parsing restored game state:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            createNewGame().finally(() => setIsProcessingMove(false));
         }
       } else {
           // No saved state found (e.g., if cleared between prompt and this action)
           createNewGame().finally(() => setIsProcessingMove(false));
       }
    } else {
      // User chose not to restore
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      createNewGame().finally(() => setIsProcessingMove(false));
    }
  };

  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading && !isProcessingMove && !gameState.isGameOver) {
      if (gameState.grid && gameState.grid.length > 0 && gameState.grid[0]?.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState, isProcessingMove]);


  const handleSlideCommit = useCallback(async (
    lineType: 'row' | DiagonalType,
    identifier: number | { r: number; c: number },
    directionForEngine: SlideDirection | ('left' | 'right'),
    numSteps: number
  ) => {
    if (isProcessingMove || gameState.isGameOver) return;

    if (numSteps === 0) {
        // If numSteps is 0, the drag didn't result in a full tile shift.
        // No change to game state data needed. Visual drag state is reset by GridDisplay.
        return;
    }

    setIsProcessingMove(true);
    try {
      // Create a deep copy of the current grid to simulate the slide
      let potentialNextGrid = JSON.parse(JSON.stringify(gameState.grid));
      
      // Perform the slide(s) on this temporary grid
      for (let i = 0; i < numSteps; i++) {
        if (lineType === 'row' && typeof identifier === 'number') {
          potentialNextGrid = await slideRow(potentialNextGrid, identifier, directionForEngine as 'left' | 'right');
        } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
          // Re-fetch lineCoords for each step on the potentially modified grid.
          // While not strictly necessary if the line definition is static, it's safer.
          const lineCoords = await getTilesOnDiagonal(potentialNextGrid, identifier.r, identifier.c, lineType);
          if (lineCoords.length > 0) {
            potentialNextGrid = await slideLine(potentialNextGrid, lineCoords, directionForEngine as SlideDirection);
          } else {
            // This can happen if the line becomes empty due to game logic bugs elsewhere, unlikely with current setup.
            console.warn("Attempted to slide an empty/invalid diagonal line during multi-step. Step " + (i+1));
            break; 
          }
        } else {
          console.warn("Invalid slide commit parameters during multi-step. Step " + (i+1), { lineType, identifier, directionForEngine });
          break; // Break from multi-step if parameters are wrong
        }
      }

      // Check if this potential grid resulting from the slide(s) has any matches
      // findAndMarkMatches returns a grid with isMatched flags set.
      const { newGrid: gridWithPotentialMatches, hasMatches: initialSlideHasMatches } = await findAndMarkMatches(potentialNextGrid);

      if (initialSlideHasMatches) {
        // If there's a match, this slide is "valid". Commit it to the main state.
        // The gridWithPotentialMatches has isMatched flags correctly set.
        setGameState(prev => ({ 
            ...prev, 
            grid: gridWithPotentialMatches, 
            isLoading: false 
        }));
        
        // Now, process these matches, subsequent gravity, and further cascades.
        const finalStateFromProcessing = await processMatchesAndGravity(gridWithPotentialMatches, gameState.score);
        setGameState(prev => ({...prev, ...finalStateFromProcessing, isLoading: false}));

      } else {
        // No match resulted from this slide. The grid "snaps back" because
        // we do *not* commit potentialNextGrid (or gridWithPotentialMatches) to gameState.grid.
        // The user sees their original grid.
        // console.log("Slide did not result in a match. Grid reverts to pre-slide state.");
      }

    } catch (error) {
      console.error("Error during slide commit:", error);
      toast({title: "Slide Error", description: "Could not complete the move.", variant: "destructive"});
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState, isProcessingMove, processMatchesAndGravity, toast, setGameState, setIsProcessingMove]);

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
              onRestart={createNewGame} // Restart keeps current game structure, score might reset via createNewGame
              onNewGame={createNewGame} // New game definitely clears everything
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
