/**
 * ============================================================================
 * HAND HISTORY SERVICE
 * Stores and retrieves detailed hand history records from Firestore
 * ============================================================================
 *
 * Firestore Collections:
 *   /hand_histories/{handId}  - Raw hand data (the "black box")
 *   /users/{uid}/hand_logs/{handId} - Per-user index for fast queries
 *
 * Each hand record captures the full action sequence, board state,
 * hole cards, positions, and outcome for replay and stat aggregation.
 * ============================================================================
 */

import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

/**
 * Position labels by seat count and dealer-relative index
 */
const POSITION_LABELS = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};

/**
 * Determine a player's position label based on seat arrangement
 */
function getPositionLabel(playerIndex, dealerIndex, totalPlayers) {
  const positions = POSITION_LABELS[totalPlayers] || POSITION_LABELS[6];
  const relativeIndex = (playerIndex - dealerIndex + totalPlayers) % totalPlayers;
  return positions[relativeIndex] || 'UTG';
}

/**
 * Build a hand history record from table state at showdown/resolution
 */
export function buildHandRecord(tableData, winners, handNumber) {
  const gameType = tableData.config?.gameType || 'lowball_27';
  const bettingType = tableData.config?.bettingType || 'no_limit';
  const playerCount = tableData.players.length;
  const dealerIndex = tableData.dealerIndex || 0;

  // Determine which players reached showdown (active/all-in at end)
  const showdownPlayerUids = new Set(
    tableData.players
      .filter((p) => p.status === 'active' || p.status === 'all-in')
      .map((p) => p.uid)
  );

  const playerRecords = tableData.players.map((p, i) => ({
    uid: p.uid,
    displayName: p.displayName,
    isBot: p.isBot || false,
    botDifficulty: p.botDifficulty || null,
    position: getPositionLabel(i, dealerIndex, playerCount),
    seatIndex: i,
    // Redact hole cards for players who folded to protect strategy privacy
    holeCards: showdownPlayerUids.has(p.uid) ? (p.hand || []) : [],
    status: p.status,
    totalContribution: p.totalContribution || 0,
    chipsBefore: (p.chips || 0) + (p.totalContribution || 0),
    chipsAfter: p.chips || 0,
  }));

  const winnerRecords = (winners || []).map((w) => ({
    uid: w.uid || w.playerId,
    displayName: w.displayName || w.name,
    amount: w.amount || w.winnings || 0,
    handDescription: w.handDescription || w.handType || '',
  }));

  const totalPot = (tableData.pots || []).reduce((sum, p) => sum + (p.amount || 0), 0) || tableData.pot || 0;

  return {
    handId: `${tableData.id}_${handNumber || Date.now()}`,
    tableId: tableData.id,
    handNumber: handNumber || 0,
    timestamp: new Date().toISOString(),
    gameType,
    bettingType,
    stakeLevel: tableData.minBet || 50,
    tableMode: tableData.config?.tableMode || 'cash_game',
    playerCount,
    dealerIndex,
    players: playerRecords,
    winners: winnerRecords,
    communityCards: tableData.communityCards || [],
    totalPot,
    pots: tableData.pots || [],
    actions: tableData.actionLog || [],
  };
}

/**
 * Save a hand history record to Firestore
 */
export async function saveHandHistory(handRecord) {
  if (!db) return null;

  const batch = writeBatch(db);

  // Save main hand record
  const handRef = doc(db, 'hand_histories', handRecord.handId);
  batch.set(handRef, {
    ...handRecord,
    createdAt: serverTimestamp(),
  });

  // Save per-player index entries for fast user queries
  for (const player of handRecord.players) {
    if (player.isBot) continue;

    const winner = handRecord.winners.find((w) => w.uid === player.uid);
    const netResult = winner
      ? winner.amount - player.totalContribution
      : -player.totalContribution;

    // Build flat array of opponent UIDs for Firestore array-contains queries
    const opponentUids = handRecord.players
      .filter((p) => p.uid !== player.uid)
      .map((p) => p.uid);

    const userHandRef = doc(db, 'users', player.uid, 'hand_logs', handRecord.handId);
    batch.set(userHandRef, {
      handId: handRecord.handId,
      tableId: handRecord.tableId,
      timestamp: handRecord.timestamp,
      gameType: handRecord.gameType,
      bettingType: handRecord.bettingType,
      stakeLevel: handRecord.stakeLevel,
      position: player.position,
      holeCards: player.holeCards,
      status: player.status,
      totalContribution: player.totalContribution,
      netResult,
      isWinner: !!winner,
      winAmount: winner?.amount || 0,
      handDescription: winner?.handDescription || '',
      playerCount: handRecord.playerCount,
      opponentUids,
      opponents: handRecord.players
        .filter((p) => p.uid !== player.uid)
        .map((p) => ({ uid: p.uid, displayName: p.displayName, isBot: p.isBot })),
      vsBot: handRecord.players.some((p) => p.uid !== player.uid && p.isBot),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return handRecord.handId;
  } catch (err) {
    console.error('Failed to save hand history:', err);
    return null;
  }
}

/**
 * Fetch hand history logs for a specific user
 */
export async function getUserHandLogs(uid, options = {}) {
  if (!db) return [];

  const {
    gameType = null,
    position = null,
    opponentUid = null,
    limitCount = 100,
    lastDoc = null,
  } = options;

  let q = collection(db, 'users', uid, 'hand_logs');
  const constraints = [orderBy('timestamp', 'desc')];

  if (gameType) {
    constraints.unshift(where('gameType', '==', gameType));
  }
  if (position) {
    constraints.unshift(where('position', '==', position));
  }
  // Server-side filtering by opponent using the opponentUids array field
  if (opponentUid) {
    constraints.unshift(where('opponentUids', 'array-contains', opponentUid));
  }

  constraints.push(limit(limitCount));
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  q = query(q, ...constraints);

  try {
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _doc: d }));

    return results;
  } catch (err) {
    console.error('Failed to fetch hand logs:', err);
    return [];
  }
}

/**
 * Get full hand history record by ID
 */
export async function getHandRecord(handId) {
  if (!db) return null;

  try {
    const snap = await getDoc(doc(db, 'hand_histories', handId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error('Failed to fetch hand record:', err);
    return null;
  }
}

export { getPositionLabel };
