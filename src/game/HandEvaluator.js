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
    // Format: category (1 digit) + card values from high to low (2 digits each)
    const sortedForScore = this.sortForLowball(values, counts);
    let scoreString = `${category}`;
    sortedForScore.forEach(val => {
      scoreString += val.toString().padStart(2, '0');
    });

    return {
      score: scoreString,
      categoryName: this.getCategoryName(category),
      display: this.getHandDisplay(values),
      isGoodLowballHand: category === HAND_TYPES.HIGH_CARD
    };
  }

  static checkStraight(sortedValues) {
    const unique = [...new Set(sortedValues)];
    if (unique.length !== 5) return false;

    // Check for regular straight (5 consecutive values)
    if (sortedValues[4] - sortedValues[0] === 4) return true;

    // Check for A-2-3-4-5 wheel straight (Ace plays high in 2-7, so this is A-5-4-3-2)
    // In 2-7 Lowball, A-2-3-4-5 is NOT a straight because Ace is always high
    // So we only check for regular consecutive straights
    return false;
  }

  static getCounts(values) {
    return values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  // Sort for 2-7 Lowball scoring
  // For pairs/trips/etc: put paired cards first (bad), then remaining cards low to high
  // For high card hands: sort high to low (we want lowest high card)
  static sortForLowball(values, counts) {
    return [...values].sort((a, b) => {
      const countDiff = counts[b] - counts[a];
      if (countDiff !== 0) return countDiff;
      // For same count, higher value is worse in lowball
      return b - a;
    });
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
}
