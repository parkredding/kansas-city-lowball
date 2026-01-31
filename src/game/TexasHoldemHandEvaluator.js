// Texas Hold'em Hand Evaluator
// In Texas Hold'em: highest hand wins, Aces can be high or low for straights
// Best possible hand: Royal Flush (A-K-Q-J-T suited)

const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// Higher category number = better hand in Texas Hold'em
const HAND_TYPES = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  TRIPS: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  QUADS: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10  // Special case of straight flush
};

export class TexasHoldemHandEvaluator {
  /**
   * Evaluate the best 5-card hand from available cards
   * @param {Array} cards - Array of card objects (2-7 cards)
   * @returns {Object} - { score, categoryName, display, category, bestHand }
   */
  static evaluate(cards) {
    if (!cards || cards.length < 5) {
      throw new Error("Need at least 5 cards to evaluate");
    }

    // If exactly 5 cards, evaluate directly
    if (cards.length === 5) {
      return this.evaluateFiveCards(cards);
    }

    // For 6-7 cards (Hold'em), find the best 5-card combination
    const combinations = this.getCombinations(cards, 5);
    let bestResult = null;

    for (const combo of combinations) {
      const result = this.evaluateFiveCards(combo);
      if (!bestResult || result.score > bestResult.score) {
        bestResult = result;
      }
    }

    return bestResult;
  }

  /**
   * Evaluate exactly 5 cards
   */
  static evaluateFiveCards(cards) {
    if (cards.length !== 5) throw new Error("Must have exactly 5 cards");

    const values = cards.map(c => RANKS[c.rank]).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const straightInfo = this.checkStraight(values);
    const isStraight = straightInfo.isStraight;
    const straightHighCard = straightInfo.highCard;
    const counts = this.getCounts(values);

    let category;
    const distinctCounts = Object.values(counts).sort((a, b) => b - a);

    // Determine hand category
    if (isStraight && isFlush) {
      if (straightHighCard === 14) {
        category = HAND_TYPES.ROYAL_FLUSH;
      } else {
        category = HAND_TYPES.STRAIGHT_FLUSH;
      }
    } else if (distinctCounts[0] === 4) {
      category = HAND_TYPES.QUADS;
    } else if (distinctCounts[0] === 3 && distinctCounts[1] === 2) {
      category = HAND_TYPES.FULL_HOUSE;
    } else if (isFlush) {
      category = HAND_TYPES.FLUSH;
    } else if (isStraight) {
      category = HAND_TYPES.STRAIGHT;
    } else if (distinctCounts[0] === 3) {
      category = HAND_TYPES.TRIPS;
    } else if (distinctCounts[0] === 2 && distinctCounts[1] === 2) {
      category = HAND_TYPES.TWO_PAIR;
    } else if (distinctCounts[0] === 2) {
      category = HAND_TYPES.PAIR;
    } else {
      category = HAND_TYPES.HIGH_CARD;
    }

    // Build score string for comparison
    // Higher score = better hand in Texas Hold'em
    // Format: category (2 digits) + card values sorted for tie-breaking (2 digits each)
    const sortedForScore = this.sortForTieBreak(values, counts, category, straightHighCard);
    let scoreString = category.toString().padStart(2, '0');
    sortedForScore.forEach(val => {
      scoreString += val.toString().padStart(2, '0');
    });

    return {
      score: scoreString,
      categoryName: this.getCategoryName(category),
      display: this.getHandDisplay(values),
      category,
      values: sortedForScore,
      bestHand: cards
    };
  }

  /**
   * Check for straight, including wheel (A-2-3-4-5)
   */
  static checkStraight(sortedValues) {
    const unique = [...new Set(sortedValues)].sort((a, b) => b - a);
    if (unique.length !== 5) return { isStraight: false, highCard: 0 };

    // Check for regular straight (5 consecutive values)
    if (unique[0] - unique[4] === 4) {
      return { isStraight: true, highCard: unique[0] };
    }

    // Check for wheel (A-2-3-4-5) - Ace plays as 1
    if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      return { isStraight: true, highCard: 5 }; // 5-high straight
    }

