// Utility functions for TriPuzzle game
// Separated to avoid any Server Action inference issues

/**
 * Generates a unique ID for tiles
 */
export const generateUniqueId = (): string => Math.random().toString(36).substr(2, 9);