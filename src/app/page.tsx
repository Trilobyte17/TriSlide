
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData, DiagonalType, SlideDirection } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import {
  initializeGrid,
  addInitialTiles,
  slideRow,
  slideLine, // Keep for direct use if needed, though handleSlideCommit is primary
  getTilesOnDiagonal, // For determining line to slide
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

const LOCAL_STORAGE_KEY = 'triSlideGameState_v9_final_layout'; // Updated key for potentially new structure

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

  // Helper for logging setIsProcessingMove calls
  const setProcessingMoveWithLogging = useCallback((value: boolean, caller: string) => {
    // console.log(`setIsProcessingMove called with ${value} from ${caller}`);
    setIsProcessingMove(value);
  }, [setIsProcessingMove]);


  const processMatchesAndGravity = useCallback(async (currentGrid: GridData, initialScore: number): Promise<GameState> => {
    // Caller is responsible for setting isProcessingMove true before calling this
    // and false after this function (and any subsequent UI updates) complete.
    let score = initialScore;
    let grid = JSON.parse(JSON.stringify(currentGrid)); // Operate on a mutable copy
    let madeChangesInLoop;
    let loopCount = 0;
    // Safety break for extreme cases, GRID_HEIGHT_TILES * VISUAL_TILES_PER_ROW is max possible tiles
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * GAME_SETTINGS.VISUAL_TILES_PER_ROW * 2; 

    do {
      madeChangesInLoop = false;
      loopCount++;
      if (loopCount > maxLoops) {
        console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
        toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"});
        break; 
      }

      // 1. Find and Mark Matches
      const { newGrid: gridWithMatchesMarked, hasMatches: currentPassHasMatches, matchCount } = await findAndMarkMatches(grid);
      
      if (currentPassHasMatches) {
        madeChangesInLoop = true;
        score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;

        // Update state to show highlights (and trigger vanishing animations)
        setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

        // 2. Remove Matched Tiles (creates nulls)
        const gridAfterRemoval = await removeMatchedTiles(gridWithMatchesMarked);
        // 3. Apply Gravity and Spawn New Tiles
        const gridAfterGravity = await applyGravityAndSpawn(gridAfterRemoval);
        
        grid = gridAfterGravity; // Update working grid for next loop iteration

        // Update state to show tiles falling and new ones appearing (spawn animations)
        setGameState(prev => ({ ...prev, grid, score, isLoading: false }));
        // Short delay for spawn/fall animations to register visually if needed
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION / 2)); 
      } else {
        grid = gridWithMatchesMarked; // No matches, grid is stable from this pass
      }
    } while (madeChangesInLoop);

    const gameOver = await checkGameOver(grid);
    if (gameOver && !gameState.isGameOver) { // Only toast if newly game over
       toast({ title: "Game Over!", description: `Final Score: ${score}`});
    }
    return { 
      grid: grid, 
      score: score, 
      isGameOver: gameOver, 
      isGameStarted: gameState.isGameStarted, // Preserve isGameStarted
      isLoading: false 
    };
  }, [toast, gameState.isGameOver, gameState.isGameStarted, setGameState]); // Removed setIsProcessingMove


  const createNewGame = useCallback(async () => {
    console.log("createNewGame: Started"); // DEBUG LOG
    setProcessingMoveWithLogging(true, "createNewGame_start");
    try {
      const initialGridData = await initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
      let gridWithInitialTiles = await addInitialTiles(initialGridData);
      
      // Process initial matches and gravity immediately after adding tiles
      // This ensures the board starts in a stable, playable state without pre-existing matches.
      const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);

      setGameState({
        ...finalInitialState, // grid, score, isGameOver from processMatchesAndGravity
        isGameStarted: true,
        isLoading: false,
      });
      console.log("createNewGame: Successfully set new game state, grid rows:", finalInitialState.grid.length); // DEBUG LOG

      localStorage.removeItem(LOCAL_STORAGE_KEY);
      toast({ title: "New Game Started!", description: "Drag rows or diagonals to match 3+ colors." });
    } catch (error) {
      console.error("createNewGame: Error caught", error); // DEBUG LOG
      toast({ title: "Error", description: "Could not start a new game.", variant: "destructive" });
      setGameState(prev => ({ ...prev, isLoading: false, isGameStarted: false, grid: [] }));
    } finally {
      setProcessingMoveWithLogging(false, "createNewGame_finish");
      console.log("createNewGame: Finished"); // DEBUG LOG
    }
  }, [processMatchesAndGravity, toast, setProcessingMoveWithLogging, setGameState]);


  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        // Check for a minimally valid saved state
        if (savedState.grid && savedState.grid.length > 0 && savedState.grid[0]?.length > 0 &&
            savedState.isGameStarted && !savedState.isGameOver) { // Ensure valid, started, not game over state
           // Don't directly set state here; let handleRestoreGame do it after processing
           setGameState({...savedState, isLoading: false}); // Already not loading if restoring valid state
           setShowRestorePrompt(true);
        } else {
          // Invalid or incomplete saved state, clear it and start new
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          console.log("Initial useEffect: Invalid or incomplete saved state, creating new game.");
          createNewGame(); 
        }
      } catch (error) {
        console.error("Initial useEffect: Failed to parse saved game state, creating new game.", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        createNewGame(); 
      }
    } else {
      console.log("Initial useEffect: No saved state found, creating new game.");
      // This will auto-start a new game if no saved state is found.
      createNewGame(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // createNewGame is memoized with its dependencies


  const handleRestoreGame = useCallback(async (restore: boolean) => {
    setShowRestorePrompt(false);
    setProcessingMoveWithLogging(true, "handleRestoreGame_start"); 
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         try {
            const savedState = JSON.parse(savedStateRaw) as GameState;
            // Ensure grid exists and has content before processing
            if (savedState.grid && savedState.grid.length > 0 && savedState.grid[0]?.length > 0) {
                
                // Apply processMatchesAndGravity to ensure the restored grid is in a stable state
                // and to handle any matches that might have been saved mid-cascade (unlikely but safe).
                const processedRestoredState = await processMatchesAndGravity(savedState.grid, savedState.score);
                
                setGameState(currentState => ({ // Use functional update for safety
                  ...currentState, 
                  ...processedRestoredState, 
                  isGameStarted: true, // Ensure game is marked as started
                  isLoading: false 
                }));
                toast({ title: "Game Restored", description: "Welcome back!" });
                setProcessingMoveWithLogging(false, "handleRestoreGame_restore_success");
            } else { // Invalid grid in saved state
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                await createNewGame(); // This will handle its own isProcessingMove
            }
         } catch (error) { // Error parsing
            console.error("Error parsing restored game state:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            await createNewGame(); // This will handle its own isProcessingMove
         }
       } else { // No saved state found (should not happen if restore prompt was shown)
           await createNewGame(); // This will handle its own isProcessingMove
       }
    } else { // User chose not to restore
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      await createNewGame(); // This will handle its own isProcessingMove
    }
    // Note: createNewGame handles its own setProcessingMove(false) in its finally block.
    // If createNewGame is NOT called in this function, we need to set it false here.
    // The current structure ensures createNewGame is called if restore isn't fully successful.
  }, [processMatchesAndGravity, toast, createNewGame, setProcessingMoveWithLogging, setGameState]);

  // Save game state to local storage whenever it changes and is valid
  useEffect(() => {
    if (gameState.isGameStarted && !gameState.isLoading && !isProcessingMove && !gameState.isGameOver) {
      // Only save if grid has content (e.g., not after a clear or during initial empty state)
      if (gameState.grid && gameState.grid.length > 0 && gameState.grid[0]?.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
        // console.log("Game state saved to localStorage"); // DEBUG
      }
    }
  }, [gameState, isProcessingMove]); // isProcessingMove ensures we don't save during a move


  const handleSlideCommit = useCallback(async (
    lineType: 'row' | DiagonalType,
    identifier: number | { r: number; c: number }, // row index for 'row', {r,c} for diagonals
    directionForEngine: SlideDirection | ('left' | 'right'), // Engine expects 'forward'/'backward' for diagonals
    numSteps: number
  ) => {
    if (isProcessingMove || gameState.isGameOver || numSteps === 0) {
        // console.log("handleSlideCommit: Bailing early", { isProcessingMove, isGameOver: gameState.isGameOver, numSteps });
        return;
    }

    setProcessingMoveWithLogging(true, "handleSlideCommit_start");
    
    let temporaryGrid = JSON.parse(JSON.stringify(gameState.grid)); // Deep copy for simulation
    
    try {
      // Perform the slide operations on the temporary grid
      for (let i = 0; i < numSteps; i++) {
        if (lineType === 'row' && typeof identifier === 'number') {
          temporaryGrid = await slideRow(temporaryGrid, identifier, directionForEngine as 'left' | 'right');
        } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
          // Re-fetch lineCoords based on the potentially modified temporaryGrid if slides affect line definition
          // For multi-step slides, it's crucial to use the updated grid for each step's line definition
          const lineCoords = await getTilesOnDiagonal(temporaryGrid, identifier.r, identifier.c, lineType);
          if (lineCoords.length > 0) { // Ensure line still valid
            temporaryGrid = await slideLine(temporaryGrid, lineCoords, directionForEngine as SlideDirection, lineType);
          } else {
            // console.warn("handleSlideCommit: Line became invalid during multi-step slide for diagonal.");
            break; // Stop if line becomes invalid
          }
        } else {
          // console.warn("handleSlideCommit: Invalid lineType or identifier combination.");
          break; // Should not happen
        }
      }
      
      // Check for matches on the temporary grid *before* committing to main state
      const { hasMatches: slideCausedMatches } = await findAndMarkMatches(temporaryGrid);

      if (slideCausedMatches) {
        // Commit the slide to the main state, then process all matches and gravity.
        // The grid passed to processMatchesAndGravity should be the one *after* the slide.
        const finalStateFromProcessing = await processMatchesAndGravity(temporaryGrid, gameState.score);
        setGameState(finalStateFromProcessing);
      } else {
        // No match from the slide. The visual snap-back is handled by GridDisplay.
        // The main gameState.grid remains unchanged if this "try-before-commit" is strict.
        // If we want to commit the slide even if no match, then setGameState here:
        setGameState(prev => ({ ...prev, grid: temporaryGrid, isLoading: false }));
        // console.log("handleSlideCommit: No matches from slide, but slide committed.");
      }

    } catch (error) {
      console.error("Error during slide commit:", error);
      toast({title: "Slide Error", description: "Could not complete the move.", variant: "destructive"});
      // Optionally, reset to previous stable state if an error occurs mid-processing
      // setGameState(prev => ({ ...prev, grid: JSON.parse(JSON.stringify(gameState.grid)) })); // Revert to original grid on error
    } finally {
      setProcessingMoveWithLogging(false, "handleSlideCommit_finish");
    }
  }, [gameState, isProcessingMove, processMatchesAndGravity, toast, setProcessingMoveWithLogging, setGameState]); // Added setGameState

  if (gameState.isLoading && !showRestorePrompt) {
    return <div className="flex items-center justify-center min-h-screen text-xl">Loading TriSlide...</div>;
  }

  return (
    <>
      {/* Global styles for animations, ensure these are not causing issues */}
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
        
        /* Override for matched tiles during highlighting phase */
        .tile-matched-highlighting {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
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

        {/* Main game content, only render if not loading and not showing restore prompt */}
        {!gameState.isLoading && !showRestorePrompt && (
          <>
            <GameControls
              score={gameState.score}
              isGameStarted={gameState.isGameStarted}
              onRestart={createNewGame} // Restart re-initializes current game (could also clear score or not based on design)
              onNewGame={createNewGame} // New Game explicitly starts fresh, clearing any old state
            />
            {(gameState.isGameStarted && gameState.grid.length > 0) ? (
              <GridDisplay
                gridData={gameState.grid}
                isProcessingMove={isProcessingMove}
                onSlideCommit={handleSlideCommit}
              />
            ) : (
              // Fallback if game not started or grid empty (should be handled by createNewGame)
              <div className="flex flex-col items-center justify-center h-64">
                <p className="text-xl mb-4">Click "New Game" to begin!</p>
                {/* Could add a Button here to start a new game if !isGameStarted */}
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
    