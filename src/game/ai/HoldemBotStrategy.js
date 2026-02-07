import { BotStrategy } from './BotStrategy';
import { TexasHoldemHandEvaluator } from '../TexasHoldemHandEvaluator';
import { BetAction } from '../GameService';

/**
 * Bot Strategy for Texas Hold'em
 * Makes betting decisions based on hand strength, position, and pot odds
 */
export class HoldemBotStrategy extends BotStrategy {
  /**
   * Texas Hold'em has no draw phase - this method is not used
   * Returns empty array for compatibility
   */
  decideDiscard(hand, gameState, player, difficulty) {
    // No draws in Texas Hold'em
    return [];
  }

  /**
   * Decide betting action during a betting phase
   */
  decideBet(hand, gameState, player, legalActions, difficulty) {
    const communityCards = gameState.communityCards || [];
    const handStrength = this.calculateHandStrength(hand, gameState);
    const currentBet = gameState.currentBet || 0;
    const playerBet = player.currentRoundBet || 0;
    const callAmount = Math.max(0, currentBet - playerBet);
    const playerChips = player.chips || 0;
    const minBet = gameState.minBet || 50;
    const minRaise = currentBet + minBet;
    const pot = gameState.pot || 0;

    // Calculate pot odds
    const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) * 100 : 0;

    // Determine available actions
    const canCheck = legalActions.includes(BetAction.CHECK);
    const canCall = legalActions.includes(BetAction.CALL) && callAmount > 0;
    const canRaise = legalActions.includes(BetAction.RAISE) || legalActions.includes(BetAction.BET);
    const canFold = legalActions.includes(BetAction.FOLD);

    // Calculate position advantage (later position = better)
    const position = this.calculatePosition(gameState, player);

    // Use BET when no current bet, RAISE when facing a bet
    const raiseAction = currentBet === 0 ? BetAction.BET : BetAction.RAISE;

