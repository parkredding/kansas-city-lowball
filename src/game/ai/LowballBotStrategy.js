import { BotStrategy } from './BotStrategy';
import { HandEvaluator } from '../HandEvaluator';
import { BetAction } from '../GameService';
import {
  decideHardSingleDrawDiscard,
  calculateEquityStrength,
  decideHardSingleDrawBet,
} from './SingleDrawEquity';

const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

/**
 * Bot Strategy for Kansas City Lowball (2-7 Triple Draw & Single Draw)
 *
 * Hard difficulty in Single Draw uses an equity-based algorithm that models:
 * - Three equity states: Pat vs Pat, Draw vs Draw, Pat vs Draw
 * - Smoothness (gap equity) for draw quality assessment
 * - Blocker effects (holding key low cards)
 * - Snowing (standing pat with garbage to represent strength)
 * - Breaking made hands when draw equity exceeds pat equity
 * - Pot odds and fold equity calculations
 */
export class LowballBotStrategy extends BotStrategy {

  /**
   * Check if we're playing single draw (vs triple draw)
   */
  isSingleDraw(gameState) {
    const gameType = gameState?.config?.gameType;
    return gameType === 'single_draw_27';
  }

  /**
   * Decide which cards to discard
   */
  decideDiscard(hand, gameState, player, difficulty) {
    if (!hand || hand.length !== 5) return [];

    // Hard single draw bots use the equity-based algorithm
    if (difficulty === 'hard' && this.isSingleDraw(gameState)) {
      return decideHardSingleDrawDiscard(hand, gameState, player);
    }

    const handResult = HandEvaluator.evaluate(hand);
    const values = hand.map(c => RANKS[c.rank]).sort((a, b) => a - b);

    // Check for pat hands (7, 8, 9, or T-high)
    const highCard = values[4];
    if (handResult.isGoodLowballHand && highCard <= 10) {
      // Stand pat on 7, 8, 9, or T-high hands (all difficulties)
      return [];
    }

    // Easy difficulty: More conservative/random decisions
    if (difficulty === 'easy') {
      // Sometimes stand pat even on marginal hands (20% chance)
      if (handResult.isGoodLowballHand && highCard <= 11 && Math.random() < 0.2) {
        return [];
      }

      // Randomly decide how many cards to discard (1-3)
      const numToDiscard = Math.floor(Math.random() * 3) + 1;

      // Find high cards (9 or higher)
      const highCards = hand
        .map((c, i) => ({ card: c, index: i, value: RANKS[c.rank] }))
        .filter(({ value }) => value >= 9)
        .sort((a, b) => b.value - a.value);

      // If we have pairs, sometimes discard them randomly
      const counts = this.getCounts(values);
      const hasPair = Object.values(counts).some(c => c >= 2);

      if (hasPair && Math.random() < 0.5) {
        // Discard from pairs randomly
        const pairCards = Object.entries(counts)
          .filter(([val, count]) => count >= 2)
          .map(([val]) => parseInt(val))
          .sort((a, b) => b - a);

        if (pairCards.length > 0) {
          const pairRank = Object.keys(RANKS).find(k => RANKS[k] === pairCards[0]);
          const pairIndices = hand
            .map((c, i) => c.rank === pairRank ? i : -1)
            .filter(i => i !== -1);
          return pairIndices.slice(0, Math.min(numToDiscard, pairIndices.length));
        }
      }

      // Otherwise, discard random high cards
      const allCards = hand
        .map((c, i) => ({ card: c, index: i, value: RANKS[c.rank] }))
        .sort((a, b) => b.value - a.value);

      return allCards.slice(0, numToDiscard).map(({ index }) => index);
    }

    // Medium/Hard difficulty: Optimal strategy
    // 1-Card Draw: If holding 4 cards to a 9-low or better, discard the high card
    if (handResult.isGoodLowballHand && highCard > 10) {
      // Find the highest card index
      const highCardValue = Math.max(...values);
      const highCardIndex = hand.findIndex(c => RANKS[c.rank] === highCardValue);
      return [highCardIndex];
    }

    // Breaking pairs: If holding a pair of 2s/3s/4s and other cards are low
    const counts = this.getCounts(values);
    const pairs = Object.entries(counts).filter(([val, count]) => count === 2);

    if (pairs.length > 0) {
      const pairValue = parseInt(pairs[0][0]);
      if (pairValue <= 4) {
        // Check if other cards are low (all below 9)
        const nonPairValues = values.filter(v => v !== pairValue);
        if (nonPairValues.every(v => v < 9)) {
          // Discard one of the pair
          const pairRank = Object.keys(RANKS).find(k => RANKS[k] === pairValue);
          const pairIndices = hand
            .map((c, i) => c.rank === pairRank ? i : -1)
            .filter(i => i !== -1);
          return [pairIndices[0]]; // Discard one card from the pair
        }
      }
    }

    // Default: discard highest cards that aren't part of a good lowball structure
    // Find cards that are 9 or higher
    const highCards = hand
      .map((c, i) => ({ card: c, index: i, value: RANKS[c.rank] }))
      .filter(({ value }) => value >= 9)
      .sort((a, b) => b.value - a.value);

    // If we have pairs or trips, discard those first
    const hasPair = Object.values(counts).some(c => c >= 2);
    if (hasPair) {
      // Find pair/trip cards
      const pairCards = Object.entries(counts)
        .filter(([val, count]) => count >= 2)
        .map(([val]) => parseInt(val))
        .sort((a, b) => b - a); // Highest pairs first

      if (pairCards.length > 0) {
        const pairRank = Object.keys(RANKS).find(k => RANKS[k] === pairCards[0]);
        const pairIndices = hand
          .map((c, i) => c.rank === pairRank ? i : -1)
          .filter(i => i !== -1);
        return pairIndices.slice(0, Math.min(2, pairIndices.length));
      }
    }

    // Otherwise, discard highest cards
    return highCards.slice(0, Math.min(3, highCards.length)).map(({ index }) => index);
  }

