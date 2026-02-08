/**
 * Equity Calculator for 2-7 No Limit Single Draw (Kansas City Lowball)
 *
 * Core concepts:
 * - Hand equity = probability your hand will be lowest (best) at showdown
 * - Three equity states: Pat vs Pat, Draw vs Draw, Pat vs Draw
 * - Smoothness (gap equity) heavily dictates draw quality
 * - Blockers: holding key low cards reduces opponent outs
 * - Single draw compresses all equity into one made-hand-vs-potential dynamic
 */

import { HandEvaluator } from '../HandEvaluator';

const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const RANK_CHARS = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const ALL_SUITS = ['h', 'd', 'c', 's'];

/**
 * Build the set of known cards (cards we can see are removed from the deck).
 * In single-player bot context we only know our own hand.
 */
function knownCards(hand) {
  const set = new Set();
  for (const c of hand) {
    set.add(`${c.rank}${c.suit}`);
  }
  return set;
}

/**
 * Build a list of remaining deck cards (unknown cards) given known cards.
 */
function remainingDeck(known) {
  const deck = [];
  for (let v = 2; v <= 14; v++) {
    for (const s of ALL_SUITS) {
      const key = `${RANK_CHARS[v]}${s}`;
      if (!known.has(key)) {
        deck.push({ rank: RANK_CHARS[v], suit: s, value: v });
      }
    }
  }
  return deck;
}

/**
 * Check if 5 sorted values form a straight.
 */
function isStraight(sorted) {
  if (new Set(sorted).size !== 5) return false;
  return sorted[4] - sorted[0] === 4;
}

/**
 * Check if 5 cards are all the same suit.
 */
function isFlush(suits) {
  return suits.every(s => s === suits[0]);
}

/**
 * Quick evaluate: returns true if the 5-card hand is a valid lowball hand
 * (no pairs, no straights, no flushes) and returns the high card value.
 * Returns null if the hand is not a clean high-card hand.
 */
function quickEvalHighCard(values, suits) {
  // Check for pairs
  const seen = new Set();
  for (const v of values) {
    if (seen.has(v)) return null;
    seen.add(v);
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (isStraight(sorted)) return null;
  if (isFlush(suits)) return null;
  return sorted[4]; // high card
}

/**
 * Calculate the "smoothness score" of a partial hand (the kept cards).
 * Lower is better. Measures how good the draw base is.
 *
 * Factors:
 * - High card of kept cards (lower = better)
 * - Number of gaps that could form straights (fewer = better)
 * - Suit concentration (more same suit = worse, flush risk)
 */
export function smoothnessScore(keptCards) {
  const values = keptCards.map(c => RANKS[c.rank]).sort((a, b) => a - b);
  const suits = keptCards.map(c => c.suit);

  // Base: high card of kept cards
  let score = values[values.length - 1];

  // Penalty for straight potential in kept cards
  // Check consecutive cards
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i + 1] - values[i] === 1) {
      score += 2; // Consecutive cards risk making a straight
    }
  }

  // Penalty for flush potential (3+ same suit out of 4 kept is dangerous)
  const suitCounts = {};
  for (const s of suits) {
    suitCounts[s] = (suitCounts[s] || 0) + 1;
  }
  const maxSuit = Math.max(...Object.values(suitCounts));
  if (maxSuit >= 3 && keptCards.length >= 4) {
    score += 3; // Risk of making a flush
  }

  return score;
}

/**
 * Calculate draw equity for a 1-card draw.
 * Returns probability (0-1) of making a hand that beats the target threshold.
 *
 * @param {Array} keptCards - The 4 cards being kept
 * @param {Set} known - Set of known card keys (our full hand)
 * @param {number} beatHighCard - The high-card value we need to beat (e.g., 9 = need 9-low or better)
 * @returns {Object} { equity, outs, totalCards, bestPossibleHigh, avgMadeHigh }
 */
