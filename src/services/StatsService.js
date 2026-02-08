/**
 * ============================================================================
 * STATS SERVICE
 * Aggregates player statistics from hand history logs
 * ============================================================================
 *
 * Computes:
 *   - Overall stats (VPIP, PFR, Aggression Factor, Win Rate)
 *   - Stats by game type (NLHE, PLO, Lowball)
 *   - Stats by position (BTN, SB, BB, UTG, HJ, CO)
 *   - Starting hand profitability (for Hold'em: 13x13 grid)
 *   - Showdown vs Non-Showdown winnings (Blue/Red line)
 *   - Session-over-session performance graph data
 *
 * Firestore Collection:
 *   /users/{uid}/stats_cache/{cacheKey} - Pre-computed stat snapshots
 *
 * ============================================================================
 */

import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getUserHandLogs } from './HandHistoryService';

/**
 * All Hold'em starting hand combos (13x13 grid)
 * Rows = first card rank, Cols = second card rank
 * Upper-right triangle = suited, lower-left = offsuit, diagonal = pairs
 */
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * Normalize a Hold'em hole card pair to a canonical string
 * e.g., {rank:'A',suit:'h'},{rank:'K',suit:'s'} => 'AKo'
 */
function canonicalizeHoldemHand(cards) {
  if (!cards || cards.length < 2) return null;
  const [c1, c2] = cards;
  const r1 = c1.rank, r2 = c2.rank;
  const suited = c1.suit === c2.suit;

  const i1 = RANKS.indexOf(r1);
  const i2 = RANKS.indexOf(r2);

  if (i1 === i2) return `${r1}${r2}`;
  if (i1 < i2) return `${r1}${r2}${suited ? 's' : 'o'}`;
  return `${r2}${r1}${suited ? 's' : 'o'}`;
}

/**
 * Compute aggregate stats from an array of hand log entries
 */
export function computeStats(handLogs) {
  if (!handLogs || handLogs.length === 0) {
    return getEmptyStats();
  }

  let totalHands = handLogs.length;
  let handsWon = 0;
  let totalNetResult = 0;
  let totalContributed = 0;
  let showdownWinnings = 0;
  let nonShowdownWinnings = 0;
  let vpipCount = 0;
  let pfrCount = 0;
  let aggressionBets = 0;
  let aggressionCalls = 0;

  // Per-position stats
  const positionStats = {};
  // Per-game-type stats
  const gameTypeStats = {};
  // Starting hand profitability (Hold'em)
  const startingHandStats = {};
  // Running cumulative for graph data
  const cumulativeData = [];
  let runningTotal = 0;
  let runningShowdown = 0;
  let runningNonShowdown = 0;

  for (const hand of handLogs) {
    const net = hand.netResult || 0;
    const contributed = hand.totalContribution || 0;
    const won = hand.isWinner;
    const position = hand.position || 'UTG';
    const gameType = hand.gameType || 'lowball_27';

    totalNetResult += net;
    totalContributed += contributed;
    if (won) handsWon++;

    // Showdown vs non-showdown classification
    if (hand.status === 'active' || hand.status === 'all-in') {
      // Went to showdown
      showdownWinnings += net;
    } else {
      // Won without showdown (opponent folded) or lost by folding
      nonShowdownWinnings += net;
    }

    // VPIP: voluntarily put money in pot (not forced blind)
    if (contributed > 0 && position !== 'SB' && position !== 'BB') {
      vpipCount++;
    } else if (contributed > (hand.stakeLevel || 50)) {
      // BB/SB that put in more than their forced blind
      vpipCount++;
    }

    // PFR: pre-flop raise (approximation from net contribution)
    if (contributed > (hand.stakeLevel || 50) * 2) {
      pfrCount++;
    }

    // Aggression (approximation)
    if (net > 0 && hand.status !== 'active') {
      aggressionBets++;
    } else if (contributed > 0) {
      aggressionCalls++;
    }

    // Position accumulation
    if (!positionStats[position]) {
      positionStats[position] = { hands: 0, won: 0, netResult: 0, contributed: 0 };
    }
    positionStats[position].hands++;
    if (won) positionStats[position].won++;
    positionStats[position].netResult += net;
    positionStats[position].contributed += contributed;

    // Game type accumulation
    if (!gameTypeStats[gameType]) {
      gameTypeStats[gameType] = { hands: 0, won: 0, netResult: 0, contributed: 0 };
    }
    gameTypeStats[gameType].hands++;
    if (won) gameTypeStats[gameType].won++;
    gameTypeStats[gameType].netResult += net;
    gameTypeStats[gameType].contributed += contributed;

    // Starting hand profitability (Hold'em only)
    if (gameType === 'holdem' && hand.holeCards?.length === 2) {
      const canonical = canonicalizeHoldemHand(hand.holeCards);
      if (canonical) {
        if (!startingHandStats[canonical]) {
          startingHandStats[canonical] = { hands: 0, netResult: 0, won: 0 };
        }
        startingHandStats[canonical].hands++;
        startingHandStats[canonical].netResult += net;
        if (won) startingHandStats[canonical].won++;
      }
    }

    // Cumulative graph data
    runningTotal += net;
    if (hand.status === 'active' || hand.status === 'all-in') {
      runningShowdown += net;
    } else {
      runningNonShowdown += net;
    }

    cumulativeData.push({
      hand: cumulativeData.length + 1,
      timestamp: hand.timestamp,
      total: runningTotal,
      showdown: runningShowdown,
      nonShowdown: runningNonShowdown,
    });
  }

  const vpip = totalHands > 0 ? (vpipCount / totalHands) * 100 : 0;
  const pfr = totalHands > 0 ? (pfrCount / totalHands) * 100 : 0;
  const aggressionFactor = aggressionCalls > 0 ? aggressionBets / aggressionCalls : 0;
  const winRate = totalHands > 0 ? (handsWon / totalHands) * 100 : 0;
  const bbPer100 = totalHands > 0 ? (totalNetResult / totalHands) * 100 : 0;

  return {
    totalHands,
    handsWon,
    totalNetResult,
    totalContributed,
    showdownWinnings,
    nonShowdownWinnings,
    vpip: Math.round(vpip * 10) / 10,
    pfr: Math.round(pfr * 10) / 10,
    aggressionFactor: Math.round(aggressionFactor * 100) / 100,
    winRate: Math.round(winRate * 10) / 10,
    bbPer100: Math.round(bbPer100 * 10) / 10,
    positionStats,
    gameTypeStats,
    startingHandStats,
    cumulativeData,
  };
}

