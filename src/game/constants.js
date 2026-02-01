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

// ============================================
// SIT & GO TOURNAMENT CONFIG
// ============================================

// Table mode types
export const TABLE_MODES = {
  CASH_GAME: 'cash_game',
  SIT_AND_GO: 'sit_and_go',
};

// Tournament states
export const TOURNAMENT_STATES = {
  REGISTERING: 'REGISTERING',  // Waiting for players to fill seats
  RUNNING: 'RUNNING',          // Tournament in progress
  COMPLETED: 'COMPLETED',      // Tournament finished
};

// Seat states for tournament
export const SEAT_STATES = {
  OPEN: 'OPEN',           // Seat available (only in REGISTERING)
  ACTIVE: 'ACTIVE',       // Player sitting and playing
  ELIMINATED: 'ELIMINATED', // Player busted - seat is dead
};

// Default tournament settings
export const DEFAULT_TOURNAMENT_CONFIG = {
  buyIn: 1000,           // Default buy-in amount
  startingChips: 1000,   // Starting stack per player (matches buy-in for SnG)
  totalSeats: 6,         // Number of seats (triggers auto-start when filled)
  prizeStructure: [0.65, 0.35], // Default: 1st gets 65%, 2nd gets 35%
};

// ============================================
// SIT & GO BLIND TIMER CONFIG
// ============================================

// Blind level duration in milliseconds (5 minutes)
export const BLIND_LEVEL_DURATION_MS = 5 * 60 * 1000;

// Blind structure for SnG tournaments with 1000 starting stack
// Each level has { smallBlind, bigBlind }
// Blinds double each level
export const SNG_BLIND_STRUCTURE = [
  { level: 1, smallBlind: 10, bigBlind: 20 },
  { level: 2, smallBlind: 20, bigBlind: 40 },
  { level: 3, smallBlind: 40, bigBlind: 80 },
  { level: 4, smallBlind: 80, bigBlind: 160 },
  { level: 5, smallBlind: 160, bigBlind: 320 },
  { level: 6, smallBlind: 320, bigBlind: 640 },
  { level: 7, smallBlind: 640, bigBlind: 1280 },
  { level: 8, smallBlind: 1280, bigBlind: 2560 },
];

/**
 * Get blind structure for a given starting stack
 * For 1000 starting stack, uses default structure starting at 10/20
 * @param {number} startingChips - Tournament starting stack
 * @returns {Array} - Array of blind levels
 */
export function getBlindStructure(startingChips = 1000) {
  // For now, use the same structure for all starting stacks
  // Can be extended later to support different structures based on stack size
  return SNG_BLIND_STRUCTURE;
}

/**
 * Get the current blind level info based on level index
 * @param {number} levelIndex - Current blind level (0-indexed)
 * @returns {Object} - { level, smallBlind, bigBlind }
 */
export function getBlindLevel(levelIndex) {
  const structure = SNG_BLIND_STRUCTURE;
  // Cap at the last level if we've exceeded the structure
  const cappedIndex = Math.min(levelIndex, structure.length - 1);
  return structure[cappedIndex];
}

// Prize structure presets
export const PRIZE_STRUCTURES = {
  HEADS_UP: [1.0],                    // Winner takes all (2 players)
  THREE_HANDED: [0.65, 0.35],         // 3 players
  FOUR_HANDED: [0.50, 0.30, 0.20],    // 4 players
  FIVE_HANDED: [0.45, 0.30, 0.25],    // 5 players
  SIX_HANDED: [0.50, 0.30, 0.20],     // 6 players - top 3 paid
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

/**
 * Get prize structure based on number of tournament players
 * @param {number} playerCount - Number of players in tournament
 * @returns {Array<number>} - Array of percentages for each prize position
 */
export function getPrizeStructure(playerCount) {
  switch (playerCount) {
    case 2:
      return PRIZE_STRUCTURES.HEADS_UP;
    case 3:
      return PRIZE_STRUCTURES.THREE_HANDED;
    case 4:
      return PRIZE_STRUCTURES.FOUR_HANDED;
    case 5:
      return PRIZE_STRUCTURES.FIVE_HANDED;
    case 6:
    default:
      return PRIZE_STRUCTURES.SIX_HANDED;
  }
}

/**
 * Calculate prize payouts for a tournament
 * @param {number} totalPrizePool - Total prize pool amount
 * @param {Array<number>} prizeStructure - Array of percentages
 * @returns {Array<number>} - Array of actual payout amounts
 */
export function calculatePrizePayouts(totalPrizePool, prizeStructure) {
  return prizeStructure.map(percentage => Math.floor(totalPrizePool * percentage));
}
