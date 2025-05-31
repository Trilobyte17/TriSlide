
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

const LOCAL_STORAGE_KEY = 'triSlideGameState_v9_final_layout';

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

  const setProcessingMoveWithLogging = useCallback((value: boolean, caller: string) => {
    // console.log(`setIsProcessingMove called with ${value} from ${caller}`);
    setIsProcessingMove(value);
  }, [setIsProcessingMove]);


  const processMatchesAndGravity = useCallback(async (currentGrid: GridData, initialScore: number): Promise<GameState> => {
    let score = initialScore;
    let grid = JSON.parse(JSON.stringify(currentGrid));
    let madeChangesInLoop;
    let loopCount = 0;
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * GAME_SETTINGS.VISUAL_TILES_PER_ROW * 2;

    do {
      madeChangesInLoop = false;
      loopCount++;
      if (loopCount > maxLoops) {
        console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
        // toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"});
        break; 
      }

      const { newGrid: gridWithMatchesMarked, hasMatches: currentPassHasMatches, matchCount } = await findAndMarkMatches(grid);
      
      if (currentPassHasMatches) {
        madeChangesInLoop = true;
        score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;

        // Show matches highlighted for 750ms before clearing
        setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, 750));

        // Now remove matches and apply gravity
        const gridAfterRemoval = await removeMatchedTiles(gridWithMatchesMarked);
        const gridAfterGravity = await applyGravityAndSpawn(gridAfterRemoval);
        grid = gridAfterGravity; 

        setGameState(prev => ({ ...prev, grid, score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SPAWN_ANIMATION_DURATION / 2)); 
      } else {
        grid = gridWithMatchesMarked; 
      }
    } while (madeChangesInLoop);

    const gameOver = await checkGameOver(grid);
    if (gameOver && !gameState.isGameOver) { 
       toast({ title: "Game Over!", description: `Final Score: ${score}`});
    }
    return { 
      grid: grid, 
      score: score, 
      isGameOver: gameOver, 
      isGameStarted: gameState.isGameStarted, 
      isLoading: false 
    };
  }, [toast, gameState.isGameOver, gameState.isGameStarted, setGameState]);


  const createNewGame = useCallback(async () => {
    console.log("createNewGame: Started"); // DEBUG LOG
    setProcessingMoveWithLogging(true, "createNewGame_start");
    try {
      const initialGridData = await initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
      let gridWithInitialTiles = await addInitialTiles(initialGridData);
      
      const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);

      setGameState({
        ...finalInitialState,
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
        if (savedState.grid && savedState.grid.length > 0 && savedState.grid[0]?.length > 0 &&
            savedState.isGameStarted && !savedState.isGameOver) {
           setGameState({...savedState, isLoading: false}); // Already not loading if restoring valid state
           setShowRestorePrompt(true);
        } else {
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
            if (savedState.grid && savedState.grid.length > 0 && savedState.grid[0]?.length > 0) {
                
                // Apply processMatchesAndGravity to ensure the restored grid is in a stable state
                const processedRestoredState = await processMatchesAndGravity(savedState.grid, savedState.score);
                
                setGameState(currentState => ({
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
            await createNewGame(); 
         }
       } else { // No saved state found (should not happen if restore prompt was shown)
           await createNewGame(); 
       }
    } else { // User chose not to restore
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      await createNewGame(); 
    }
    // Note: createNewGame handles its own setProcessingMove(false) in its finally block.
    // If createNewGame is NOT called in this function, we need to set it false here.
    // The current structure ensures createNewGame is called if restore isn't fully successful.
  }, [processMatchesAndGravity, toast, createNewGame, setProcessingMoveWithLogging, setGameState]);

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
    if (isProcessingMove || gameState.isGameOver || numSteps === 0) {
        return;
    }

    setProcessingMoveWithLogging(true, "handleSlideCommit_start");
    
    let temporaryGrid = JSON.parse(JSON.stringify(gameState.grid)); 
    
    try {
      for (let i = 0; i < numSteps; i++) {
        if (lineType === 'row' && typeof identifier === 'number') {
          temporaryGrid = await slideRow(temporaryGrid, identifier, directionForEngine as 'left' | 'right');
        } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
          const lineCoords = await getTilesOnDiagonal(temporaryGrid, identifier.r, identifier.c, lineType);
          if (lineCoords.length > 0) {
            temporaryGrid = await slideLine(temporaryGrid, lineCoords, directionForEngine as SlideDirection);
          } else {
            break; 
          }
        } else {
          break; 
        }
      }
      
      // Check for matches on the temporary grid *before* committing to main state
      const { hasMatches: slideCausedMatches, newGrid: gridWithPotentialMatchesMarked } = await findAndMarkMatches(temporaryGrid);

      if (slideCausedMatches) {
        // Commit the slide to the main state (with highlights)
        // then process all matches and gravity.
        const finalStateFromProcessing = await processMatchesAndGravity(gridWithPotentialMatchesMarked, gameState.score);
        setGameState(finalStateFromProcessing);
      } else {
        // No match from the slide. The visual snap-back is handled by GridDisplay.
        // The main gameState.grid remains unchanged. No state update needed here.
      }

    } catch (error) {
      console.error("Error during slide commit:", error);
      toast({title: "Slide Error", description: "Could not complete the move.", variant: "destructive"});
    } finally {
      setProcessingMoveWithLogging(false, "handleSlideCommit_finish");
    }
  }, [gameState, isProcessingMove, processMatchesAndGravity, toast, setProcessingMoveWithLogging, setGameState]);

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

        {!gameState.isLoading && !showRestorePrompt && (
          <>
            <GameControls
              score={gameState.score}
              isGameStarted={gameState.isGameStarted}
              onRestart={createNewGame} 
              onNewGame={createNewGame} 
            />
            {(gameState.isGameStarted && gameState.grid.length > 0) ? (
              <GridDisplay
                gridData={gameState.grid}
                isProcessingMove={isProcessingMove}
                onSlideCommit={handleSlideCommit}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64">
                <p className="text-xl mb-4">Click "New Game" to begin!</p>
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
    
