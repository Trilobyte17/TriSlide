
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
  removeMatchedTiles, // In debug mode, this doesn't remove, just for flow
  applyGravityAndSpawn, // In debug mode, this doesn't apply, just for flow
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
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * 2; 

    // Note: isProcessingMove is set to true by the caller (handleSlideCommit)
    // This function is responsible for setting it back to false in the finally block.
    try {
      do {
        madeChangesInLoop = false;
        loopCount++;
        // MODIFIED DEBUG BREAK: only break if it's not the first loop and matches are still present
        if (loopCount > 1 && grid.some(row => row.some(t => t?.isMatched))) { 
          console.warn("Debug: Breaking match loop as matched tiles are persistent in debug mode.");
          break; 
        }
        if (loopCount > maxLoops) {
          console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
          toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"});
          break;
        }

        const { newGrid: gridWithMatchesMarked, hasMatches: currentPassHasMatches, matchCount } = await findAndMarkMatches(grid);
        
        if (currentPassHasMatches) {
          madeChangesInLoop = true;
          score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;
          
          setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
          await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

          // In debug mode, grid holds the highlighted tiles. `removeMatchedTiles` and `applyGravity` are no-ops in engine.ts for debug.
          grid = gridWithMatchesMarked;
        } else {
          grid = gridWithMatchesMarked;
          // madeChangesInLoop remains false, loop will terminate
        }
      } while (madeChangesInLoop);

      const gameOver = await checkGameOver(grid);
      if (gameOver && !gameState.isGameOver) { // Check against the original gameState.isGameOver from the closure
         toast({ title: "Game Over!", description: `Final Score: ${score}`});
      }
      // Return a state object that can be merged by the caller
      return { ...gameState, grid: grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
    } finally {
      setIsProcessingMove(false); // CRITICAL: Always reset isProcessingMove
    }
  }, [toast, gameState, setGameState, setIsProcessingMove]); // Added gameState, setGameState, setIsProcessingMove

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true); // Prevent other actions while creating
    const initialGridData = await initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = await addInitialTiles(initialGridData); 
    
    // Process initial state; processMatchesAndGravity will call setIsProcessingMove(false) in its finally block.
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);
    
    setGameState({
      ...finalInitialState, // This includes grid, score, isGameOver from processMatchesAndGravity
      isGameStarted: true,
      isLoading: false,
    });
    // setIsProcessingMove(false) is handled by processMatchesAndGravity's finally block.

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Drag rows or diagonals to match 3+ colors." });
  }, [processMatchesAndGravity, toast, setGameState, setIsProcessingMove]); // Added setGameState, setIsProcessingMove
  
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
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
             savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES) {
            
            // Set loading true before async operation
            setGameState({...savedState, isLoading: true }); 
            
            processMatchesAndGravity(savedState.grid, savedState.score).then(newStateFromProcessing => {
              setGameState(currentState => ({
                ...currentState, // Preserve any intermediate state like isLoading
                ...newStateFromProcessing, // Apply results from processing
                isLoading: false // Explicitly set loading false after processing
              })); 
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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
      }
    }
  }, [gameState, isProcessingMove]); 


  const handleSlideCommit = useCallback(async (
    lineType: 'row' | DiagonalType, 
    identifier: number | { r: number, c: number }, 
    direction: SlideDirection | ('left' | 'right') 
  ) => {
    if (isProcessingMove || gameState.isGameOver) return;
    
    setIsProcessingMove(true);
    try {
      // Create a fresh grid for this operation, resetting isNew/isMatched flags
      const gridForSlide = gameState.grid.map(r_val => r_val.map(t => t ? {...t, isNew: false, isMatched: false } : null));
      // Don't call setGameState here immediately for gridForSlide, let the slide result update it.

      let gridAfterSlide: GridData;

      if (lineType === 'row' && typeof identifier === 'number') {
        gridAfterSlide = await slideRow(gridForSlide, identifier, direction as 'left' | 'right');
      } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
        const lineCoords = await getTilesOnDiagonal(gridForSlide, identifier.r, identifier.c, lineType);
        if (lineCoords.length > 0) { // Check if any cells are on the line
          gridAfterSlide = await slideLine(gridForSlide, lineCoords, direction as SlideDirection);
        } else {
          gridAfterSlide = gridForSlide; // No valid line found, no slide occurs
        }
      } else {
        gridAfterSlide = gridForSlide; // Should not happen with valid inputs
      }
      
      setGameState(prev => ({ ...prev, grid: gridAfterSlide })); 
      await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

      // processMatchesAndGravity will handle setting isProcessingMove to false in its finally block
      const newStateFromProcessing = await processMatchesAndGravity(gridAfterSlide, gameState.score);
      setGameState(prev => ({...prev, ...newStateFromProcessing})); 
    } catch (error) {
      console.error("Error during slide commit:", error);
      toast({title: "Slide Error", description: "Could not complete the move.", variant: "destructive"});
      setIsProcessingMove(false); // Fallback reset if an error occurs before/outside processMatchesAndGravity
    }
        
  }, [gameState, isProcessingMove, processMatchesAndGravity, toast, setIsProcessingMove, setGameState]); // Added missing dependencies

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

    