/**
 * ============================================================================
 * RIVALS SERVICE
 * Tracks head-to-head metrics between players
 * ============================================================================
 *
 * Firestore Collections:
 *   /users/{uid}/rivals/{rivalUid} - Per-rival aggregated stats
 *
 * Security model:
 *   - Each user can only read/write their own rivals subcollection
 *   - Rivalry updates are written only to the current user's own document
 *   - Cross-user rivalry writes must go through a Cloud Function
 *   - Tale of the Tape uses only the hero's own hand logs (no IDOR)
 *
 * Tracks:
 *   - Total hands played together
 *   - Head-to-head win/loss record
 *   - Net profit/loss against rival
 *   - Behavioral stats when rival is at the table
 *   - "Tale of the Tape" comparison metrics
 *
 * ============================================================================
 */

import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { getUserHandLogs } from './HandHistoryService';

/**
 * Update rivalry stats for the CURRENT USER only after a hand completes.
 * Each client writes only to their own /users/{uid}/rivals/ subcollection.
 * This is safe because Firestore rules restrict writes to own documents.
 */
export async function updateRivalryForCurrentUser(currentUserUid, handRecord) {
  if (!db) return;

  const hero = handRecord.players.find((p) => p.uid === currentUserUid);
  if (!hero) return;

  const opponents = handRecord.players.filter((p) => p.uid !== currentUserUid && !p.isBot);
  if (opponents.length === 0) return;

  const heroWon = handRecord.winners.some((w) => w.uid === currentUserUid);
  const heroNet = heroWon
    ? (handRecord.winners.find((w) => w.uid === currentUserUid)?.amount || 0) - hero.totalContribution
    : -hero.totalContribution;

  for (const villain of opponents) {
    const rivalRef = doc(db, 'users', currentUserUid, 'rivals', villain.uid);

    try {
      const snap = await getDoc(rivalRef);
      if (snap.exists()) {
        await updateDoc(rivalRef, {
          handsPlayed: increment(1),
          handsWon: heroWon ? increment(1) : increment(0),
          netResult: increment(heroNet),
          lastPlayed: serverTimestamp(),
          villainDisplayName: villain.displayName,
        });
      } else {
        await setDoc(rivalRef, {
          rivalUid: villain.uid,
          villainDisplayName: villain.displayName,
          handsPlayed: 1,
          handsWon: heroWon ? 1 : 0,
          netResult: heroNet,
          firstPlayed: serverTimestamp(),
          lastPlayed: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error(`Failed to update rivalry ${currentUserUid} vs ${villain.uid}:`, err);
    }
  }
}

/**
 * Get all rivals for a player, sorted by hands played
 */
export async function getRivals(uid, maxCount = 20) {
  if (!db) return [];

  try {
    const q = query(
      collection(db, 'users', uid, 'rivals'),
      orderBy('handsPlayed', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Failed to fetch rivals:', err);
    return [];
  }
}

/**
 * Get detailed rivalry record between two players
 */
export async function getRivalryDetail(heroUid, villainUid) {
  if (!db) return null;

  try {
    const snap = await getDoc(doc(db, 'users', heroUid, 'rivals', villainUid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error('Failed to fetch rivalry detail:', err);
    return null;
  }
}

/**
 * Compute "Tale of the Tape" comparison between hero and villain.
 *
 * SECURITY: Only fetches the hero's own hand logs (filtered to hands where
 * villain was present). The villain's metrics are derived from the hero's
 * rivalry record - never from the villain's private hand history.
 * This prevents IDOR (Insecure Direct Object Reference).
 */
export async function computeTaleOfTheTape(heroUid, villainUid) {
  // Only fetch hero's own hand logs - never access another user's data
  const heroLogs = await getUserHandLogs(heroUid, {
    opponentUid: villainUid,
    limitCount: 500,
  });

  const heroMetrics = computePlayerMetrics(heroLogs);

  // Load the pre-aggregated rivalry record for villain's summary stats
  // This only contains aggregate data (hands played, wins, net result)
  // that was written by each user's own client - no private hand data
  const rivalryRecord = await getRivalryDetail(heroUid, villainUid);

  // Villain metrics are limited to what's observable from hero's perspective
  const villainObservedMetrics = {
    vpip: 0,
    pfr: 0,
    aggressionFrequency: 0,
    showdownWinRate: 0,
    nonShowdownWinRate: 0,
    avgPotSize: 0,
    foldToSteal: 0,
    threeBetPct: 0,
    totalHands: rivalryRecord?.handsPlayed || heroLogs.length,
  };

  return {
    hero: heroMetrics,
    villain: villainObservedMetrics,
    handsInCommon: heroLogs.length,
    insights: generateInsights(heroMetrics, villainObservedMetrics),
  };
}

/**
 * Compute metrics for "Tale of the Tape" from hand logs
 */
function computePlayerMetrics(logs) {
  if (!logs || logs.length === 0) {
    return {
      vpip: 0,
      pfr: 0,
      aggressionFrequency: 0,
      showdownWinRate: 0,
      nonShowdownWinRate: 0,
      avgPotSize: 0,
      foldToSteal: 0,
      threeBetPct: 0,
      totalHands: 0,
    };
  }

  let vpipCount = 0;
  let pfrCount = 0;
  let aggressiveActions = 0;
  let totalActions = 0;
  let showdowns = 0;
  let showdownWins = 0;
  let nonShowdownWins = 0;
  let totalPot = 0;
  let stealAttempts = 0;
  let foldToSteals = 0;

  for (const hand of logs) {
    const contributed = hand.totalContribution || 0;
    const stakeLevel = hand.stakeLevel || 50;

    if (contributed > 0) vpipCount++;
    if (contributed > stakeLevel * 2) {
      pfrCount++;
    }
    if (contributed > stakeLevel) {
      aggressiveActions++;
    }
    totalActions++;

    if (hand.status === 'active' || hand.status === 'all-in') {
      showdowns++;
      if (hand.isWinner) showdownWins++;
    } else if (hand.isWinner) {
      // Won without going to showdown - opponents folded
      nonShowdownWins++;
    }

    totalPot += contributed;

    // Steal detection (late position raises)
    if (['CO', 'BTN'].includes(hand.position) && contributed > stakeLevel * 2) {
      stealAttempts++;
    }
    if (['SB', 'BB'].includes(hand.position) && hand.status === 'folded' && contributed <= stakeLevel) {
      foldToSteals++;
    }
  }

  const totalHands = logs.length;

  return {
    vpip: totalHands > 0 ? Math.round((vpipCount / totalHands) * 1000) / 10 : 0,
    pfr: totalHands > 0 ? Math.round((pfrCount / totalHands) * 1000) / 10 : 0,
    aggressionFrequency: totalActions > 0 ? Math.round((aggressiveActions / totalActions) * 1000) / 10 : 0,
    showdownWinRate: showdowns > 0 ? Math.round((showdownWins / showdowns) * 1000) / 10 : 0,
    nonShowdownWinRate: totalHands > 0 ? Math.round((nonShowdownWins / totalHands) * 1000) / 10 : 0,
    avgPotSize: totalHands > 0 ? Math.round(totalPot / totalHands) : 0,
    foldToSteal: stealAttempts > 0 ? Math.round((foldToSteals / stealAttempts) * 1000) / 10 : 0,
    // 3-bet % removed: cannot be accurately computed from summarized hand logs
    // (requires full action log analysis to distinguish raises from re-raises)
    threeBetPct: 0,
    totalHands,
  };
}

/**
 * Generate textual insights from hero vs villain comparison
 */
function generateInsights(hero, villain) {
  const insights = [];

  if (hero.totalHands === 0 || villain.totalHands === 0) {
    return ['Not enough data to generate insights.'];
  }

  // Aggression comparison
  if (villain.aggressionFrequency > hero.aggressionFrequency + 15) {
    insights.push('They are bullying you. Consider re-raising more frequently.');
  } else if (hero.aggressionFrequency > villain.aggressionFrequency + 15) {
    insights.push('You are the aggressor in this matchup. Keep applying pressure.');
  }

  // VPIP comparison
  if (hero.vpip < villain.vpip - 10) {
    insights.push(`You play tighter against them (${hero.vpip}% vs their ${villain.vpip}%). You may be playing scared.`);
  }

  // Showdown comparison
  if (villain.showdownWinRate > hero.showdownWinRate + 10) {
    insights.push('They win more at showdown. Consider value-betting thinner against them.');
  }

  // Non-showdown wins
  if (hero.nonShowdownWinRate > 30) {
    insights.push('You win a lot of pots without showdown. Your aggression is working.');
  }

  // Fold to steal
  if (hero.foldToSteal > 70) {
    insights.push('You fold too much to steals. Defend your blinds more.');
  }

  if (insights.length === 0) {
    insights.push('This is an evenly matched rivalry. Stay focused and play your game.');
  }

  return insights;
}

export { computePlayerMetrics, generateInsights };
