
# TriPuzzle Game

This is a Next.js web application for "TriPuzzle", a tile-combining game inspired by Trism.

## Getting Started

To get started with the development server:

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

Open [http://localhost:9002](http://localhost:9002) (or your configured port) with your browser to see the game.

The main game logic can be found in `src/app/page.tsx` and related files in `src/lib/tripuzzle/` and `src/components/tripuzzle/`.

## Game Overview

TriPuzzle is a game where players drag and drop tiles on a triangular grid. Tiles with the same numeric value can be combined:
- Regular number tiles (`2` through `9`): Combining two identical tiles results in the next higher number (`N + N -> N+1`).
- `1` tiles: `1 + 1 -> 0`.
- Max value tiles (`10`): `10 + 10 -> 0`.
- `0` tiles: Cannot be combined.

New tiles appear in empty spots after a merge. Score increases with each combination, with higher value merges yielding more points. The game ends when the grid is full and no more valid moves are possible. Game state is saved to local storage, allowing users to resume where they left off.

## Features

- **Triangular Grid Display**: A visually distinct triangular grid for gameplay.
- **Drag-and-Drop Interaction**: Intuitive tile manipulation for combining values.
- **Score Tracking**: Dynamic scoring based on the complexity of tile combinations.
- **Game Persistence**: Local storage of game state, allowing users to resume previous games.
- **Animations**: Smooth animations for tile merges and appearances to enhance user experience.
- **Responsive Design**: Playable across various screen sizes.

Built with Next.js, TypeScript, Tailwind CSS, and ShadCN UI components.

    