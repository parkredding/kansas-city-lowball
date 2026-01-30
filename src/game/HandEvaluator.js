// 2-7 Lowball Hand Evaluator
// In 2-7 Lowball: lowest hand wins, aces are always high, straights and flushes count against you
// Best possible hand: 7-5-4-3-2 of mixed suits (called "the wheel" or "number one")

const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// Lower category number = better hand in 2-7 Lowball
const HAND_TYPES = {
  HIGH_CARD: 1,      // Best category - no pairs, no straights, no flushes
  PAIR: 2,
  TWO_PAIR: 3,
  TRIPS: 4,
  STRAIGHT: 5,       // Counts against you in 2-7
  FLUSH: 6,          // Counts against you in 2-7
  FULL_HOUSE: 7,
  QUADS: 8,
  STRAIGHT_FLUSH: 9  // Worst possible category
};

export class HandEvaluator {
  static evaluate(cards) {
    if (cards.length !== 5) throw new Error("Hand must have 5 cards");

    // In 2-7 Lowball, Aces are always high (value 14)
    const values = cards.map(c => RANKS[c.rank]).sort((a, b) => a - b);
    const suits = cards.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.checkStraight(values);
    const counts = this.getCounts(values);

    let category;
    const distinctCounts = Object.values(counts).sort((a, b) => b - a);

    // Determine hand category (straights and flushes count against you in 2-7)
    if (isStraight && isFlush) category = HAND_TYPES.STRAIGHT_FLUSH;
    else if (distinctCounts[0] === 4) category = HAND_TYPES.QUADS;
    else if (distinctCounts[0] === 3 && distinctCounts[1] === 2) category = HAND_TYPES.FULL_HOUSE;
    else if (isFlush) category = HAND_TYPES.FLUSH;
    else if (isStraight) category = HAND_TYPES.STRAIGHT;
    else if (distinctCounts[0] === 3) category = HAND_TYPES.TRIPS;
    else if (distinctCounts[0] === 2 && distinctCounts[1] === 2) category = HAND_TYPES.TWO_PAIR;
    else if (distinctCounts[0] === 2) category = HAND_TYPES.PAIR;
    else category = HAND_TYPES.HIGH_CARD;

    // Build score string for comparison
    // Lower score = better hand in 2-7 Lowball
    // Format: category (1 digit) + card values sorted for tie-breaking (2 digits each)
    const sortedForScore = this.sortForTieBreak(values, counts, category);
    let scoreString = `${category}`;
    sortedForScore.forEach(val => {
      scoreString += val.toString().padStart(2, '0');
    });

    return {
      score: scoreString,
      categoryName: this.getCategoryName(category),
      display: this.getHandDisplay(values),
      isGoodLowballHand: category === HAND_TYPES.HIGH_CARD,
      values: sortedForScore,
      category
    };
  }

  static checkStraight(sortedValues) {
    const unique = [...new Set(sortedValues)];
    if (unique.length !== 5) return false;

    // Check for regular straight (5 consecutive values)
    if (sortedValues[4] - sortedValues[0] === 4) return true;

    // In 2-7 Lowball, A-2-3-4-5 is NOT a straight because Ace is always high
    return false;
  }

