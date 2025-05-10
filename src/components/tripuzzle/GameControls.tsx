
"use client";

import { Button } from '@/components/ui/button';
import { RotateCcw, Info, Power } from 'lucide-react';
import type { GameState } from '@/lib/tripuzzle/types';

interface GameControlsProps {
  score: GameState['score'];
  isGameStarted: GameState['isGameStarted'];
  onRestart: () => void;
  onNewGame: () => void; // Could be same as restart, or clear persisted state
  // onShowInstructions: () => void; // Future feature
}

export function GameControls({ score, isGameStarted, onRestart, onNewGame }: GameControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center p-4 md:p-6 bg-card shadow-md rounded-lg w-full max-w-2xl mx-auto mb-4">
      <h1 className="text-3xl md:text-4xl font-bold text-primary order-2 sm:order-1 my-2 sm:my-0">
        TriSlide
      </h1>
      <div className="flex items-center space-x-4 order-1 sm:order-2">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">SCORE</p>
          <p className="text-3xl font-bold text-accent">{score}</p>
        </div>
      </div>
      <div className="flex space-x-2 order-3 mt-4 sm:mt-0">
        {isGameStarted && (
          <Button variant="outline" onClick={onRestart} aria-label="Restart current game">
            <RotateCcw className="mr-2 h-4 w-4" /> Restart
          </Button>
        )}
         <Button onClick={onNewGame} aria-label="Start a new game">
           <Power className="mr-2 h-4 w-4" /> New Game
        </Button>
        {/* <Button variant="ghost" size="icon" onClick={onShowInstructions} aria-label="Show instructions">
          <Info className="h-5 w-5" />
        </Button> */}
      </div>
    </div>
  );
}

    
