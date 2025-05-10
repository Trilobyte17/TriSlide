
# TriSlide Game

This is a Next.js web application for "TriSlide", a tile-matching game inspired by Trism.

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

TriSlide is a game where players slide rows or diagonals of tiles on a triangular grid to match three or more tiles of the same color. When a match is made, the tiles are removed, and new tiles fall into place. The goal is to achieve the highest score possible by creating matches. The game ends when no more valid slides can result in a match. Game state is saved to local storage, allowing users to resume where they left off.

## Features

- **Triangular Grid Display**: A visually distinct triangular grid for gameplay.
- **Row and Diagonal Sliding Interaction**: Intuitive tile manipulation for creating color matches.
- **Color Matching**: Match 3 or more adjacent tiles of the same color.
- **Score Tracking**: Dynamic scoring based on the number of tiles matched.
- **Game Persistence**: Local storage of game state, allowing users to resume previous games.
- **Animations**: Smooth animations for tile slides, matches, and appearances to enhance user experience.
- **Responsive Design**: Playable across various screen sizes.

Built with Next.js, TypeScript, Tailwind CSS, and ShadCN UI components.

