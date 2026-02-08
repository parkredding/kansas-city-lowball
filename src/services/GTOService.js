/**
 * ============================================================================
 * GTO SERVICE
 * Tracks player accuracy against the "Perfect AI" (GTO bot)
 * ============================================================================
 *
 * Firestore Collections:
 *   /users/{uid}/gto_performance/{handId} - Per-hand GTO analysis
 *   /users/{uid}/stats_cache/gto_summary  - Aggregated GTO stats
 *
 * Tracks:
 *   - EV Loss per hand against the bot
 *   - GTO accuracy grade (how close to optimal play)
 *   - Mistake log with error magnitude in BBs
 *   - Leak identification by situation
 *
 * ============================================================================
 */

import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * GTO Action recommendations based on simplified game theory
 * In a real system, this would integrate with a solver (PioSolver, GTO+)
 * For now, we use heuristic-based optimal play approximation
 */
const GTO_DECISION_MAP = {
  // Position-based open raise ranges (simplified)
  PREFLOP_OPEN: {
    BTN: 0.40, // Open 40% of hands from button
    CO: 0.30,
    HJ: 0.22,
    UTG: 0.15,
    SB: 0.35,
    BB: 0.0, // BB doesn't open, they defend
  },
  // 3-bet frequencies by position
  THREE_BET: {
    BTN: 0.08,
    CO: 0.07,
    HJ: 0.05,
    UTG: 0.04,
    SB: 0.09,
    BB: 0.10,
  },
};

/**
 * Evaluate a player's action against the GTO recommendation
 * Returns an error record with EV loss estimation
 */
