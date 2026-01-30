import { LowballBotStrategy } from './LowballBotStrategy';

/**
 * Factory to get the appropriate bot strategy based on game type
 */
export function getBotStrategy(gameType) {
  switch (gameType) {
    case 'lowball_27':
      return new LowballBotStrategy();
    case 'holdem':
      // Placeholder for future Texas Hold'em implementation
      // return new HoldemBotStrategy();
      return new LowballBotStrategy(); // Fallback for now
    case 'plo':
      // Placeholder for future PLO implementation
      // return new PLOBotStrategy();
      return new LowballBotStrategy(); // Fallback for now
    default:
      // Default to lowball for unknown game types
      return new LowballBotStrategy();
  }
}