  static getCounts(values) {
    return values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Sort cards for tie-breaking in 2-7 Lowball
   *
   * KEY PRINCIPLE: In lowball, LOWER values are BETTER.
   * When comparing score strings, we want the hand with lower cards to produce
   * a lower (better) score string.
   *
   * For HIGH_CARD: Sort from highest to lowest card. The hand with the lower
   * high card wins. If tied, compare next highest, etc.
   * Example: 8-7-5-3-2 beats 9-6-4-3-2 because 8 < 9
   *
   * For PAIR: The lower pair wins. Put pair value first, then kickers high to low.
   * Example: Pair of 3s (33-8-6-4) beats Pair of 7s (77-6-5-2)
   * Score: "2_03_08_06_04" < "2_07_06_05_02" (lower pair = lower score = better)
   *
   * For TWO_PAIR: Lower high pair wins, then lower low pair, then kicker.
   * Put pairs in order (higher pair first for comparison), then kicker.
   *
   * For TRIPS/QUADS: Lower trips value wins.
   *
   * For STRAIGHTS/FLUSHES: Lower high card wins (but these are bad hands anyway).
   */
  static sortForTieBreak(values, counts, category) {
    const result = [];

    // Group values by their count
    const grouped = {};
    for (const [val, count] of Object.entries(counts)) {
      if (!grouped[count]) grouped[count] = [];
      grouped[count].push(parseInt(val));
    }

    // Sort each group (lower values are better in lowball, but we still
    // need to compare properly - higher values first for proper string comparison)
    for (const count in grouped) {
      grouped[count].sort((a, b) => b - a); // Sort descending within each group
    }

    switch (category) {
      case HAND_TYPES.HIGH_CARD:
      case HAND_TYPES.FLUSH:
      case HAND_TYPES.STRAIGHT:
      case HAND_TYPES.STRAIGHT_FLUSH:
        // Sort all cards from highest to lowest
        // Lower high card = lower score = better
        return [...values].sort((a, b) => b - a);

      case HAND_TYPES.PAIR:
        // Pair value first (lower pair = better), then kickers high to low
        result.push(...grouped[2]); // The pair value
        result.push(...(grouped[1] || []).sort((a, b) => b - a)); // Kickers
        return result;

      case HAND_TYPES.TWO_PAIR:
        // Higher pair first, lower pair second, then kicker
        // (In comparison, lower higher-pair wins)
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

  static getCategoryName(catVal) {
    return Object.keys(HAND_TYPES).find(key => HAND_TYPES[key] === catVal);
  }

  static getHandDisplay(values) {
    const map = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    // Display from high to low
    return [...values].sort((a, b) => b - a).map(v => map[v] || v).join('-');
  }

  // Compare two hands - returns negative if hand1 wins, positive if hand2 wins, 0 if tie
  static compare(hand1Result, hand2Result) {
    // Lower score wins in 2-7 Lowball
    if (hand1Result.score < hand2Result.score) return -1;
    if (hand1Result.score > hand2Result.score) return 1;
    return 0;
  }

  // Check if this is the best possible hand (7-5-4-3-2 unsuited)
  static isNumberOne(cards) {
    const values = cards.map(c => RANKS[c.rank]).sort((a, b) => a - b);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    // Must not be a flush and must be exactly 2-3-4-5-7
    return !isFlush &&
           values[0] === 2 &&
           values[1] === 3 &&
           values[2] === 4 &&
           values[3] === 5 &&
           values[4] === 7;
  }

  // Get a descriptive name for the hand
  static getHandDescription(result) {
    const map = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const rankName = (v) => map[v] || v.toString();

    switch (result.category) {
      case HAND_TYPES.HIGH_CARD:
        return `${rankName(result.values[0])} high`;
      case HAND_TYPES.PAIR:
        return `Pair of ${rankName(result.values[0])}s`;
      case HAND_TYPES.TWO_PAIR:
        return `Two pair: ${rankName(result.values[0])}s and ${rankName(result.values[1])}s`;
      case HAND_TYPES.TRIPS:
        return `Three ${rankName(result.values[0])}s`;
      case HAND_TYPES.STRAIGHT:
        return `Straight to ${rankName(result.values[0])}`;
      case HAND_TYPES.FLUSH:
        return `Flush, ${rankName(result.values[0])} high`;
      case HAND_TYPES.FULL_HOUSE:
        return `Full house: ${rankName(result.values[0])}s over ${rankName(result.values[1])}s`;
      case HAND_TYPES.QUADS:
        return `Four ${rankName(result.values[0])}s`;
      case HAND_TYPES.STRAIGHT_FLUSH:
        return `Straight flush to ${rankName(result.values[0])}`;
      default:
        return result.display;
    }
  }
}
