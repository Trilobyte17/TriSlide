
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
    setIsProcessingMove(true); 
    let score = initialScore;
    let grid = currentGrid;
    let madeChangesInLoop;
    let loopCount = 0; 
    const maxLoops = GAME_SETTINGS.GRID_HEIGHT_TILES * 2; 

    try {
      do {
        madeChangesInLoop = false;
        loopCount++;
        if (loopCount > maxLoops) {
          console.error("Exceeded max loops in processMatchesAndGravity, breaking.");
           // Break the loop instead of showing a toast in normal gameplay after debug.
           // toast({ title: "Game Error", description: "An unexpected issue occurred. Please restart.", variant: "destructive"});
          break; 
        }

        const { newGrid: gridWithMatchesMarked, hasMatches: currentPassHasMatches, matchCount } = await findAndMarkMatches(grid);
        
        if (currentPassHasMatches) {
          madeChangesInLoop = true;
          score += matchCount * GAME_SETTINGS.SCORE_PER_MATCHED_TILE;
          
          setGameState(prev => ({ ...prev, grid: gridWithMatchesMarked, score, isLoading: false }));
          await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

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
      return { ...gameState, grid: grid, score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
    } finally {
      setIsProcessingMove(false); 
    }
  }, [toast, gameState, setGameState, setIsProcessingMove]); 

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true); 
    const initialGridData = await initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = await addInitialTiles(initialGridData); 
    
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
  }, []); 

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY); 
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
             savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES) {
            
            setGameState({...savedState, isLoading: true }); 
            
            processMatchesAndGravity(savedState.grid, savedState.score).then(newStateFromProcessing => {
              setGameState(currentState => ({
                ...currentState, 
                ...newStateFromProcessing, 
                isLoading: false 
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
    identifier: number | { r: number; c: number }, 
    directionForEngine: SlideDirection | ('left' | 'right'),
    numSteps: number
  ) => {
    if (isProcessingMove || gameState.isGameOver || numSteps === 0) return;
    
    setIsProcessingMove(true);
    try {
      let currentGrid = gameState.grid.map(r_val => r_val.map(t => t ? {...t, isNew: false, isMatched: false } : null));

      for (let i = 0; i < numSteps; i++) {
        if (lineType === 'row' && typeof identifier === 'number') {
          // Ensure directionForEngine is 'left' or 'right' for slideRow
          currentGrid = await slideRow(currentGrid, identifier, directionForEngine as 'left' | 'right');
        } else if ((lineType === 'sum' || lineType === 'diff') && typeof identifier === 'object') {
          // Ensure directionForEngine is 'forward' or 'backward' for slideLine
          const lineCoords = await getTilesOnDiagonal(currentGrid, identifier.r, identifier.c, lineType);
          if (lineCoords.length > 0) {
            currentGrid = await slideLine(currentGrid, lineCoords, directionForEngine as SlideDirection);
          } else {
            console.warn("Attempted to slide an empty diagonal line. No action taken for step " + (i+1));
            break; 
          }
        } else {
          console.warn("Invalid slide commit parameters for step " + (i+1), { lineType, identifier, directionForEngine });
          break; 
        }
      }
      
      setGameState(prev => ({ ...prev, grid: currentGrid })); 
      await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

      const newStateFromProcessing = await processMatchesAndGravity(currentGrid, gameState.score);
      setGameState(prev => ({...prev, ...newStateFromProcessing})); 
    } catch (error) {
      console.error("Error during slide commit:", error);
      toast({title: "Slide Error", description: "Could not complete the move.", variant: "destructive"});
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

    