export function calculateDrawOneEquity(keptCards, known, beatHighCard = 14) {
  const deck = remainingDeck(known);
  const keptValues = keptCards.map(c => RANKS[c.rank]);
  const keptSuits = keptCards.map(c => c.suit);

  let outs = 0;
  let madeCount = 0;
  let bestHigh = 14;
  let totalMadeHigh = 0;

  for (const card of deck) {
    const testValues = [...keptValues, card.value];
    const testSuits = [...keptSuits, card.suit];

    const highCard = quickEvalHighCard(testValues, testSuits);
    if (highCard !== null) {
      madeCount++;
      if (highCard < bestHigh) bestHigh = highCard;
      totalMadeHigh += highCard;

      if (highCard <= beatHighCard) {
        outs++;
      }
    }
  }

  return {
    equity: deck.length > 0 ? outs / deck.length : 0,
    outs,
    totalCards: deck.length,
    bestPossibleHigh: bestHigh,
    madeCount,
    avgMadeHigh: madeCount > 0 ? totalMadeHigh / madeCount : 14,
  };
}

/**
 * Calculate draw equity for a 2-card draw using sampling.
 * More expensive, so we sample a subset of combinations.
 *
 * @param {Array} keptCards - The 3 cards being kept
 * @param {Set} known - Set of known card keys
 * @param {number} beatHighCard - Target to beat
 * @returns {Object} { equity, sampleSize }
 */
export function calculateDrawTwoEquity(keptCards, known, beatHighCard = 14) {
  const deck = remainingDeck(known);
  const keptValues = keptCards.map(c => RANKS[c.rank]);
  const keptSuits = keptCards.map(c => c.suit);

  let hits = 0;
  let total = 0;
  const maxSamples = 200;

  // Sample random pairs from the deck
  if (deck.length < 2) return { equity: 0, sampleSize: 0 };

  // For small decks, enumerate all. For large, sample.
  const enumerate = deck.length <= 20;

  if (enumerate) {
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const testValues = [...keptValues, deck[i].value, deck[j].value];
        const testSuits = [...keptSuits, deck[i].suit, deck[j].suit];
        const highCard = quickEvalHighCard(testValues, testSuits);
        if (highCard !== null && highCard <= beatHighCard) {
          hits++;
        }
        total++;
      }
    }
  } else {
    for (let s = 0; s < maxSamples; s++) {
      const i = Math.floor(Math.random() * deck.length);
      let j = Math.floor(Math.random() * (deck.length - 1));
      if (j >= i) j++;
      const testValues = [...keptValues, deck[i].value, deck[j].value];
      const testSuits = [...keptSuits, deck[i].suit, deck[j].suit];
      const highCard = quickEvalHighCard(testValues, testSuits);
      if (highCard !== null && highCard <= beatHighCard) {
        hits++;
      }
      total++;
    }
  }

  return {
    equity: total > 0 ? hits / total : 0,
    sampleSize: total,
  };
}

/**
 * Estimate opponent's hand strength based on observable actions.
 *
 * @param {Object} gameState - The current table data
 * @param {Object} botPlayer - The bot player
 * @returns {Object} { opponentDrawCount, opponentLikelyPatStrength, opponentIsAggressive }
 */
