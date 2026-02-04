import { LowballBotStrategy } from './LowballBotStrategy';
import { HoldemBotStrategy } from './HoldemBotStrategy';

/**
 * Factory to get the appropriate bot strategy based on game type
 */
export function getBotStrategy(gameType) {
  switch (gameType) {
    case 'lowball_27':
    case 'single_draw_27':
      // Both use 2-7 lowball hand rankings
      return new LowballBotStrategy();
    case 'holdem':
      return new HoldemBotStrategy();
    case 'plo':
      // Placeholder for future PLO implementation
      // return new PLOBotStrategy();
      return new LowballBotStrategy(); // Fallback for now
    default:
      // Default to lowball for unknown game types
      return new LowballBotStrategy();
  }
}
