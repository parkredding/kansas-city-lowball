/**
 * GameEngine Interface
 *
 * This interface defines the standard contract that any game implementation
 * must follow to work with the tournament wrapper system.
 *
 * The tournament system (Sit & Go) is game-agnostic and wraps around any
 * game engine that implements this interface. This allows the same tournament
 * logic to work with Kansas City Lowball, Texas Hold'em, PLO, or any future
 * poker variant.
 *
 * Key Principles:
 * 1. The tournament wrapper handles registration, elimination, and payouts
 * 2. The game engine handles dealing, betting, and hand resolution
 * 3. The tournament wrapper calls into the game engine via these methods
 * 4. The game engine notifies the wrapper when elimination events occur
 *
 * Usage Example:
 * ```javascript
 * import { createGameEngine } from './GameEngine';
 *
 * const engine = createGameEngine('holdem', {
 *   onElimination: (playerId) => tournamentWrapper.handleElimination(playerId),
 *   onHandComplete: (result) => tournamentWrapper.checkEliminations(result),
 * });
 *
 * engine.start(players, config);
 * ```
 */

/**
 * @typedef {Object} GameConfig
 * @property {string} gameType - The game type identifier (e.g., 'lowball_27', 'holdem')
 * @property {string} bettingType - Betting structure ('no_limit', 'pot_limit', 'fixed_limit')
 * @property {number} minBet - Minimum bet amount
 * @property {number} turnTimeLimit - Seconds per turn
 */

/**
 * @typedef {Object} Player
 * @property {string} uid - Unique player identifier
 * @property {string} displayName - Display name
 * @property {number} chips - Current chip count
 * @property {string} status - Player status ('active', 'folded', 'all-in', 'eliminated')
 * @property {Array} hand - Player's cards
 */

/**
 * @typedef {Object} HandResult
 * @property {Array<{uid: string, amount: number}>} winners - Winners and amounts won
 * @property {Array<{uid: string, chips: number}>} playerChips - Updated chip counts
 * @property {boolean} hasEliminations - True if any player has 0 chips
 * @property {Array<string>} eliminatedPlayerIds - UIDs of players with 0 chips
 */

/**
 * @typedef {Object} TournamentCallbacks
 * @property {function(string): void} onElimination - Called when a player is eliminated
 * @property {function(HandResult): void} onHandComplete - Called when a hand ends
 * @property {function(Object): void} onPhaseChange - Called when game phase changes
 */

/**
 * GameEngine Interface Definition
 *
 * Any game implementation should implement these methods to be compatible
 * with the tournament wrapper system.
 */
export const GameEngineInterface = {
  /**
   * Initialize the game engine with players and configuration
   * Called when a tournament starts or a new table is created
   *
   * @param {Array<Player>} players - Array of player objects
   * @param {GameConfig} config - Game configuration
   * @param {TournamentCallbacks} callbacks - Callbacks for tournament integration
   * @returns {void}
   */
  start: (players, config, callbacks) => {},

  /**
   * Handle a player elimination event
   * Called by the tournament wrapper when a player's chips reach 0
   *
   * @param {string} playerId - The eliminated player's UID
   * @returns {Object} - Elimination result with finish position
   */
  handleElimination: (playerId) => {},

  /**
   * Check if any players should be eliminated
   * Called after each hand completes
   *
   * @param {Array<Player>} players - Current player states
   * @returns {Array<string>} - Array of player UIDs to eliminate
   */
  getPlayersToEliminate: (players) => {},

  /**
   * Get the current game state
   * Used for UI rendering and state synchronization
   *
   * @returns {Object} - Current game state
   */
  getState: () => {},

  /**
   * Deal cards to start a new hand
   * Called when all players are ready and the hand should begin
   *
   * @returns {Object} - Deal result with player hands
   */
  deal: () => {},

  /**
   * Process a player action (bet, fold, check, etc.)
   *
   * @param {string} playerId - The acting player's UID
   * @param {string} action - Action type (FOLD, CHECK, CALL, RAISE, BET, ALL_IN)
   * @param {number} amount - Bet amount (if applicable)
   * @returns {Object} - Action result
   */
  processAction: (playerId, action, amount) => {},

  /**
   * Advance to the next phase of the hand
   * Called after all players have acted in current phase
   *
   * @returns {Object} - New phase state
   */
  advancePhase: () => {},

  /**
   * Resolve the current hand (showdown or last player wins)
   * Called when the hand is complete
   *
   * @returns {HandResult} - Result with winners and chip updates
   */
  resolveHand: () => {},
};

