const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_TYPES = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  TRIPS: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  QUADS: 8,
  STRAIGHT_FLUSH: 9
};

export class HandEvaluator {
  static evaluate(cards) {
    if (cards.length !== 5) throw new Error("Hand must have 5 cards");
    const values = cards.map(c => RANKS[c.rank]).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.checkStraight(values);
    const counts = this.getCounts(values);

    let category = HAND_TYPES.HIGH_CARD;
    const distinctCounts = Object.values(counts).sort((a, b) => b - a);

    if (isStraight && isFlush) category = HAND_TYPES.STRAIGHT_FLUSH;
    else if (distinctCounts[0] === 4) category = HAND_TYPES.QUADS;
    else if (distinctCounts[0] === 3 && distinctCounts[1] === 2) category = HAND_TYPES.FULL_HOUSE;
    else if (isFlush) category = HAND_TYPES.FLUSH;
    else if (isStraight) category = HAND_TYPES.STRAIGHT;
    else if (distinctCounts[0] === 3) category = HAND_TYPES.TRIPS;
    else if (distinctCounts[0] === 2 && distinctCounts[1] === 2) category = HAND_TYPES.TWO_PAIR;
    else if (distinctCounts[0] === 2) category = HAND_TYPES.PAIR;
    else category = HAND_TYPES.HIGH_CARD;

    const sortedForTieBreak = this.sortForTieBreak(values, counts);
    let scoreString = `${category}`;
    sortedForTieBreak.forEach(val => {
      scoreString += val.toString().padStart(2, '0');
    });

    return {
      score: scoreString,
      categoryName: this.getCategoryName(category),
      display: this.getHandDisplay(values)
    };
  }

  static checkStraight(sortedValues) {
    const unique = [...new Set(sortedValues)];
    if (unique.length !== 5) return false;
    return (sortedValues[0] - sortedValues[4] === 4);
  }

  static getCounts(values) {
    return values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  static sortForTieBreak(values, counts) {
    return [...values].sort((a, b) => {
      const countDiff = counts[b] - counts[a];
      if (countDiff !== 0) return countDiff;
      return b - a;
    });
  }

  static getCategoryName(catVal) {
    return Object.keys(HAND_TYPES).find(key => HAND_TYPES[key] === catVal);
  }

  static getHandDisplay(values) {
    const map = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    return values.map(v => map[v] || v).join('-');
  }
}