  /**
   * Decide betting action
   */
  decideBet(hand, gameState, player, legalActions, difficulty) {
    // Hard single draw bots use equity-based betting
    if (difficulty === 'hard' && this.isSingleDraw(gameState)) {
      return this.decideBetHardSingleDraw(hand, gameState, player, legalActions);
    }

    const handStrength = this.calculateHandStrength(hand, gameState);
    const currentBet = gameState.currentBet || 0;
    const playerBet = player.currentRoundBet || 0;
    const callAmount = Math.max(0, currentBet - playerBet);
    const playerChips = player.chips || 0;
    const minBet = gameState.minBet || 50;
    const minRaise = currentBet + minBet;
    // Use BET when no current bet, RAISE when facing a bet
    const raiseAction = currentBet === 0 ? BetAction.BET : BetAction.RAISE;

    // Determine available actions
    const canCheck = legalActions.includes(BetAction.CHECK);
    const canCall = legalActions.includes(BetAction.CALL) && callAmount > 0;
    const canRaise = legalActions.includes(BetAction.RAISE) || legalActions.includes(BetAction.BET);
    const canFold = legalActions.includes(BetAction.FOLD);

    if (difficulty === 'easy') {
      // Tourist: Random behavior
      const rand = Math.random();
      if (rand < 0.2 && canFold) {
        return { action: BetAction.FOLD, amount: 0 };
      } else if (rand < 0.8 && (canCheck || canCall)) {
        return { action: canCheck ? BetAction.CHECK : BetAction.CALL, amount: 0 };
      } else if (canRaise) {
        const raiseAmount = Math.min(minRaise, playerChips);
        return { action: raiseAction, amount: raiseAmount };
      } else if (canCheck) {
        return { action: BetAction.CHECK, amount: 0 };
      } else {
        return { action: BetAction.FOLD, amount: 0 };
      }
    } else {
      // Pro: Hand strength based (medium difficulty, or hard triple draw)
      const handResult = HandEvaluator.evaluate(hand);
      const isSnow = this.isSnowHand(hand, handResult);

      // Bluff: 10% chance to raise big when holding snow
      if (isSnow && Math.random() < 0.1 && canRaise) {
        const bluffRaise = Math.min(minRaise * 2, playerChips);
        return { action: raiseAction, amount: bluffRaise };
      }

      // Strength > 80 (Pat 8 or better): Aggressive Raise
      if (handStrength > 80 && canRaise) {
        const raiseAmount = Math.min(minRaise * 1.5, playerChips);
        return { action: raiseAction, amount: Math.floor(raiseAmount) };
      }

      // Strength < 40 (Drawing 2+ cards): Fold to any raise
      if (handStrength < 40) {
        if (callAmount > 0 && canFold) {
          return { action: BetAction.FOLD, amount: 0 };
        } else if (canCheck) {
          return { action: BetAction.CHECK, amount: 0 };
        } else {
          return { action: BetAction.CALL, amount: 0 };
        }
      }

      // Medium strength: Call/Check
      if (handStrength >= 40 && handStrength <= 80) {
        if (canCheck) {
          return { action: BetAction.CHECK, amount: 0 };
        } else if (canCall && callAmount <= playerChips * 0.2) {
          // Only call if it's a small bet relative to stack
          return { action: BetAction.CALL, amount: 0 };
        } else if (canFold) {
          return { action: BetAction.FOLD, amount: 0 };
        }
      }

      // Default: Check or Call
      if (canCheck) {
        return { action: BetAction.CHECK, amount: 0 };
      } else if (canCall) {
        return { action: BetAction.CALL, amount: 0 };
      } else {
        return { action: BetAction.FOLD, amount: 0 };
      }
    }
  }