export function evaluateAction(playerAction, gameState) {
  const {
    position,
    holeCards,
    potSize,
    currentBet,
    stakeLevel,
    phase,
    handStrength,
  } = gameState;

  // Simplified GTO evaluation
  const gtoAction = getGTORecommendation(gameState);
  const isCorrect = playerAction === gtoAction.action;

  // Estimate EV loss in BBs
  let evLoss = 0;
  if (!isCorrect) {
    evLoss = estimateEVLoss(playerAction, gtoAction, potSize, stakeLevel);
  }

  return {
    playerAction,
    gtoAction: gtoAction.action,
    gtoConfidence: gtoAction.confidence,
    isCorrect,
    evLoss,
    evLossBBs: stakeLevel > 0 ? Math.round((evLoss / stakeLevel) * 100) / 100 : 0,
    situation: describeSituation(gameState),
    position,
    phase,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get simplified GTO recommendation for a game state
 */
function getGTORecommendation(gameState) {
  const { handStrength, potSize, currentBet, position, phase } = gameState;
  const strength = handStrength || 50; // 0-100 scale
  const potOdds = currentBet > 0 ? currentBet / (potSize + currentBet) : 0;

  // Pre-flop decisions
  if (phase === 'PREFLOP' || phase === 'BETTING_1') {
    if (strength > 85) return { action: 'RAISE', confidence: 0.95 };
    if (strength > 65) return { action: 'RAISE', confidence: 0.75 };
    if (strength > 45 && currentBet === 0) return { action: 'RAISE', confidence: 0.60 };
    if (strength > 35 && potOdds < 0.3) return { action: 'CALL', confidence: 0.65 };
    return { action: 'FOLD', confidence: 0.70 };
  }

  // Post-flop decisions
  if (strength > 80) {
    return currentBet > 0
      ? { action: 'RAISE', confidence: 0.85 }
      : { action: 'BET', confidence: 0.85 };
  }
  if (strength > 55) {
    if (currentBet === 0) return { action: 'BET', confidence: 0.65 };
    if (potOdds < 0.35) return { action: 'CALL', confidence: 0.70 };
    return { action: 'CALL', confidence: 0.55 };
  }
  if (strength > 30) {
    if (currentBet === 0) return { action: 'CHECK', confidence: 0.60 };
    if (potOdds < 0.25) return { action: 'CALL', confidence: 0.50 };
    return { action: 'FOLD', confidence: 0.55 };
  }

  // Weak hand
  if (currentBet === 0) return { action: 'CHECK', confidence: 0.75 };
  return { action: 'FOLD', confidence: 0.80 };
}

/**
 * Estimate EV loss from deviating from GTO play
 */
function estimateEVLoss(playerAction, gtoAction, potSize, stakeLevel) {
  const actionSeverity = {
    FOLD_vs_CALL: 0.5,
    FOLD_vs_RAISE: 0.3,
    CALL_vs_FOLD: 0.8,
    CALL_vs_RAISE: 0.4,
    RAISE_vs_FOLD: 1.2,
    RAISE_vs_CALL: 0.3,
    CHECK_vs_BET: 0.2,
    BET_vs_CHECK: 0.3,
  };

  const key = `${playerAction}_vs_${gtoAction.action}`;
  const severity = actionSeverity[key] || 0.5;

  return Math.round(potSize * severity * gtoAction.confidence * 100) / 100;
}

/**
 * Describe the game situation for the mistake log
 */
function describeSituation(gameState) {
  const parts = [];
  if (gameState.position) parts.push(`Position: ${gameState.position}`);
  if (gameState.phase) parts.push(`Phase: ${gameState.phase}`);
  if (gameState.handStrength !== undefined) {
    parts.push(`Hand Strength: ${gameState.handStrength}%`);
  }
  return parts.join(' | ');
}

/**
 * Save a GTO evaluation record to Firestore
 */
export async function saveGTOEvaluation(uid, handId, evaluation) {
  if (!db) return;

  try {
    await setDoc(doc(db, 'users', uid, 'gto_performance', handId), {
      ...evaluation,
      handId,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to save GTO evaluation:', err);
  }
}

/**
 * Get GTO performance records for a user
 */
export async function getGTOPerformance(uid, maxRecords = 200) {
  if (!db) return [];

  try {
    const q = query(
      collection(db, 'users', uid, 'gto_performance'),
      orderBy('timestamp', 'desc'),
      limit(maxRecords)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Failed to fetch GTO performance:', err);
    return [];
  }
}

/**
 * Compute GTO summary stats from performance records
 */
export function computeGTOSummary(records) {
  if (!records || records.length === 0) {
    return {
      totalDecisions: 0,
      correctDecisions: 0,
      accuracyPct: 0,
      totalEVLoss: 0,
      avgEVLossPerHand: 0,
      gtoGrade: 'N/A',
      topMistakes: [],
      leaks: [],
    };
  }

  let correct = 0;
  let totalEVLoss = 0;
  const mistakesByType = {};
  const leaksByPosition = {};

  for (const rec of records) {
    if (rec.isCorrect) correct++;
    totalEVLoss += rec.evLoss || 0;

    if (!rec.isCorrect) {
      const key = `${rec.playerAction} instead of ${rec.gtoAction}`;
      if (!mistakesByType[key]) {
        mistakesByType[key] = { description: key, count: 0, totalEVLoss: 0, examples: [] };
      }
      mistakesByType[key].count++;
      mistakesByType[key].totalEVLoss += rec.evLoss || 0;
      if (mistakesByType[key].examples.length < 3) {
        mistakesByType[key].examples.push(rec);
      }

      // Track leaks by position
      const pos = rec.position || 'Unknown';
      if (!leaksByPosition[pos]) {
        leaksByPosition[pos] = { position: pos, errors: 0, evLoss: 0 };
      }
      leaksByPosition[pos].errors++;
      leaksByPosition[pos].evLoss += rec.evLoss || 0;
    }
  }

  const accuracyPct = Math.round((correct / records.length) * 1000) / 10;

  // GTO Grade
  let gtoGrade;
  if (accuracyPct >= 90) gtoGrade = 'A+';
  else if (accuracyPct >= 80) gtoGrade = 'A';
  else if (accuracyPct >= 70) gtoGrade = 'B+';
  else if (accuracyPct >= 60) gtoGrade = 'B';
  else if (accuracyPct >= 50) gtoGrade = 'C';
  else if (accuracyPct >= 40) gtoGrade = 'D';
  else gtoGrade = 'F';

  // Top 5 most expensive mistakes
  const topMistakes = Object.values(mistakesByType)
    .sort((a, b) => b.totalEVLoss - a.totalEVLoss)
    .slice(0, 5);

  // Top 3 leaks by position
  const leaks = Object.values(leaksByPosition)
    .sort((a, b) => b.evLoss - a.evLoss)
    .slice(0, 3);

  return {
    totalDecisions: records.length,
    correctDecisions: correct,
    accuracyPct,
    totalEVLoss: Math.round(totalEVLoss * 100) / 100,
    avgEVLossPerHand: Math.round((totalEVLoss / records.length) * 100) / 100,
    gtoGrade,
    topMistakes,
    leaks,
  };
}

/**
 * "Leak Finder" - Identify the top situations where player loses the most EV
 */
export function findLeaks(records) {
  if (!records || records.length === 0) return [];

  const situationMap = {};

  for (const rec of records) {
    if (rec.isCorrect) continue;

    const situation = `${rec.position || 'Unknown'} - ${rec.phase || 'Unknown'}`;
    if (!situationMap[situation]) {
      situationMap[situation] = {
        situation,
        position: rec.position,
        phase: rec.phase,
        occurrences: 0,
        totalEVLoss: 0,
        avgEVLoss: 0,
        worstExample: null,
      };
    }

    situationMap[situation].occurrences++;
    situationMap[situation].totalEVLoss += rec.evLoss || 0;

    if (!situationMap[situation].worstExample ||
        (rec.evLoss || 0) > (situationMap[situation].worstExample.evLoss || 0)) {
      situationMap[situation].worstExample = rec;
    }
  }

  // Calculate averages and sort
  const leaks = Object.values(situationMap);
  for (const leak of leaks) {
    leak.avgEVLoss = Math.round((leak.totalEVLoss / leak.occurrences) * 100) / 100;
    leak.totalEVLoss = Math.round(leak.totalEVLoss * 100) / 100;
  }

  return leaks.sort((a, b) => b.totalEVLoss - a.totalEVLoss).slice(0, 5);
}