    return { isStraight: false, highCard: 0 };
  }

  static getCounts(values) {
    return values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Sort cards for tie-breaking in Texas Hold'em
   * Higher values are better, so we sort descending
   */
  static sortForTieBreak(values, counts, category, straightHighCard = 0) {
    const result = [];

    // Group values by their count
    const grouped = {};
    for (const [val, count] of Object.entries(counts)) {
      if (!grouped[count]) grouped[count] = [];
      grouped[count].push(parseInt(val));
    }

    // Sort each group descending (higher is better)
    for (const count in grouped) {
      grouped[count].sort((a, b) => b - a);
    }

    switch (category) {
      case HAND_TYPES.ROYAL_FLUSH:
      case HAND_TYPES.STRAIGHT_FLUSH:
      case HAND_TYPES.STRAIGHT:
        // Just the high card matters for straights
        return [straightHighCard];

      case HAND_TYPES.HIGH_CARD:
      case HAND_TYPES.FLUSH:
        // All cards from highest to lowest
        return [...values].sort((a, b) => b - a);

      case HAND_TYPES.PAIR:
        // Pair value first, then kickers high to low
        result.push(...grouped[2]);
        result.push(...(grouped[1] || []).sort((a, b) => b - a));
        return result;

      case HAND_TYPES.TWO_PAIR:
        // Higher pair first, lower pair second, then kicker
        const pairs = grouped[2].sort((a, b) => b - a);
        result.push(...pairs);
        result.push(...(grouped[1] || []));
        return result;

      case HAND_TYPES.TRIPS:
        // Trips value first, then kickers high to low
        result.push(...grouped[3]);
        result.push(...(grouped[1] || []).sort((a, b) => b - a));
        return result;

      case HAND_TYPES.FULL_HOUSE:
        // Trips value first, then pair value
        result.push(...grouped[3]);
        result.push(...grouped[2]);
        return result;

      case HAND_TYPES.QUADS:
        // Quads value first, then kicker
        result.push(...grouped[4]);
        result.push(...(grouped[1] || []));
        return result;

      default:
        return [...values].sort((a, b) => b - a);
    }
  }

  /**
   * Get all combinations of k elements from an array
   */
  static getCombinations(arr, k) {
    const result = [];

    function combine(start, combo) {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }

    combine(0, []);
    return result;
  }

  static getCategoryName(catVal) {
    return Object.keys(HAND_TYPES).find(key => HAND_TYPES[key] === catVal);
  }

  static getHandDisplay(values) {
    const map = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    // Display from high to low
    return [...values].sort((a, b) => b - a).map(v => map[v] || v).join('-');
  }

  /**
   * Compare two hands - returns positive if hand1 wins, negative if hand2 wins, 0 if tie
   */
  static compare(hand1Result, hand2Result) {
    // Higher score wins in Texas Hold'em
    if (hand1Result.score > hand2Result.score) return 1;
    if (hand1Result.score < hand2Result.score) return -1;
    return 0;
  }

  /**
   * Get a descriptive name for the hand
   */
  static getHandDescription(result) {
    const map = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const rankName = (v) => {
      if (v === 14) return 'Ace';
      if (v === 13) return 'King';
      if (v === 12) return 'Queen';
      if (v === 11) return 'Jack';
      if (v === 10) return 'Ten';
      return v.toString();
    };
    const pluralize = (v) => {
      if (v === 6) return 'Sixes';
      return rankName(v) + 's';
    };

    switch (result.category) {
      case HAND_TYPES.ROYAL_FLUSH:
        return 'Royal Flush';
      case HAND_TYPES.STRAIGHT_FLUSH:
        return `Straight Flush, ${rankName(result.values[0])} high`;
      case HAND_TYPES.QUADS:
        return `Four ${pluralize(result.values[0])}`;
      case HAND_TYPES.FULL_HOUSE:
        return `Full House, ${pluralize(result.values[0])} over ${pluralize(result.values[1])}`;
      case HAND_TYPES.FLUSH:
        return `Flush, ${rankName(result.values[0])} high`;
      case HAND_TYPES.STRAIGHT:
        return `Straight, ${rankName(result.values[0])} high`;
      case HAND_TYPES.TRIPS:
        return `Three ${pluralize(result.values[0])}`;
      case HAND_TYPES.TWO_PAIR:
        return `Two Pair, ${pluralize(result.values[0])} and ${pluralize(result.values[1])}`;
      case HAND_TYPES.PAIR:
        return `Pair of ${pluralize(result.values[0])}`;
      case HAND_TYPES.HIGH_CARD:
        return `${rankName(result.values[0])} high`;
      default:
        return result.display;
    }
  }

  /**
   * Calculate hand strength as a percentage (0-100)
   * Useful for bot AI decisions
   */
  static calculateHandStrength(holeCards, communityCards = []) {
    const allCards = [...holeCards, ...communityCards];

    if (allCards.length < 2) return 0;

    // Pre-flop: Use starting hand strength
    if (communityCards.length === 0) {
      return this.calculatePreflopStrength(holeCards);
    }

    // Post-flop: Evaluate actual hand strength
    if (allCards.length >= 5) {
      const result = this.evaluate(allCards);
      return this.categoryToStrength(result.category, result.values);
    }

    return 50; // Default for incomplete info
  }

  /**
   * Calculate pre-flop hand strength based on hole cards
   */
  static calculatePreflopStrength(holeCards) {
    if (holeCards.length !== 2) return 0;

    const v1 = RANKS[holeCards[0].rank];
    const v2 = RANKS[holeCards[1].rank];
    const high = Math.max(v1, v2);
    const low = Math.min(v1, v2);
    const suited = holeCards[0].suit === holeCards[1].suit;
    const isPair = v1 === v2;

    // Premium pairs
    if (isPair) {
      if (high >= 13) return 95; // AA, KK
      if (high >= 11) return 85; // QQ, JJ
      if (high >= 9) return 75;  // TT, 99
      return 60 + high * 2;      // Lower pairs
    }

    // Premium suited connectors and broadway
    if (high === 14) { // Ace-x
      if (low >= 13) return suited ? 90 : 85; // AK
      if (low >= 12) return suited ? 80 : 75; // AQ
      if (low >= 11) return suited ? 75 : 65; // AJ
      if (low >= 10) return suited ? 70 : 60; // AT
      return suited ? 55 : 40; // Ax suited/offsuit
    }

    if (high === 13 && low >= 11) return suited ? 75 : 65; // KQ, KJ
    if (high === 12 && low >= 11) return suited ? 65 : 55; // QJ

    // Suited connectors
    if (suited && high - low === 1) {
      if (high >= 10) return 60;
      return 45;
    }

    // Suited cards
    if (suited) {
      return 35 + high;
    }

    // Connected cards
    if (high - low <= 2) {
      return 30 + high;
    }

    // Garbage
    return 20 + (high + low) / 2;
  }

  /**
   * Convert hand category to strength percentage
   */
  static categoryToStrength(category, values) {
    const baseStrength = {
      [HAND_TYPES.ROYAL_FLUSH]: 100,
      [HAND_TYPES.STRAIGHT_FLUSH]: 98,
      [HAND_TYPES.QUADS]: 95,
      [HAND_TYPES.FULL_HOUSE]: 90,
      [HAND_TYPES.FLUSH]: 82,
      [HAND_TYPES.STRAIGHT]: 75,
      [HAND_TYPES.TRIPS]: 65,
      [HAND_TYPES.TWO_PAIR]: 55,
      [HAND_TYPES.PAIR]: 40,
      [HAND_TYPES.HIGH_CARD]: 20
    };

    let strength = baseStrength[category] || 20;

    // Adjust based on high cards within category
    if (values && values.length > 0) {
      strength += (values[0] - 7) / 2; // Slight boost for higher cards
    }

    return Math.min(100, Math.max(0, strength));
  }
}

export { HAND_TYPES };
