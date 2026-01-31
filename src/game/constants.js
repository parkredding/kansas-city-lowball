/**
 * Game constants for poker games
 */

// Maximum number of players allowed per table
export const MAX_PLAYERS = 6;

// ============================================
// KANSAS CITY LOWBALL (2-7 Triple Draw) CONFIG
// ============================================

// Number of cards dealt to each player in Lowball
export const CARDS_PER_HAND = 5;

// Number of draw rounds in Triple Draw
export const NUM_DRAW_ROUNDS = 3;

// ============================================
// TEXAS HOLD'EM CONFIG
// ============================================

// Number of hole cards dealt to each player in Hold'em
export const HOLDEM_HOLE_CARDS = 2;

// Number of community cards
export const HOLDEM_COMMUNITY_CARDS = 5;

// Hold'em betting phases
export const HOLDEM_PHASES = {
  PREFLOP: 'PREFLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
};

// ============================================
// GENERAL SETTINGS
// ============================================

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
// Ace is high for dealer determination
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

// Game types
export const GAME_TYPES = {
  LOWBALL_27: 'lowball_27',
  HOLDEM: 'holdem',
};

/**
 * Get game-specific configuration
 * @param {string} gameType - The game type identifier
 * @returns {Object} - Game configuration
 */
export function getGameConfig(gameType) {
  switch (gameType) {
    case GAME_TYPES.HOLDEM:
      return {
        holeCards: HOLDEM_HOLE_CARDS,
        communityCards: HOLDEM_COMMUNITY_CARDS,
        hasDrawPhase: false,
        phases: ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'],
      };
    case GAME_TYPES.LOWBALL_27:
    default:
      return {
        holeCards: CARDS_PER_HAND,
        communityCards: 0,
        hasDrawPhase: true,
        drawRounds: NUM_DRAW_ROUNDS,
        phases: ['BETTING_1', 'DRAW_1', 'BETTING_2', 'DRAW_2', 'BETTING_3', 'DRAW_3', 'BETTING_4', 'SHOWDOWN'],
      };
  }
}