export function estimateOpponentRange(gameState, botPlayer) {
  const players = gameState.players || [];
  const phase = gameState.phase || '';

  // Find active opponents (not folded, not the bot)
  const opponents = players.filter(p =>
    p && p.uid !== botPlayer.uid && p.status !== 'folded' && p.status !== 'sitting-out'
  );

  if (opponents.length === 0) {
    return { opponentDrawCount: -1, opponentLikelyPatStrength: 10, opponentIsAggressive: false };
  }

  // After draw phase, we can see how many cards opponents drew
  const isPostDraw = phase === 'BETTING_2' || phase === 'SHOWDOWN';

  let avgDrawCount = -1; // -1 = unknown
  let isAggressive = false;

  if (isPostDraw) {
    // Check opponent draw counts from activity log or cardsDrawn field
    let totalDrawn = 0;
    let counted = 0;
    for (const opp of opponents) {
      const drawn = opp.cardsDrawn;
      if (drawn !== undefined && drawn !== null) {
        totalDrawn += drawn;
        counted++;
      }
    }
    if (counted > 0) {
      avgDrawCount = totalDrawn / counted;
    }
  }

  // Check if opponents have been raising (aggressive)
  const currentBet = gameState.currentBet || 0;
  const minBet = gameState.minBet || 50;
  if (currentBet > minBet * 2) {
    isAggressive = true;
  }

  // Estimate likely pat strength based on draw count
  let likelyPatStrength;
  if (avgDrawCount === 0) {
    // Stood pat - likely has a made hand. Could be 8-low to J-low, or snowing.
    // Against aggressive pat opponent, assume ~9-low
    likelyPatStrength = isAggressive ? 8 : 10;
  } else if (avgDrawCount === 1) {
    // Drew 1 - drawing to something. After draw, could have hit or missed.
    likelyPatStrength = 9; // Average made hand after 1-card draw
  } else if (avgDrawCount >= 2) {
    // Drew 2+ - weak hand, low chance of improvement
    likelyPatStrength = 11;
  } else {
    // Unknown (pre-draw) - assume average
    likelyPatStrength = 10;
  }

  return {
    opponentDrawCount: avgDrawCount,
    opponentLikelyPatStrength: likelyPatStrength,
    opponentIsAggressive: isAggressive,
  };
}

/**
 * Determine the best discard strategy for a hard bot in single draw.
 *
 * Considers:
 * - Pat hand quality (stand pat on smooth 9 or better, sometimes break rough 10s)
 * - One-card draw quality (smoothness of remaining 4 cards)
 * - Breaking logic: sacrifice certainty for draw equity
 * - Snowing potential: stand pat with garbage to represent strength
 *
 * @param {Array} hand - 5 card hand
 * @param {Object} gameState - Current game state
 * @param {Object} player - Bot player
 * @returns {Array<number>} - Indices to discard
 */