/**
 * Factory function to create a game engine instance
 * This wraps the existing game logic with the standard interface
 *
 * @param {string} gameType - The game type to create
 * @param {TournamentCallbacks} callbacks - Tournament integration callbacks
 * @returns {Object} - Game engine instance implementing GameEngineInterface
 */
export function createGameEngine(gameType, callbacks = {}) {
  // The actual implementation lives in GameService.js
  // This factory provides a clean interface for tournament integration

  return {
    gameType,
    callbacks,

    /**
     * Start the game with given players and config
     */
    start(players, config) {
      // Delegates to GameService methods
      // The tournament wrapper stores the game state in Firestore
      // and uses GameService.dealCards, GameService.performBetAction, etc.
      console.log(`Starting ${gameType} game with ${players.length} players`);
    },

    /**
     * Handle player elimination
     * Called by tournament wrapper when player chips reach 0
     */
    handleElimination(playerId) {
      if (callbacks.onElimination) {
        callbacks.onElimination(playerId);
      }
      return { eliminated: true, playerId };
    },

    /**
     * Get players that need to be eliminated
     */
    getPlayersToEliminate(players) {
      return players
        .filter(p => p.chips === 0 && p.status !== 'eliminated')
        .map(p => p.uid);
    },
  };
}

/**
 * Game Type Registry
 *
 * Maps game type identifiers to their display names and configurations.
 * Add new game types here when implementing new poker variants.
 */
export const GAME_TYPE_REGISTRY = {
  lowball_27: {
    name: 'Kansas City Lowball (2-7 Triple Draw)',
    shortName: '2-7 Triple Draw',
    description: 'Draw poker where the lowest hand wins. Aces are high, straights and flushes count against you.',
    hasDrawPhase: true,
    drawRounds: 3,
    cardsPerHand: 5,
    communityCards: 0,
  },
  single_draw_27: {
    name: '2-7 Single Draw (No Limit)',
    shortName: '2-7 Single Draw',
    description: 'Single-draw poker where the lowest hand wins. One draw round, no limit betting.',
    hasDrawPhase: true,
    drawRounds: 1,
    cardsPerHand: 5,
    communityCards: 0,
  },
  holdem: {
    name: 'Texas Hold\'em',
    shortName: 'Hold\'em',
    description: 'The most popular poker variant. Two hole cards plus five community cards.',
    hasDrawPhase: false,
    drawRounds: 0,
    cardsPerHand: 2,
    communityCards: 5,
  },
  // Future game types can be added here:
  // plo: {
  //   name: 'Pot Limit Omaha',
  //   shortName: 'PLO',
  //   description: 'Four hole cards, must use exactly two.',
  //   hasDrawPhase: false,
  //   drawRounds: 0,
  //   cardsPerHand: 4,
  //   communityCards: 5,
  // },
};

/**
 * Get game type information
 *
 * @param {string} gameType - Game type identifier
 * @returns {Object|null} - Game type info or null if not found
 */
export function getGameTypeInfo(gameType) {
  return GAME_TYPE_REGISTRY[gameType] || null;
}

/**
 * Tournament Integration Helper
 *
 * This helper class provides utilities for integrating game engines
 * with the tournament wrapper system.
 */
export class TournamentGameBridge {
  constructor(tableId, gameType) {
    this.tableId = tableId;
    this.gameType = gameType;
    this.eliminationCallbacks = [];
    this.handCompleteCallbacks = [];
  }

  /**
   * Register a callback for elimination events
   */
  onElimination(callback) {
    this.eliminationCallbacks.push(callback);
    return () => {
      this.eliminationCallbacks = this.eliminationCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register a callback for hand completion events
   */
  onHandComplete(callback) {
    this.handCompleteCallbacks.push(callback);
    return () => {
      this.handCompleteCallbacks = this.handCompleteCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all elimination callbacks
   */
  notifyElimination(playerId, finishPosition) {
    this.eliminationCallbacks.forEach(cb => cb(playerId, finishPosition));
  }

  /**
   * Notify all hand complete callbacks
   */
  notifyHandComplete(result) {
    this.handCompleteCallbacks.forEach(cb => cb(result));
  }
}

export default {
  GameEngineInterface,
  createGameEngine,
  GAME_TYPE_REGISTRY,
  getGameTypeInfo,
  TournamentGameBridge,
};
