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

// Number of draw rounds in Single Draw
export const NUM_SINGLE_DRAW_ROUNDS = 1;

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
  SINGLE_DRAW_27: 'single_draw_27',
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

// Auto-restart delay in milliseconds (15 seconds after tournament completion)
export const SNG_AUTO_RESTART_DELAY_MS = 15 * 1000;

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

// Payout structure types for tournament configuration
export const PAYOUT_STRUCTURE_TYPES = {
  WINNER_TAKE_ALL: 'winner_take_all',
  STANDARD: 'standard',
  CUSTOM: 'custom',
};

// Standard payout structures by player count
// These are used when "Standard" payout type is selected
export const STANDARD_PAYOUTS = {
  2: [0.70, 0.30],           // Heads-up: 70/30
  3: [0.50, 0.30, 0.20],     // 3-handed: 50/30/20
  4: [0.50, 0.30, 0.20],     // 4-handed: 50/30/20
  5: [0.45, 0.30, 0.25],     // 5-handed: 45/30/25
  6: [0.50, 0.30, 0.20],     // 6-handed: 50/30/20 (top 3)
};

/**
 * Get payout structure based on type and player count
 * @param {string} payoutType - PAYOUT_STRUCTURE_TYPES value
 * @param {number} playerCount - Number of players in tournament
 * @param {Array<number>} customPayouts - Custom percentages (only used for CUSTOM type)
 * @returns {Array<number>} - Array of decimal percentages
 */
export function getPayoutStructure(payoutType, playerCount, customPayouts = null) {
  switch (payoutType) {
    case PAYOUT_STRUCTURE_TYPES.WINNER_TAKE_ALL:
      return [1.0]; // 100% to 1st place
    case PAYOUT_STRUCTURE_TYPES.STANDARD:
      return STANDARD_PAYOUTS[playerCount] || [1.0];
    case PAYOUT_STRUCTURE_TYPES.CUSTOM:
      if (customPayouts && customPayouts.length > 0) {
        // Validate custom payouts add up to 100% (with small tolerance)
        const total = customPayouts.reduce((sum, pct) => sum + pct, 0);
        if (Math.abs(total - 1.0) < 0.01) {
          return customPayouts;
        }
      }
      // Fall back to winner-take-all if invalid
      return [1.0];
    default:
      return getPrizeStructure(playerCount);
  }
}

/**
 * Parse custom payout string (e.g., "50, 30, 20") into decimal array
 * @param {string} input - Comma-separated percentages
 * @returns {{valid: boolean, payouts: Array<number>, error: string|null}}
 */
export function parseCustomPayouts(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, payouts: [], error: 'Please enter payout percentages' };
  }

  const parts = input.split(',').map(s => s.trim()).filter(s => s.length > 0);

  if (parts.length === 0) {
    return { valid: false, payouts: [], error: 'Please enter at least one payout percentage' };
  }

  const payouts = [];
  for (const part of parts) {
    const num = parseFloat(part);
    if (isNaN(num) || num < 0 || num > 100) {
      return { valid: false, payouts: [], error: `Invalid percentage: "${part}"` };
    }
    payouts.push(num / 100); // Convert to decimal
  }

  const total = payouts.reduce((sum, pct) => sum + pct, 0);
  if (Math.abs(total - 1.0) > 0.01) {
    const totalPercent = (total * 100).toFixed(1);
    return {
      valid: false,
      payouts: [],
      error: `Percentages must add up to 100% (currently ${totalPercent}%)`
    };
  }

  return { valid: true, payouts, error: null };
}

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
    case GAME_TYPES.SINGLE_DRAW_27:
      return {
        holeCards: CARDS_PER_HAND,
        communityCards: 0,
        hasDrawPhase: true,
        drawRounds: NUM_SINGLE_DRAW_ROUNDS,
        phases: ['BETTING_1', 'DRAW_1', 'BETTING_2', 'SHOWDOWN'],
        defaultBettingType: 'no_limit', // 2-7 Single Draw is typically No Limit
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
