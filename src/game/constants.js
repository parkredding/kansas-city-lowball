/**
 * Game constants for Kansas City Lowball (2-7 Triple Draw)
 */

// Maximum number of players allowed per table
export const MAX_PLAYERS = 6;

// Number of cards dealt to each player
export const CARDS_PER_HAND = 5;

// Number of draw rounds in Triple Draw
export const NUM_DRAW_ROUNDS = 3;

// Default settings
export const DEFAULT_STARTING_BALANCE = 10000;
export const DEFAULT_MIN_BET = 50;
export const TURN_TIME_SECONDS = 45;

// Calculate minimum cards needed for a round with reshuffling
// With MAX_PLAYERS at 6 and 3 draw rounds, worst case is all players draw 5 each round
// That's 6 players * 5 cards * 3 rounds = 90 cards (which exceeds 52)
// So we MUST track discards and reshuffle as needed
export const TOTAL_DECK_CARDS = 52;

// Card ranks and suits for dealer cut comparison
// Ace is high in Kansas City Lowball for dealer determination
export const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// Suit priority for dealer cut tie-breaker: Spades > Hearts > Diamonds > Clubs
export const SUIT_VALUES = {
  's': 4, // Spades (highest)
  'h': 3, // Hearts
  'd': 2, // Diamonds
  'c': 1, // Clubs (lowest)
};