export function decideHardSingleDrawDiscard(hand, gameState, player) {
  if (!hand || hand.length !== 5) return [];

  const handResult = HandEvaluator.evaluate(hand);
  const values = hand.map(c => RANKS[c.rank]).sort((a, b) => a - b);
  const highCard = values[4];
  const known = knownCards(hand);

  // === SNOWING DECISION ===
  // With a garbage hand (pair, high cards), consider standing pat as a bluff
  // Snow more frequently in position (higher index = later position)
  const playerIndex = (gameState.players || []).findIndex(p => p && p.uid === player.uid);
  const numPlayers = (gameState.players || []).filter(p => p && p.status !== 'folded' && p.status !== 'sitting-out').length;
  const isLatePosition = playerIndex >= Math.floor(numPlayers / 2);

  if (!handResult.isGoodLowballHand || highCard >= 12) {
    // Garbage hand - consider snowing
    const snowChance = isLatePosition ? 0.15 : 0.08;
    if (Math.random() < snowChance) {
      return []; // Stand pat (snow)
    }
  }

  // === PAT HAND EVALUATION ===
  if (handResult.isGoodLowballHand) {
    // 7-low or 8-low: Always stand pat (these are strong)
    if (highCard <= 8) return [];

    // 9-low: Stand pat unless very rough
    if (highCard === 9) {
      // Check smoothness - a rough 9 (9-8-7-x-x with straight danger) might be breakable
      const secondHighest = values[3];
      if (secondHighest <= 7) return []; // Smooth 9, keep it
      // Rough 9 (9-8-x-x-x) - still pat in single draw, risk is too high
      return [];
    }

    // 10-low: Consider breaking
    if (highCard === 10) {
      // Evaluate: what's the equity of keeping pat 10 vs drawing?
      const tenIndex = hand.findIndex(c => RANKS[c.rank] === 10);
      const keptWithout10 = hand.filter((_, i) => i !== tenIndex);
      const drawEquity = calculateDrawOneEquity(keptWithout10, known, 9);

      // If we can draw to a smooth 7 or 8, consider breaking
      // A pat 10 beats ~52% of single-card draws to 8-low
      // But if our draw base is premium (smooth to 7), breaking is correct
      const smoothness = smoothnessScore(keptWithout10);

      if (smoothness <= 7 && drawEquity.equity > 0.45) {
        // Premium draw base - break the 10
        return [tenIndex];
      }

      // Rough 10 with decent draw: break in late position
      if (smoothness <= 8 && drawEquity.equity > 0.35 && isLatePosition) {
        return [tenIndex];
      }

      // Otherwise keep pat 10
      return [];
    }

    // J-low: Almost always break
    if (highCard === 11) {
      const jackIndex = hand.findIndex(c => RANKS[c.rank] === 11);
      const keptWithoutJ = hand.filter((_, i) => i !== jackIndex);
      const drawEquity = calculateDrawOneEquity(keptWithoutJ, known, 10);

      // If the remaining 4 cards are all 8 or under with good structure, break
      const remaining = keptWithoutJ.map(c => RANKS[c.rank]);
      if (remaining.every(v => v <= 8)) {
        return [jackIndex]; // Break J-low to draw to 8 or better
      }

      // Even with mediocre structure, a J-low is rarely worth keeping in single draw
      if (drawEquity.equity > 0.25) {
        return [jackIndex];
      }

      // Very rough draw base - keep the J
      return [];
    }

    // Q-high or worse: break the highest card
    if (highCard >= 12) {
      const highIndex = hand.findIndex(c => RANKS[c.rank] === highCard);
      return [highIndex];
    }
  }

  // === NON-PAT HANDS (pairs, straights, flushes) ===

  // Evaluate all possible 1-card discard options and pick the best
  let bestDiscard = [];
  let bestEquity = -1;

  // Try discarding each card individually
  for (let i = 0; i < 5; i++) {
    const kept = hand.filter((_, idx) => idx !== i);
    const keptValues = kept.map(c => RANKS[c.rank]);

    // Skip if kept cards still have pairs
    const keptCounts = {};
    for (const v of keptValues) keptCounts[v] = (keptCounts[v] || 0) + 1;
    const hasPairInKept = Object.values(keptCounts).some(c => c >= 2);
    if (hasPairInKept) continue;

    const eq = calculateDrawOneEquity(kept, known, 10);
    const smooth = smoothnessScore(kept);
    // Combined score: raw equity weighted by smoothness
    const score = eq.equity * 100 - smooth;

    if (score > bestEquity) {
      bestEquity = score;
      bestDiscard = [i];
    }
  }

  if (bestEquity > 0) return bestDiscard;

  // Handle pairs: discard one card from the pair
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const pairs = Object.entries(counts).filter(([, c]) => c >= 2);

  if (pairs.length > 0) {
    // Discard from the highest pair first
    const pairValues = pairs.map(([v]) => parseInt(v)).sort((a, b) => b - a);

    for (const pairVal of pairValues) {
      const pairRank = Object.keys(RANKS).find(k => RANKS[k] === pairVal);
      const pairIndices = hand
        .map((c, i) => c.rank === pairRank ? i : -1)
        .filter(i => i !== -1);

      // For low pairs (2-4), discard just one; for high pairs, discard one too
      // In single draw we only get one shot, so minimize cards discarded
      if (pairVal <= 6) {
        return [pairIndices[0]]; // Keep one low card, discard duplicate
      } else {
        return [pairIndices[0]]; // Still just one for single draw
      }
    }
  }

  // Trips: discard two of the three
  const trips = Object.entries(counts).filter(([, c]) => c >= 3);
  if (trips.length > 0) {
    const tripVal = parseInt(trips[0][0]);
    const tripRank = Object.keys(RANKS).find(k => RANKS[k] === tripVal);
    const tripIndices = hand
      .map((c, i) => c.rank === tripRank ? i : -1)
      .filter(i => i !== -1);
    return tripIndices.slice(0, 2); // Discard 2 of the 3
  }

  // Fallback: discard the highest card
  let highIdx = 0;
  let highVal = 0;
  for (let i = 0; i < hand.length; i++) {
    const v = RANKS[hand[i].rank];
    if (v > highVal) { highVal = v; highIdx = i; }
  }
  return [highIdx];
}