/**
 * Return empty stats structure
 */
export function getEmptyStats() {
  return {
    totalHands: 0,
    handsWon: 0,
    totalNetResult: 0,
    totalContributed: 0,
    showdownWinnings: 0,
    nonShowdownWinnings: 0,
    vpip: 0,
    pfr: 0,
    aggressionFactor: 0,
    winRate: 0,
    bbPer100: 0,
    positionStats: {},
    gameTypeStats: {},
    startingHandStats: {},
    cumulativeData: [],
  };
}

/**
 * Fetch and compute full stats for a user
 */
export async function getUserStats(uid, options = {}) {
  const handLogs = await getUserHandLogs(uid, { ...options, limitCount: 1000 });
  return computeStats(handLogs);
}

/**
 * Fetch stats filtered by a specific opponent (rival)
 */
export async function getUserStatsVsRival(uid, rivalUid) {
  const handLogs = await getUserHandLogs(uid, {
    opponentUid: rivalUid,
    limitCount: 1000,
  });
  return computeStats(handLogs);
}

/**
 * Cache computed stats in Firestore for fast dashboard loading
 */
export async function cacheUserStats(uid, stats) {
  if (!db) return;

  try {
    await setDoc(doc(db, 'users', uid, 'stats_cache', 'latest'), {
      ...stats,
      cachedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to cache stats:', err);
  }
}

/**
 * Load cached stats from Firestore
 */
export async function getCachedStats(uid) {
  if (!db) return null;

  try {
    const snap = await getDoc(doc(db, 'users', uid, 'stats_cache', 'latest'));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('Failed to load cached stats:', err);
    return null;
  }
}

/**
 * Build 13x13 heatmap data for Hold'em starting hands
 */
export function buildHeatmapData(startingHandStats) {
  const grid = [];
  for (let row = 0; row < 13; row++) {
    const rowData = [];
    for (let col = 0; col < 13; col++) {
      const r1 = RANKS[row];
      const r2 = RANKS[col];
      let label;

      if (row === col) {
        label = `${r1}${r2}`;
      } else if (row < col) {
        label = `${r1}${r2}s`;
      } else {
        label = `${r2}${r1}o`;
      }

      const stats = startingHandStats[label] || { hands: 0, netResult: 0, won: 0 };
      const avgResult = stats.hands > 0 ? stats.netResult / stats.hands : 0;
      const winPct = stats.hands > 0 ? (stats.won / stats.hands) * 100 : 0;

      rowData.push({
        label,
        hands: stats.hands,
        netResult: stats.netResult,
        avgResult,
        winPct,
        row,
        col,
        isPair: row === col,
        isSuited: row < col,
      });
    }
    grid.push(rowData);
  }
  return grid;
}

export { RANKS, canonicalizeHoldemHand };
