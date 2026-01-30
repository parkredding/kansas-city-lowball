/**
 * Base Strategy Interface for Bot AI
 * All game-specific bot strategies must implement these methods
 */
export class BotStrategy {
  /**
   * Decide which cards to discard during a draw phase
   * @param {Array} hand - Array of card objects { rank, suit }
   * @param {Object} gameState - Current game state (tableData)
   * @param {Object} player - The bot player object
   * @param {string} difficulty - Bot difficulty level ('easy', 'medium', 'hard')
   * @returns {Array<number>} - Array of card indices to discard (0-4)
   */
  decideDiscard(hand, gameState, player, difficulty) {
    throw new Error('decideDiscard must be implemented by subclass');
  }

  /**
   * Decide betting action during a betting phase
   * @param {Array} hand - Array of card objects { rank, suit }
   * @param {Object} gameState - Current game state (tableData)
   * @param {Object} player - The bot player object
   * @param {Array} legalActions - Available actions ['FOLD', 'CHECK', 'CALL', 'RAISE', 'BET']
   * @param {string} difficulty - Bot difficulty level ('easy', 'medium', 'hard')
   * @returns {Object} - { action: string, amount: number }
   */
  decideBet(hand, gameState, player, legalActions, difficulty) {
    throw new Error('decideBet must be implemented by subclass');
  }

  /**
   * Calculate hand strength (0-100) for betting decisions
   * Higher values = stronger hand
   * @param {Array} hand - Array of card objects
   * @param {Object} gameState - Current game state
   * @returns {number} - Hand strength from 0-100
   */
  calculateHandStrength(hand, gameState) {
    throw new Error('calculateHandStrength must be implemented by subclass');
  }
}
