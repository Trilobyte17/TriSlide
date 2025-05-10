
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, GridData, Tile as TileType } from '@/lib/tripuzzle/types';
import { GAME_SETTINGS } from '@/lib/tripuzzle/types';
import { 
  initializeGrid, 
  addInitialTiles, 
  slideRow, 
  findAndMarkMatches,
  removeMatchedTiles,
  applyGravityAndSpawn,
  checkGameOver,
  swapTiles,
  getNeighbors, // Now directly imported and used
  rotateTriad,  // Import new rotation function
} from '@/lib/tripuzzle/engine';
import { GridDisplay } from '@/components/tripuzzle/GridDisplay';
import { GameControls } from '@/components/tripuzzle/GameControls';
import { GameOverDialog } from '@/components/tripuzzle/GameOverDialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const LOCAL_STORAGE_KEY = 'triPuzzleGameState_colorMatch_v5_swap_rotate';

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
  const [selectedTileCoords, setSelectedTileCoords] = useState<{ r: number; c: number } | null>(null);

  const updateGridWithSelection = useCallback((grid: GridData, coords: {r: number, c: number} | null): GridData => {
    return grid.map((row, rIndex) => 
      row.map((tile, cIndex) => {
        if (!tile) return null;
        const isSelected = coords !== null && rIndex === coords.r && cIndex === coords.c;
        return { ...tile, isSelected };
      })
    );
  }, []);

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
        
        setGameState(prev => ({ ...prev, grid: updateGridWithSelection(gridWithMatchesMarked, null), score, isLoading: false }));
        await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.MATCH_ANIMATION_DURATION));

        const gridAfterRemoval = removeMatchedTiles(gridWithMatchesMarked);
        setGameState(prev => ({ ...prev, grid: updateGridWithSelection(gridAfterRemoval, null), score, isLoading: false }));
        
        grid = applyGravityAndSpawn(gridAfterRemoval);
        setGameState(prev => ({ ...prev, grid: updateGridWithSelection(grid, null), score, isLoading: false }));
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
    return { ...gameState, grid: updateGridWithSelection(grid, null), score, isGameOver: gameOver, isGameStarted: true, isLoading: false };
  }, [toast, gameState.isGameOver, updateGridWithSelection]);

  const createNewGame = useCallback(async () => {
    setIsProcessingMove(true);
    setSelectedTileCoords(null);
    const initialGridData = initializeGrid(GAME_SETTINGS.GRID_HEIGHT_TILES, GAME_SETTINGS.GRID_WIDTH_TILES);
    const gridWithInitialTiles = addInitialTiles(initialGridData); 
    
    const finalInitialState = await processMatchesAndGravity(gridWithInitialTiles, 0);
    
    setGameState({
      ...finalInitialState,
      grid: updateGridWithSelection(finalInitialState.grid, null), 
      isGameStarted: true,
      isLoading: false,
    });

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "New Game Started!", description: "Match 3+ colors by sliding rows, swapping tiles, or rotating triads!" });
    setIsProcessingMove(false);
  }, [processMatchesAndGravity, toast, updateGridWithSelection]);
  
  useEffect(() => {
    const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateRaw) {
      try {
        const savedState = JSON.parse(savedStateRaw) as GameState;
        if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES && // Use GAME_SETTINGS
            savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES && // Use GAME_SETTINGS
            savedState.isGameStarted && !savedState.isGameOver) {
           setGameState({...savedState, grid: updateGridWithSelection(savedState.grid, null), isLoading: true}); 
           setShowRestorePrompt(true); 
        } else {
          // If dimensions mismatch, clear storage and start new game
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
  }, []); // createNewGame is stable due to useCallback

  const handleRestoreGame = (restore: boolean) => {
    setShowRestorePrompt(false);
    if (restore) {
       const savedStateRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (savedStateRaw) {
         const savedState = JSON.parse(savedStateRaw) as GameState;
         // Double check dimensions on restore as well
         if (savedState.grid && savedState.grid.length === GAME_SETTINGS.GRID_HEIGHT_TILES &&
             savedState.grid[0]?.length === GAME_SETTINGS.GRID_WIDTH_TILES) {
            setGameState({...savedState, grid: updateGridWithSelection(savedState.grid, null), isLoading: false});
            processMatchesAndGravity(savedState.grid, savedState.score).then(newState => {
              setGameState(ns => ({...ns, ...newState, grid: updateGridWithSelection(newState.grid, null)}));
            });
            toast({ title: "Game Restored", description: "Welcome back!" });
         } else {
           localStorage.removeItem(LOCAL_STORAGE_KEY);
           createNewGame(); // Dimensions mismatch
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
        const gridToSave = gameState.grid.map(row => row.map(tile => tile ? {...tile, isSelected: false} : null));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({...gameState, grid: gridToSave}));
      }
    }
  }, [gameState, isProcessingMove]); 


  const handleRowSlide = useCallback(async (rowIndex: number, direction: 'left' | 'right') => {
    if (isProcessingMove || gameState.isGameOver) return;
    
    setIsProcessingMove(true);
    setSelectedTileCoords(null); 
    setGameState(prev => ({ ...prev, grid: updateGridWithSelection(prev.grid.map(r_val => r_val.map(t => t ? {...t, isNew: false, isMatched: false } : null)), null) }));

    const gridAfterSlide = slideRow(gameState.grid, rowIndex, direction);
    setGameState(prev => ({ ...prev, grid: updateGridWithSelection(gridAfterSlide, null) })); 
    await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SLIDE_ANIMATION_DURATION));

    const newState = await processMatchesAndGravity(gridAfterSlide, gameState.score);
    setGameState(ns => ({...ns, ...newState})); 
        
  }, [gameState.grid, gameState.score, gameState.isGameOver, processMatchesAndGravity, isProcessingMove, updateGridWithSelection]);

  const handleTileClick = useCallback(async (r: number, c: number) => {
    if (isProcessingMove || gameState.isGameOver || !gameState.grid[r]?.[c]) return;

    const currentGridWithoutSelection = gameState.grid.map(row => row.map(tile => tile ? {...tile, isSelected: false} : null));

    if (!selectedTileCoords) {
      setSelectedTileCoords({ r, c });
      setGameState(prev => ({ ...prev, grid: updateGridWithSelection(prev.grid, {r,c}) }));
    } else {
      const { r: sr, c: sc } = selectedTileCoords;
      if (sr === r && sc === c) { 
        setSelectedTileCoords(null);
        setGameState(prev => ({ ...prev, grid: updateGridWithSelection(prev.grid, null) }));
      } else {
        const isEdgeNeighbor = getNeighbors(sr, sc, currentGridWithoutSelection).some(n => n.r === r && n.c === c);

        if (isEdgeNeighbor) { // Perform Swap
          setIsProcessingMove(true);
          setSelectedTileCoords(null);
          
          const gridAfterSwap = swapTiles(currentGridWithoutSelection, sr, sc, r, c);
          setGameState(prev => ({ ...prev, grid: updateGridWithSelection(gridAfterSwap, null) }));
          await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.SWAP_ANIMATION_DURATION));
          
          const newState = await processMatchesAndGravity(gridAfterSwap, gameState.score);
          setGameState(ns => ({...ns, ...newState}));
        } else { // Not an edge neighbor, check for triad rotation
          const selectedTile = currentGridWithoutSelection[sr]?.[sc];
          const targetTile = currentGridWithoutSelection[r]?.[c];

          if (selectedTile && targetTile) {
            const selectedNeighbors = getNeighbors(sr, sc, currentGridWithoutSelection);
            const targetNeighbors = getNeighbors(r, c, currentGridWithoutSelection);
            
            let middleTileCoords: { r: number; c: number } | null = null;
            for (const sn of selectedNeighbors) {
              const isMutualNeighbor = targetNeighbors.some(tn => tn.r === sn.r && tn.c === sn.c);
              if (isMutualNeighbor && currentGridWithoutSelection[sn.r]?.[sn.c]) {
                middleTileCoords = { r: sn.r, c: sn.c };
                break;
              }
            }

            if (middleTileCoords) { // Perform Triad Rotation
              setIsProcessingMove(true);
              const p1 = {r: sr, c: sc};
              const p2 = middleTileCoords;
              const p3 = {r, c};
              setSelectedTileCoords(null);
              
              // Order for rotation: p1 data -> p2 pos, p2 data -> p3 pos, p3 data -> p1 pos
              const gridAfterRotation = rotateTriad(currentGridWithoutSelection, p1, p2, p3);
              setGameState(prev => ({ ...prev, grid: updateGridWithSelection(gridAfterRotation, null) }));
              await new Promise(resolve => setTimeout(resolve, GAME_SETTINGS.TRIAD_ROTATE_ANIMATION_DURATION));
              
              const newState = await processMatchesAndGravity(gridAfterRotation, gameState.score);
              setGameState(ns => ({...ns, ...newState}));

            } else { // Not a valid rotation partner, so select the new tile
              setSelectedTileCoords({ r, c });
              setGameState(prev => ({ ...prev, grid: updateGridWithSelection(prev.grid, {r,c}) }));
            }
          } else {
             // Fallback: Should not happen if tiles exist. Select new tile.
             setSelectedTileCoords({ r, c });
             setGameState(prev => ({ ...prev, grid: updateGridWithSelection(prev.grid, {r,c}) }));
          }
        }
      }
    }
  }, [isProcessingMove, gameState.isGameOver, gameState.grid, gameState.score, selectedTileCoords, processMatchesAndGravity, updateGridWithSelection]);


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
              onTileClick={handleTileClick}
              selectedTileCoords={selectedTileCoords}
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
              <p>Slide rows, click adjacent tiles to swap, or click diagonally adjacent tiles to rotate a triad.</p>
              <p>Inspired by Trism. Built with Next.js & ShadCN UI.</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