/**
 * Calculate comprehensive equity for betting decisions.
 *
 * Returns a strength value 0-100 that accounts for:
 * - Current made hand strength
 * - Draw equity (if drawing)
 * - Opponent range estimation
 * - Position
 *
 * @param {Array} hand - 5 card hand
 * @param {Object} gameState - Current game state
 * @param {Object} player - Bot player
 * @param {Array<number>} discardIndices - Cards the bot plans to (or did) discard
 * @returns {Object} { strength, isDrawing, isPat, isSnowing, equity details }
 */
export function calculateEquityStrength(hand, gameState, player, discardIndices) {
  if (!hand || hand.length !== 5) return { strength: 0, isDrawing: false, isPat: false, isSnowing: false };

  const handResult = HandEvaluator.evaluate(hand);
  const values = hand.map(c => RANKS[c.rank]).sort((a, b) => a - b);
  const highCard = values[4];
  const phase = gameState.phase || '';
  const isPreDraw = phase === 'BETTING_1';
  const isPostDraw = phase === 'BETTING_2';
  const known = knownCards(hand);
  const isPat = discardIndices.length === 0;
  const isDrawingOne = discardIndices.length === 1;
  const isDrawingTwo = discardIndices.length >= 2;

  const oppRange = estimateOpponentRange(gameState, player);

  // Detect snowing: standing pat with a non-good hand
  const isSnowing = isPat && (!handResult.isGoodLowballHand || highCard >= 12);

  let strength = 0;

  if (isPreDraw) {
    // === PRE-DRAW BETTING ===

    if (isPat && handResult.isGoodLowballHand) {
      // Pat hand - static equity
      if (highCard <= 7) strength = 95;      // 7-low: near-nuts
      else if (highCard === 8) strength = 85; // 8-low: very strong
      else if (highCard === 9) strength = 72; // 9-low: solid
      else if (highCard === 10) strength = 58; // 10-low: marginal
      else if (highCard === 11) strength = 45; // J-low: weak pat
      else strength = 35;                      // Q+ low: garbage pat

      // Smoothness bonus (lower second card = smoother)
      const secondHighest = values[3];
      if (secondHighest <= 5) strength += 3;
      else if (secondHighest >= 8) strength -= 3;

    } else if (isSnowing) {
      // Snowing: represent a pat hand
      // Moderate strength to support the bluff line
      strength = 65; // Act confidently

    } else if (isDrawingOne) {
      // Drawing one card - evaluate draw quality
      const keptCards = hand.filter((_, i) => !discardIndices.includes(i));
      const keptValues = keptCards.map(c => RANKS[c.rank]).sort((a, b) => a - b);
      const keptHigh = keptValues[keptValues.length - 1];

      // Premium draw: drawing to 7-low
      if (keptHigh <= 7) {
        const eq = calculateDrawOneEquity(keptCards, known, 9);
        // A draw to 7-low has ~55% equity vs a pat J, ~45% vs pat 9
        strength = 60 + Math.floor(eq.equity * 30);
        // Smooth draw bonus
        const smooth = smoothnessScore(keptCards);
        if (smooth <= 7) strength += 5;
      }
      // Good draw: drawing to 8-low
      else if (keptHigh <= 8) {
        const eq = calculateDrawOneEquity(keptCards, known, 10);
        strength = 50 + Math.floor(eq.equity * 25);
      }
      // Marginal draw: drawing to 9-low
      else if (keptHigh <= 9) {
        strength = 40 + Math.floor(Math.random() * 10);
      }
      // Bad draw: drawing to 10+
      else {
        strength = 25;
      }

    } else if (isDrawingTwo) {
      // Drawing 2+ cards - weak in single draw
      strength = 15 + Math.floor(Math.random() * 10);
    }

  } else if (isPostDraw) {
    // === POST-DRAW BETTING ===
    // Now evaluate the actual made hand

    if (handResult.isGoodLowballHand) {
      // Made a clean low hand
      if (highCard <= 7) strength = 97;       // 7-low: near-nuts
      else if (highCard === 8) strength = 88;  // 8-low: very strong
      else if (highCard === 9) {
        // 9-low post-draw: good but depends on opponent
        if (oppRange.opponentDrawCount === 0) {
          // Opponent stood pat - they likely have 8-10 low
          strength = 60; // Our 9 may not be enough
        } else {
          strength = 75; // Opponent drew, our 9 is decent
        }
      }
      else if (highCard === 10) {
        if (oppRange.opponentDrawCount === 0) {
          strength = 45; // Likely losing to pat hand
        } else if (oppRange.opponentDrawCount === 1) {
          strength = 55; // Coin flip vs one-card draw
        } else {
          strength = 65; // Good vs multi-card draw
        }
      }
      else if (highCard === 11) {
        if (oppRange.opponentDrawCount === 0) {
          strength = 30; // Probably losing
        } else {
          strength = 45;
        }
      }
      else {
        strength = 25; // Q+ high, rarely good enough
      }

      // Smoothness adjustment post-draw
      const secondHighest = values[3];
      if (highCard <= 9 && secondHighest <= 5) strength += 3;

    } else if (isSnowing) {
      // We snowed (stood pat with garbage)
      // Our hand is garbage but we're representing strength
      // Assign strength based on fold equity play
      if (oppRange.opponentDrawCount >= 1) {
        // Opponent drew - they might have missed, snow can work
        strength = 55; // Moderate aggression
      } else {
        // Opponent also stood pat - risky snow
        strength = 35;
      }

    } else {
      // Missed the draw - have a pair/straight/flush/high garbage
      switch (handResult.category) {
        case 2: strength = 20; break; // Pair
        case 3: strength = 12; break; // Two pair
        case 4: strength = 8; break;  // Trips
        case 5: strength = 15; break; // Straight (bad but beats pairs in lowball? No, straight is worse)
        default: strength = 5; break;
      }
    }
  }

  return {
    strength: Math.max(0, Math.min(100, strength)),
    isDrawing: !isPat,
    isPat,
    isSnowing,
    drawCount: discardIndices.length,
    opponentRange: oppRange,
  };
}

