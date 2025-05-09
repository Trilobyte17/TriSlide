
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface GameOverDialogProps {
  isOpen: boolean;
  score: number;
  onNewGame: () => void;
}

export function GameOverDialog({ isOpen, score, onNewGame }: GameOverDialogProps) {
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Game Over!</AlertDialogTitle>
          <AlertDialogDescription>
            You've reached the end of this game. Your final score is:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-4 text-center">
          <p className="text-4xl font-bold text-accent">{score}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button onClick={onNewGame} className="w-full">
              Start New Game
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

    