    if (difficulty === 'easy') {
      return this.decideBetEasy(handStrength, canCheck, canCall, canRaise, canFold, minRaise, playerChips, raiseAction);
    } else if (difficulty === 'medium') {
      return this.decideBetMedium(handStrength, canCheck, canCall, canRaise, canFold,
                                   callAmount, minRaise, playerChips, potOdds, position, raiseAction);
    } else {
      return this.decideBetHard(handStrength, canCheck, canCall, canRaise, canFold,
                                callAmount, minRaise, playerChips, potOdds, position, pot, gameState, raiseAction);
    }
  }

  /**
   * Easy difficulty: Random behavior with slight preference for passive play
   */
  decideBetEasy(handStrength, canCheck, canCall, canRaise, canFold, minRaise, playerChips, raiseAction) {
    const rand = Math.random();

    if (rand < 0.15 && canFold) {
      return { action: BetAction.FOLD, amount: 0 };
    } else if (rand < 0.75 && (canCheck || canCall)) {
      return { action: canCheck ? BetAction.CHECK : BetAction.CALL, amount: 0 };
    } else if (canRaise && rand < 0.9) {
      const raiseAmount = Math.min(minRaise, playerChips);
      return { action: raiseAction, amount: raiseAmount };
    } else if (canCheck) {
      return { action: BetAction.CHECK, amount: 0 };
    } else if (canCall) {
      return { action: BetAction.CALL, amount: 0 };
    } else {
      return { action: BetAction.FOLD, amount: 0 };
    }
  }

  /**
   * Medium difficulty: Uses hand strength for decisions
   */
  decideBetMedium(handStrength, canCheck, canCall, canRaise, canFold,
                  callAmount, minRaise, playerChips, potOdds, position, raiseAction) {
    // Strong hands: Raise
    if (handStrength > 75) {
      if (canRaise) {
        const raiseAmount = Math.min(minRaise * 1.5, playerChips);
        return { action: raiseAction, amount: Math.floor(raiseAmount) };
      }
      return { action: canCall ? BetAction.CALL : BetAction.CHECK, amount: 0 };
    }

    // Good hands: Call or small raise
    if (handStrength > 55) {
      if (canCheck) {
        // Sometimes raise with good hands in position
        if (position > 0.6 && Math.random() < 0.3 && canRaise) {
          return { action: raiseAction, amount: minRaise };
        }
        return { action: BetAction.CHECK, amount: 0 };
      }
      if (canCall && callAmount <= playerChips * 0.2) {
        return { action: BetAction.CALL, amount: 0 };
      }
      if (canFold) {
        return { action: BetAction.FOLD, amount: 0 };
      }
    }

    // Medium hands: Check or fold to bets
    if (handStrength > 40) {
      if (canCheck) {
        return { action: BetAction.CHECK, amount: 0 };
      }
      // Call small bets only
      if (canCall && callAmount <= playerChips * 0.1) {
        return { action: BetAction.CALL, amount: 0 };
      }
      if (canFold) {
        return { action: BetAction.FOLD, amount: 0 };
      }
    }

    // Weak hands: Check or fold
    if (canCheck) {
      return { action: BetAction.CHECK, amount: 0 };
    }
    if (canFold) {
      return { action: BetAction.FOLD, amount: 0 };
    }
    return { action: BetAction.CALL, amount: 0 };
  }

  /**
   * Hard difficulty: Uses pot odds, position, and advanced logic
   */
  decideBetHard(handStrength, canCheck, canCall, canRaise, canFold,
                callAmount, minRaise, playerChips, potOdds, position, pot, gameState, raiseAction) {
    const phase = gameState.phase || '';
    const isPreflop = phase === 'PREFLOP' || phase === 'BETTING_1';

    // Premium hands (80+): Always raise/re-raise
    if (handStrength > 80) {
      if (canRaise) {
        // Size raises based on pot
        const raiseSize = Math.min(pot * 0.75, playerChips);
        const raiseAmount = Math.max(minRaise, raiseSize);
        return { action: raiseAction, amount: Math.floor(raiseAmount) };
      }
      return { action: canCall ? BetAction.CALL : BetAction.CHECK, amount: 0 };
    }

    // Strong hands (65-80): Raise for value or call
    if (handStrength > 65) {
      if (canCheck && position > 0.5 && Math.random() < 0.5) {
        // Slow play sometimes in position
        return { action: BetAction.CHECK, amount: 0 };
      }
      if (canRaise && position > 0.4) {
        const raiseAmount = Math.min(minRaise * 1.5, playerChips);
        return { action: raiseAction, amount: Math.floor(raiseAmount) };
      }
      if (canCall) {
        return { action: BetAction.CALL, amount: 0 };
      }
      return { action: BetAction.CHECK, amount: 0 };
    }

    // Drawing hands / Medium hands (45-65): Use pot odds
    if (handStrength > 45) {
      if (canCheck) {
        return { action: BetAction.CHECK, amount: 0 };
      }
      // Call if pot odds are favorable
      if (canCall && potOdds < handStrength * 0.8) {
        return { action: BetAction.CALL, amount: 0 };
      }
      if (canFold) {
        return { action: BetAction.FOLD, amount: 0 };
      }
    }

    // Bluff opportunities: In position with weakness shown
    if (position > 0.7 && canRaise && Math.random() < 0.15) {
      // Occasional bluff
      const bluffAmount = Math.min(pot * 0.5, playerChips, minRaise);
      return { action: raiseAction, amount: Math.floor(bluffAmount) };
    }

    // Weak hands: Check or fold
    if (canCheck) {
      return { action: BetAction.CHECK, amount: 0 };
    }
    if (canFold) {
      return { action: BetAction.FOLD, amount: 0 };
    }
    return { action: BetAction.CALL, amount: 0 };
  }

  /**
   * Calculate hand strength (0-100) for Texas Hold'em
   */
  calculateHandStrength(hand, gameState) {
    if (!hand || hand.length !== 2) return 0;

    const communityCards = gameState.communityCards || [];
    return TexasHoldemHandEvaluator.calculateHandStrength(hand, communityCards);
  }

  /**
   * Calculate position advantage (0-1, higher = later position)
   */
  calculatePosition(gameState, player) {
    const players = gameState.players || [];
    const activePlayers = players.filter(p => p.status === 'active' || p.status === 'all-in');
    if (activePlayers.length <= 1) return 0.5;

    const playerIndex = players.findIndex(p => p.uid === player.uid);
    const dealerIndex = gameState.dealerSeatIndex || 0;

    // Calculate how far the player is from the dealer (later = better position)
    const distanceFromDealer = (playerIndex - dealerIndex + players.length) % players.length;
    return distanceFromDealer / players.length;
  }
}