/**
 * Make a betting decision for a hard single-draw bot based on equity.
 *
 * @param {Array} hand - 5 card hand
 * @param {Object} gameState - Current game state
 * @param {Object} player - Bot player
 * @param {Array} legalActions - Available actions
 * @param {Object} equityResult - Result from calculateEquityStrength
 * @param {string} BetAction - BetAction enum
 * @returns {Object} { action, amount }
 */
export function decideHardSingleDrawBet(hand, gameState, player, legalActions, equityResult, BetAction) {
  const currentBet = gameState.currentBet || 0;
  const playerBet = player.currentRoundBet || 0;
  const callAmount = Math.max(0, currentBet - playerBet);
  const playerChips = player.chips || 0;
  const minBet = gameState.minBet || 50;
  const pot = gameState.pot || 0;
  const raiseAction = currentBet === 0 ? BetAction.BET : BetAction.RAISE;

  const canCheck = legalActions.includes(BetAction.CHECK);
  const canCall = legalActions.includes(BetAction.CALL) && callAmount > 0;
  const canRaise = legalActions.includes(BetAction.RAISE) || legalActions.includes(BetAction.BET);
  const canFold = legalActions.includes(BetAction.FOLD);

  const { strength, isSnowing, opponentRange } = equityResult;

  // Calculate pot odds
  const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;
  // Effective equity needed to call = potOdds
  const equityNeeded = potOdds * 100;

  // === PREMIUM HANDS (strength >= 85): Value bet/raise ===
  if (strength >= 85) {
    if (canRaise) {
      // Size based on strength and pot
      const sizeFactor = strength >= 95 ? 1.0 : 0.7;
      const raiseSize = Math.max(
        currentBet + minBet,
        Math.floor(pot * sizeFactor)
      );
      const raiseAmount = Math.min(raiseSize, playerChips);
      return { action: raiseAction, amount: raiseAmount };
    }
    if (canCall) return { action: BetAction.CALL, amount: 0 };
    if (canCheck) return { action: BetAction.CHECK, amount: 0 };
  }

  // === STRONG HANDS (strength 65-84): Bet for value or call ===
  if (strength >= 65) {
    if (canRaise && callAmount === 0) {
      // Open with a bet
      const betSize = Math.max(minBet, Math.floor(pot * 0.5));
      const betAmount = Math.min(betSize, playerChips);
      return { action: raiseAction, amount: betAmount };
    }
    if (canCall) {
      // Call if pot odds are reasonable
      if (callAmount <= pot * 0.4) {
        return { action: BetAction.CALL, amount: 0 };
      }
      // Large bet - tighten up
      if (strength >= 75) {
        return { action: BetAction.CALL, amount: 0 };
      }
      if (canFold) return { action: BetAction.FOLD, amount: 0 };
    }
    if (canCheck) return { action: BetAction.CHECK, amount: 0 };
  }

  // === SNOWING: Aggression to represent pat strength ===
  if (isSnowing) {
    // Snow line: bet/raise to force folds
    if (canRaise && callAmount === 0) {
      // Open with a bet representing a strong pat hand
      const betSize = Math.max(minBet, Math.floor(pot * 0.65));
      return { action: raiseAction, amount: Math.min(betSize, playerChips) };
    }
    if (canRaise && callAmount > 0 && callAmount <= pot * 0.3) {
      // Re-raise as a snow (risky but sometimes effective)
      if (Math.random() < 0.25) {
        const reraiseSize = Math.max(currentBet + minBet, Math.floor(pot * 0.7));
        return { action: raiseAction, amount: Math.min(reraiseSize, playerChips) };
      }
    }
    // If facing a bet, usually give up the snow
    if (callAmount > 0 && canFold) return { action: BetAction.FOLD, amount: 0 };
    if (canCheck) return { action: BetAction.CHECK, amount: 0 };
  }

  // === MEDIUM HANDS (strength 45-64): Pot odds + situational ===
  if (strength >= 45) {
    if (canCheck) return { action: BetAction.CHECK, amount: 0 };
    if (canCall) {
      // Call if pot odds justify it
      if (strength > equityNeeded + 10) {
        return { action: BetAction.CALL, amount: 0 };
      }
      // Marginal - call small bets, fold large
      if (callAmount <= playerChips * 0.15) {
        return { action: BetAction.CALL, amount: 0 };
      }
      if (canFold) return { action: BetAction.FOLD, amount: 0 };
    }
  }

  // === WEAK HANDS (strength < 45): Check or fold ===
  if (canCheck) return { action: BetAction.CHECK, amount: 0 };

  // Occasional bluff with very weak hands facing a check
  if (strength < 20 && canRaise && callAmount === 0 && Math.random() < 0.08) {
    const bluffSize = Math.max(minBet, Math.floor(pot * 0.6));
    return { action: raiseAction, amount: Math.min(bluffSize, playerChips) };
  }

  if (canFold) return { action: BetAction.FOLD, amount: 0 };
  if (canCall) return { action: BetAction.CALL, amount: 0 };

  return { action: BetAction.FOLD, amount: 0 };
}