  /**
   * Hard single draw betting using equity-based algorithm.
   *
   * Uses the three equity states:
   * - Pat vs Pat: static equity, value bet strong hands
   * - Draw vs Draw: smooth draws are favorites, bet accordingly
   * - Pat vs Draw: mediocre pat hands are often underdogs to premium draws
   *
   * Also incorporates:
   * - Pot odds calculations
   * - Fold equity (snowing)
   * - Position awareness
   * - Opponent range estimation based on draw count
   */
  decideBetHardSingleDraw(hand, gameState, player, legalActions) {
    const isPreDraw = gameState.phase === 'BETTING_1';
    let discardIndices;

    if (isPreDraw) {
      // Pre-draw: determine what we WILL discard to evaluate draw strength
      discardIndices = decideHardSingleDrawDiscard(hand, gameState, player);
    } else {
      // Post-draw: use actual draw count from the draw phase
      // player.cardsDrawn is set after the draw; we create a dummy array of
      // the correct length because calculateEquityStrength uses its length
      // to determine if the bot stood pat, drew one, etc.
      const drawCount = player.cardsDrawn ?? 0;
      discardIndices = Array.from({ length: drawCount });
    }

    // Calculate equity-aware hand strength
    const equityResult = calculateEquityStrength(hand, gameState, player, discardIndices);

    // Delegate to the equity-based betting decision
    return decideHardSingleDrawBet(hand, gameState, player, legalActions, equityResult, BetAction);
  }

  /**
   * Calculate hand strength (0-100) for Kansas City Lowball
   */
  calculateHandStrength(hand, gameState) {
    if (!hand || hand.length !== 5) return 0;

    const handResult = HandEvaluator.evaluate(hand);
    const values = hand.map(c => RANKS[c.rank]).sort((a, b) => a - b);

    // Base strength from hand category
    let strength = 0;

    if (handResult.isGoodLowballHand) {
      // High card hands - lower high card = better
      const highCard = values[4];

      // Best possible: 7-high (7-5-4-3-2)
      if (highCard === 7 && values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5) {
        strength = 100;
      } else if (highCard === 7) {
        strength = 90;
      } else if (highCard === 8) {
        strength = 80;
      } else if (highCard === 9) {
        strength = 70;
      } else if (highCard === 10) {
        strength = 60;
      } else {
        // J, Q, K, A high - still a high card but not great
        strength = 50;
      }
    } else {
      // Has pairs, trips, straights, flushes - all bad in lowball
      switch (handResult.category) {
        case 2: // PAIR
          strength = 30;
          break;
        case 3: // TWO_PAIR
          strength = 20;
          break;
        case 4: // TRIPS
          strength = 15;
          break;
        case 5: // STRAIGHT
          strength = 10;
          break;
        case 6: // FLUSH
          strength = 5;
          break;
        default:
          strength = 0;
      }
    }

    // Adjust based on drawing potential
    // If we need to draw 2+ cards, reduce strength
    const discardIndices = this.decideDiscard(hand, gameState, {}, 'hard');
    if (discardIndices.length >= 2) {
      strength -= 20;
    } else if (discardIndices.length === 1) {
      strength -= 10;
    }

    return Math.max(0, Math.min(100, strength));
  }

  /**
   * Check if hand is "snow" (total trash - pairs, trips, high cards)
   */
  isSnowHand(hand, handResult) {
    if (handResult.isGoodLowballHand) {
      const values = hand.map(c => RANKS[c.rank]);
      const highCard = Math.max(...values);
      // Snow if high card is J or higher
      return highCard >= 11;
    }
    // Any pair, trips, or worse is snow
    return handResult.category >= 2;
  }

  /**
   * Helper to count card values
   */
  getCounts(values) {
    return values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }
}
