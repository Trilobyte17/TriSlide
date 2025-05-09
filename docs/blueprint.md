# **App Name**: TriPuzzle

## Core Features:

- Grid Display: Display a triangular grid of tiles with numeric values.
- Tile Interaction: Implement a drag-and-drop interface for tile manipulation and value combining.  Same number tiles will combine into the next higher number. Zero can only be created by combing '1' tiles.  Higher numbers combine down to zero. Game ends when no further valid moves are possible.
- Score Tracking: Track the user's score based on tile combinations. Score is multiplied as higher number tiles are formed.
- Game Persistence: Implement local storage of user's game state, using their username or an anonymous user id, and provide ability to restore to a previous game.
- Animation Hints: A simple animation is shown for tiles which merge during gameplay. The goal of the animation is to improve usability for novice players to see valid moves.

## Style Guidelines:

- Pastel or muted color scheme for tiles.
- Use a color to highlight currently active tiles during drag-and-drop.
- Accent: Complementary color for score display and buttons.
- Clean and readable font for numbers on tiles and score display.
- Centralized triangular grid layout with score and controls at the top.
- Smooth transitions for tile movements and combinations.
- Minimalist icons for game controls (e.g., restart, settings).