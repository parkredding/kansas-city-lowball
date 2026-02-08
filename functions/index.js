/**
 * Cloud Functions for Kansas City Lowball Poker
 *
 * SERVER-HOSTED GAME STATE ARCHITECTURE
 * =====================================
 *
 * This implements a server-authoritative game hosting model where:
 * 1. Scheduled function runs every minute to process ALL expired timeouts
 * 2. Server is the single source of truth for game state transitions
 * 3. Clients only display state - no more client-triggered timeout claims
 *
 * Benefits:
 * - No race conditions from player refresh/back button
 * - Consistent game state regardless of client connectivity
 * - Future-proofed for scaling beyond free tier
 * - Eliminates timer hang bugs caused by client-side claiming
 */

const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Constants
const TURN_TIME_SECONDS = 45;
const GRACE_PERIOD_MS = 2000; // 2 second grace period for network latency

/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Object with undefined values removed
 */
function removeUndefinedValues(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

/**
 * SCHEDULED FUNCTION: Process all expired timeouts
 *
 * Runs every minute to check all active tables and process any expired turns.
 * This is the core of the server-hosted architecture - the server proactively
 * manages game state instead of waiting for client triggers.
 *
 * Schedule: Every 1 minute (to stay within free tier limits while being responsive)
 */
exports.processTimeouts = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "America/Chicago",
  retryCount: 0,  // Don't retry - next scheduled run will handle it
}, async (event) => {
  console.log("Processing timeouts - scheduled run started");

  try {
    const now = Timestamp.now();
    const nowMs = now.toMillis();

    // Query all tables with expired turnDeadlines
    // A deadline is expired if it's in the past (with grace period)
    const tablesSnapshot = await db.collection("tables")
      .where("turnDeadline", "!=", null)
      .get();

    if (tablesSnapshot.empty) {
      console.log("No tables with active turn deadlines");
      return;
    }

    let processedCount = 0;
    let skippedCount = 0;

    // Process each table with a potential timeout
    const promises = tablesSnapshot.docs.map(async (tableDoc) => {
      const tableData = tableDoc.data();
      const { turnDeadline, phase } = tableData;

      if (!turnDeadline) {
        return { skipped: true, reason: "no deadline" };
      }

      // Check if deadline has passed
      let deadlineMs;
      if (turnDeadline.toDate) {
        deadlineMs = turnDeadline.toDate().getTime();
      } else if (turnDeadline.seconds) {
        deadlineMs = turnDeadline.seconds * 1000;
      } else {
        deadlineMs = new Date(turnDeadline).getTime();
      }

      // Only process if deadline + grace period has passed
      if (nowMs < deadlineMs + GRACE_PERIOD_MS) {
        return { skipped: true, reason: "not yet expired" };
      }

      // Check if game is in a timed phase
      const isDrawPhase = phase?.startsWith("DRAW_");
      const isBettingPhase = phase?.startsWith("BETTING_") ||
                            ["PREFLOP", "FLOP", "TURN", "RIVER"].includes(phase);

      if (!isDrawPhase && !isBettingPhase) {
        return { skipped: true, reason: "not in timed phase" };
      }

      // Process timeout for this table
      try {
        const result = await processTableTimeout(tableDoc.ref, tableData);
        return { processed: true, tableId: tableDoc.id, result };
      } catch (err) {
        console.error(`Error processing timeout for table ${tableDoc.id}:`, err);
        return { error: true, tableId: tableDoc.id, message: err.message };
      }
    });

    const results = await Promise.all(promises);

    processedCount = results.filter(r => r.processed).length;
    skippedCount = results.filter(r => r.skipped).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`Timeout processing complete: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`);

  } catch (error) {
    console.error("Error in processTimeouts:", error);
  }
});

/**
 * Process timeout for a single table
 * Uses a transaction to ensure atomic state updates
 */
async function processTableTimeout(tableRef, initialData) {
  return await db.runTransaction(async (transaction) => {
    // Re-read within transaction for consistency
    const tableDoc = await transaction.get(tableRef);

    if (!tableDoc.exists) {
      return { success: false, message: "Table not found" };
    }

    const tableData = tableDoc.data();
    const { players, phase, activePlayerIndex, turnDeadline } = tableData;

    // Re-validate deadline within transaction
    if (!turnDeadline) {
      return { success: false, message: "No deadline" };
    }

    const nowMs = Date.now();
    let deadlineMs;
    if (turnDeadline.toDate) {
      deadlineMs = turnDeadline.toDate().getTime();
    } else if (turnDeadline.seconds) {
      deadlineMs = turnDeadline.seconds * 1000;
    } else {
      deadlineMs = new Date(turnDeadline).getTime();
    }

    if (nowMs < deadlineMs + GRACE_PERIOD_MS) {
      return { success: false, message: "Deadline not yet passed" };
    }

    // Check phase
    const isDrawPhase = phase?.startsWith("DRAW_");
    const isBettingPhase = phase?.startsWith("BETTING_") ||
                          ["PREFLOP", "FLOP", "TURN", "RIVER"].includes(phase);

    if (!isDrawPhase && !isBettingPhase) {
      return { success: false, message: "Not in timed phase" };
    }

    // Get the active player
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer) {
      return { success: false, message: "No active player" };
    }

    if (activePlayer.status !== "active" && activePlayer.status !== "all-in") {
      return { success: false, message: "Active player cannot timeout" };
    }

    // Perform timeout action
    const updatedPlayers = players.map(p => removeUndefinedValues({ ...p }));
    const player = updatedPlayers[activePlayerIndex];
    let actionDescription = "";
    let actionTaken = "";

    if (isDrawPhase) {
      player.cardsToDiscard = [];
      player.hasActedThisRound = true;
      player.lastAction = "Stood Pat (timeout)";
      actionDescription = `${player.displayName} stood pat (timeout)`;
      actionTaken = "STAND_PAT";
    } else if (isBettingPhase) {
      const currentBet = tableData.currentBet || 0;

      if ((player.currentRoundBet || 0) >= currentBet) {
        player.hasActedThisRound = true;
        player.lastAction = "Check (timeout)";
        actionDescription = `${player.displayName} checked (timeout)`;
        actionTaken = "CHECK";
      } else {
        player.status = "folded";
        player.hasActedThisRound = true;
        player.lastAction = "Fold (timeout)";
        actionDescription = `${player.displayName} folded (timeout)`;
        actionTaken = "FOLD";
      }
    }

    // Find next player
    const nextPlayerResult = findNextPlayerAndCheckRound(
      updatedPlayers,
      activePlayerIndex,
      tableData
    );

    // Build update object
    const updates = {
      players: updatedPlayers,
      lastUpdated: FieldValue.serverTimestamp(),
      lastTimeoutProcessed: FieldValue.serverTimestamp(),
    };

    // Add activity log
    const chatLog = [...(tableData.chatLog || [])];
    chatLog.push({
      type: "activity",
      text: actionDescription,
      timestamp: Date.now(),
    });
    if (chatLog.length > 100) {
      updates.chatLog = chatLog.slice(-100);
    } else {
      updates.chatLog = chatLog;
    }

    // Handle phase transitions and next player
    if (nextPlayerResult.roundComplete) {
      const nextPhaseResult = getNextPhase(phase, updatedPlayers, tableData);
      updates.phase = nextPhaseResult.phase;
      updates.activePlayerIndex = nextPhaseResult.firstToAct;
      updates.currentBet = 0;

      updates.players = updatedPlayers.map(p => removeUndefinedValues({
        ...p,
        hasActedThisRound: false,
      }));

      if (nextPhaseResult.phase === "SHOWDOWN") {
        updates.turnDeadline = null;
      } else {
        updates.turnDeadline = calculateTurnDeadline(tableData.config?.turnTimeLimit);
      }
    } else if (nextPlayerResult.nextPlayerIndex !== -1) {
      updates.activePlayerIndex = nextPlayerResult.nextPlayerIndex;
      updates.turnDeadline = calculateTurnDeadline(tableData.config?.turnTimeLimit);
    } else {
      updates.phase = "SHOWDOWN";
      updates.turnDeadline = null;
    }

    transaction.update(tableRef, updates);

    return {
      success: true,
      action: actionTaken,
      message: actionDescription,
      timedOutPlayer: player.displayName,
      nextPhase: updates.phase,
    };
  });
}

/**
 * HTTP endpoint to manually trigger timeout processing
 * Useful for testing and for clients to request immediate processing
 * after a timeout expires (reduces latency from 1 minute to near-instant)
 */
exports.triggerTimeoutCheck = onRequest({
  cors: true,
  maxInstances: 10,
}, async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { tableId } = req.body;

  if (!tableId) {
    res.status(400).json({ success: false, error: "tableId is required" });
    return;
  }

  try {
    const tableRef = db.collection("tables").doc(tableId);
    const tableDoc = await tableRef.get();

    if (!tableDoc.exists) {
      res.status(404).json({ success: false, error: "Table not found" });
      return;
    }

    const tableData = tableDoc.data();
    const result = await processTableTimeout(tableRef, tableData);

    res.json(result);
  } catch (error) {
    console.error("Error in triggerTimeoutCheck:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * handleTimeout - Legacy Cloud Function for backward compatibility
 *
 * Clients can still call this, but the scheduled function is now the
 * primary mechanism. This provides a fallback and allows clients to
 * request immediate processing instead of waiting for the next scheduled run.
 */
exports.handleTimeout = onCall({
  cors: true,
  maxInstances: 10,
}, async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to handle timeout");
  }

  const { tableId } = request.data;
  const callerUid = request.auth.uid;

  if (!tableId) {
    throw new HttpsError("invalid-argument", "tableId is required");
  }

  const tableRef = db.collection("tables").doc(tableId);

  try {
    // Use a transaction for atomic read-check-update
    const result = await db.runTransaction(async (transaction) => {
      const tableDoc = await transaction.get(tableRef);

      if (!tableDoc.exists) {
        throw new HttpsError("not-found", "Table not found");
      }

      const tableData = tableDoc.data();
      const { players, phase, activePlayerIndex, turnDeadline, railbirds = [] } = tableData;

      // Verify caller is at this table (player or railbird can trigger)
      const isPlayer = players.some(p => p.uid === callerUid);
      const isRailbird = railbirds.some(r => r.uid === callerUid);

      if (!isPlayer && !isRailbird) {
        throw new HttpsError("permission-denied", "You are not at this table");
      }

      // Check if game is in a timed phase
      const isDrawPhase = phase?.startsWith("DRAW_");
      const isBettingPhase = phase?.startsWith("BETTING_") ||
                            ["PREFLOP", "FLOP", "TURN", "RIVER"].includes(phase);

      if (!isDrawPhase && !isBettingPhase) {
        return { success: false, message: "No active turn timer" };
      }

      // No deadline set
      if (!turnDeadline) {
        return { success: false, message: "No turn deadline set" };
      }

      // CRITICAL: Validate timeout using SERVER time (anti-cheat)
      const serverNow = Date.now();
      let deadlineMs;

      if (turnDeadline.toDate) {
        deadlineMs = turnDeadline.toDate().getTime();
      } else if (turnDeadline.seconds) {
        deadlineMs = turnDeadline.seconds * 1000;
      } else {
        deadlineMs = new Date(turnDeadline).getTime();
      }

      // Check if deadline has passed (with grace period for network latency)
      if (serverNow < deadlineMs - GRACE_PERIOD_MS) {
        const remaining = Math.ceil((deadlineMs - serverNow) / 1000);
        return {
          success: false,
          message: `Timeout not yet valid. ${remaining}s remaining.`,
          serverTime: serverNow,
          deadline: deadlineMs
        };
      }

      // Get the active player
      const activePlayer = players[activePlayerIndex];
      if (!activePlayer) {
        return { success: false, message: "No active player found" };
      }

      // Check if player is in a state that can timeout
      if (activePlayer.status !== "active" && activePlayer.status !== "all-in") {
        return { success: false, message: "Active player cannot timeout" };
      }

      // Perform timeout action
      // Use removeUndefinedValues to prevent Firestore "undefined field value" errors
      const updatedPlayers = players.map(p => removeUndefinedValues({ ...p }));
      const player = updatedPlayers[activePlayerIndex];
      let actionDescription = "";
      let actionTaken = "";

      if (isDrawPhase) {
        // Auto stand pat (discard nothing)
        player.cardsToDiscard = [];
        player.hasActedThisRound = true;
        player.lastAction = "Stood Pat (timeout)";
        actionDescription = `${player.displayName} stood pat (timeout)`;
        actionTaken = "STAND_PAT";
      } else if (isBettingPhase) {
        const currentBet = tableData.currentBet || 0;

        // Auto-check if possible, otherwise auto-fold
        if ((player.currentRoundBet || 0) >= currentBet) {
          player.hasActedThisRound = true;
          player.lastAction = "Check (timeout)";
          actionDescription = `${player.displayName} checked (timeout)`;
          actionTaken = "CHECK";
        } else {
          player.status = "folded";
          player.hasActedThisRound = true;
          player.lastAction = "Fold (timeout)";
          actionDescription = `${player.displayName} folded (timeout)`;
          actionTaken = "FOLD";
        }
      }

      // Find next player
      const nextPlayerResult = findNextPlayerAndCheckRound(
        updatedPlayers,
        activePlayerIndex,
        tableData
      );

      // Build update object
      const updates = {
        players: updatedPlayers,
        lastUpdated: FieldValue.serverTimestamp(),
      };

      // Add activity log
      const chatLog = [...(tableData.chatLog || [])];
      chatLog.push({
        type: "activity",
        text: actionDescription,
        timestamp: Date.now(),
      });
      // Keep only last 100 messages
      if (chatLog.length > 100) {
        updates.chatLog = chatLog.slice(-100);
      } else {
        updates.chatLog = chatLog;
      }

      // Handle phase transitions and next player
      if (nextPlayerResult.roundComplete) {
        const nextPhaseResult = getNextPhase(phase, updatedPlayers, tableData);
        updates.phase = nextPhaseResult.phase;
        updates.activePlayerIndex = nextPhaseResult.firstToAct;
        updates.currentBet = 0;

        // Reset hasActedThisRound for all players
        // Use removeUndefinedValues to prevent Firestore errors
        updates.players = updatedPlayers.map(p => removeUndefinedValues({
          ...p,
          hasActedThisRound: false,
        }));

        if (nextPhaseResult.phase === "SHOWDOWN") {
          updates.turnDeadline = null;
        } else {
          updates.turnDeadline = calculateTurnDeadline(tableData.config?.turnTimeLimit);
        }
      } else if (nextPlayerResult.nextPlayerIndex !== -1) {
        updates.activePlayerIndex = nextPlayerResult.nextPlayerIndex;
        updates.turnDeadline = calculateTurnDeadline(tableData.config?.turnTimeLimit);
      } else {
        // Edge case: no next player but round not complete
        // This shouldn't happen, but handle gracefully
        updates.phase = "SHOWDOWN";
        updates.turnDeadline = null;
      }

      transaction.update(tableRef, updates);

      return {
        success: true,
        action: actionTaken,
        message: actionDescription,
        timedOutPlayer: player.displayName,
        nextPhase: updates.phase,
      };
    });

    return result;

  } catch (error) {
    console.error("handleTimeout error:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to process timeout: " + error.message);
  }
});

/**
 * Calculate turn deadline using table config or default
 * @param {number} [turnTimeLimit] - Seconds per turn from table config
 */
function calculateTurnDeadline(turnTimeLimit) {
  const seconds = turnTimeLimit || TURN_TIME_SECONDS;
  const deadline = new Date();
  deadline.setSeconds(deadline.getSeconds() + seconds);
  return Timestamp.fromDate(deadline);
}

/**
 * Find the next player who can act and check if round is complete
 */
function findNextPlayerAndCheckRound(players, currentIndex, tableData) {
  const phase = tableData.phase;
  const isDrawPhase = phase?.startsWith("DRAW_");

  // Get players still in hand
  const playersInHand = players
    .map((p, i) => ({ player: p, index: i }))
    .filter(({ player: p }) => {
      if (isDrawPhase) {
        // Draw phase: all non-folded players can act
        return p.status === "active" || p.status === "all-in";
      } else {
        // Betting phase: only active players with chips can act (all-in can't bet more)
        return p.status === "active" && p.chips > 0;
      }
    });

  // Find next player who hasn't acted
  let nextPlayerIndex = -1;
  const currentPosInHand = playersInHand.findIndex(p => p.index === currentIndex);

  for (let i = 1; i <= playersInHand.length; i++) {
    const lookupIdx = (currentPosInHand + i) % playersInHand.length;
    const candidate = playersInHand[lookupIdx];
    if (!candidate.player.hasActedThisRound) {
      nextPlayerIndex = candidate.index;
      break;
    }
  }

  // Check if round is complete
  let roundComplete = false;

  if (!isDrawPhase) {
    // Betting round: complete when all active players have acted and matched the bet
    const currentBet = tableData.currentBet || 0;
    roundComplete = playersInHand.every(({ player: p }) =>
      p.hasActedThisRound && (p.currentRoundBet || 0) >= currentBet
    );
  } else {
    // Draw round: complete when all players have acted
    const drawPlayers = players.filter(p => p.status === "active" || p.status === "all-in");
    roundComplete = drawPlayers.every(p => p.hasActedThisRound);
  }

  return { nextPlayerIndex, roundComplete };
}

/**
 * Determine the next phase after current phase completes
 */
function getNextPhase(currentPhase, players, tableData) {
  const gameType = tableData.config?.gameType || "lowball_27";

  // Count active players (can still bet)
  const activePlayers = players.filter(p => p.status === "active" && p.chips > 0);
  const allInPlayers = players.filter(p => p.status === "all-in");
  const playersInHand = players.filter(p => p.status === "active" || p.status === "all-in");

  // If only one player left, go to showdown
  if (playersInHand.length <= 1) {
    return { phase: "SHOWDOWN", firstToAct: 0 };
  }

  // If no one can bet (all all-in or one active vs all-ins), skip to showdown
  if (activePlayers.length <= 1 && allInPlayers.length > 0) {
    return { phase: "SHOWDOWN", firstToAct: 0 };
  }

  // Phase transitions
  if (gameType === "holdem") {
    const holdemOrder = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"];
    const currentIdx = holdemOrder.indexOf(currentPhase);
    const nextPhase = holdemOrder[currentIdx + 1] || "SHOWDOWN";

    // Find first to act (first active player after dealer)
    const dealerIndex = tableData.dealerIndex || 0;
    let firstToAct = 0;
    for (let i = 1; i <= players.length; i++) {
      const idx = (dealerIndex + i) % players.length;
      if (players[idx].status === "active" && players[idx].chips > 0) {
        firstToAct = idx;
        break;
      }
    }

    return { phase: nextPhase, firstToAct };
  } else {
    // Draw poker phase order - varies by game type
    const isSingleDraw = gameType === "single_draw_27";
    const phaseOrder = isSingleDraw ? {
      "BETTING_1": "DRAW_1",
      "DRAW_1": "BETTING_2",
      "BETTING_2": "SHOWDOWN",
    } : {
      "BETTING_1": "DRAW_1",
      "DRAW_1": "BETTING_2",
      "BETTING_2": "DRAW_2",
      "DRAW_2": "BETTING_3",
      "BETTING_3": "DRAW_3",
      "DRAW_3": "BETTING_4",
      "BETTING_4": "SHOWDOWN",
    };

    const nextPhase = phaseOrder[currentPhase] || "SHOWDOWN";

    // Find first to act
    const dealerIndex = tableData.dealerIndex || 0;
    let firstToAct = 0;

    if (nextPhase.startsWith("DRAW_")) {
      // Draw phase: all non-folded players participate
      for (let i = 1; i <= players.length; i++) {
        const idx = (dealerIndex + i) % players.length;
        if (players[idx].status === "active" || players[idx].status === "all-in") {
          firstToAct = idx;
          break;
        }
      }
    } else {
      // Betting phase: only active players with chips
      for (let i = 1; i <= players.length; i++) {
        const idx = (dealerIndex + i) % players.length;
        if (players[idx].status === "active" && players[idx].chips > 0) {
          firstToAct = idx;
          break;
        }
      }
    }

    return { phase: nextPhase, firstToAct };
  }
}

// ============================================================================
// HAND HISTORY RECORDING (Server-side for security)
// ============================================================================

/**
 * Position labels by seat count and dealer-relative index
 */
const POSITION_LABELS = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "UTG"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
};

function getPositionLabel(playerIndex, dealerIndex, totalPlayers) {
  const positions = POSITION_LABELS[totalPlayers] || POSITION_LABELS[6];
  const relativeIndex = (playerIndex - dealerIndex + totalPlayers) % totalPlayers;
  return positions[relativeIndex] || "UTG";
}

/**
 * recordHandHistory - Cloud Function to securely record hand history
 *
 * Called by the client after showdown, but the server reads the authoritative
 * table state to build the hand record. This prevents clients from forging
 * hand histories or writing to other users' collections.
 *
 * Security:
 * - Verifies caller is authenticated and is a player at the table
 * - Reads table state server-side (no client-supplied game data trusted)
 * - Uses Admin SDK to write to all players' hand_logs (cross-user writes)
 * - Only records if the table is in SHOWDOWN phase with a valid showdownResult
 */
exports.recordHandHistory = onCall({
  cors: true,
  maxInstances: 10,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { tableId } = request.data;
  const callerUid = request.auth.uid;

  if (!tableId) {
    throw new HttpsError("invalid-argument", "tableId is required");
  }

  try {
    const tableRef = db.collection("tables").doc(tableId);
    const tableDoc = await tableRef.get();

    if (!tableDoc.exists) {
      throw new HttpsError("not-found", "Table not found");
    }

    const tableData = tableDoc.data();

    // Verify caller is a player at this table
    const isPlayer = tableData.players.some(p => p.uid === callerUid);
    if (!isPlayer) {
      throw new HttpsError("permission-denied", "You are not a player at this table");
    }

    // Only record if there's a showdown result
    const showdownResult = tableData.showdownResult;
    if (!showdownResult || !showdownResult.winners) {
      return { success: false, message: "No showdown result to record" };
    }

    // Build hand record from server-authoritative table state
    const gameType = tableData.config?.gameType || "lowball_27";
    const bettingType = tableData.config?.bettingType || "no_limit";
    const playerCount = tableData.players.length;
    const dealerIndex = tableData.dealerSeatIndex || 0;
    const handNumber = tableData.handNumber || Date.now();
    const handId = `${tableId}_${handNumber}`;

    // Check if this hand was already recorded (idempotency)
    const existingHand = await db.collection("hand_histories").doc(handId).get();
    if (existingHand.exists) {
      return { success: true, message: "Hand already recorded", handId };
    }

    // Determine which players reached showdown (active/all-in at end)
    const showdownPlayerUids = new Set(
      tableData.players
        .filter((p) => p.status === "active" || p.status === "all-in")
        .map((p) => p.uid)
    );

    // Map uid -> original hole cards so each player's own hand_log preserves their cards
    const originalHoleCards = {};
    tableData.players.forEach((p) => {
      originalHoleCards[p.uid] = p.hand || [];
    });

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

    const winnerRecords = (showdownResult.winners || []).map((w) => ({
      uid: w.uid || w.playerId,
      displayName: w.displayName || w.name,
      amount: w.amount || w.winnings || 0,
      handDescription: w.handDescription || w.handType || "",
    }));

    const totalPot = (tableData.pots || []).reduce((sum, p) => sum + (p.amount || 0), 0) || tableData.pot || 0;

    const handRecord = {
      handId,
      tableId,
      handNumber,
      timestamp: new Date().toISOString(),
      gameType,
      bettingType,
      stakeLevel: tableData.minBet || 50,
      tableMode: tableData.config?.tableMode || "cash_game",
      playerCount,
      dealerIndex,
      players: playerRecords,
      winners: winnerRecords,
      communityCards: tableData.communityCards || [],
      totalPot,
      pots: tableData.pots || [],
    };

    // Write using a batch for atomicity
    const batch = db.batch();

    // Save main hand record
    const handRef = db.collection("hand_histories").doc(handId);
    batch.set(handRef, {
      ...handRecord,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Save per-player index entries for fast user queries
    for (const player of playerRecords) {
      if (player.isBot) continue;

      const winner = winnerRecords.find((w) => w.uid === player.uid);
      const netResult = winner
        ? winner.amount - player.totalContribution
        : -player.totalContribution;

      const opponentUids = playerRecords
        .filter((p) => p.uid !== player.uid)
        .map((p) => p.uid);

      const userHandRef = db.collection("users").doc(player.uid).collection("hand_logs").doc(handId);
      batch.set(userHandRef, {
        handId,
        tableId,
        timestamp: handRecord.timestamp,
        gameType,
        bettingType,
        stakeLevel: handRecord.stakeLevel,
        position: player.position,
        // Always store the player's own original hole cards in their personal hand_log
        holeCards: originalHoleCards[player.uid] || [],
        status: player.status,
        totalContribution: player.totalContribution,
        netResult,
        isWinner: !!winner,
        winAmount: winner?.amount || 0,
        handDescription: winner?.handDescription || "",
        playerCount,
        opponentUids,
        opponents: playerRecords
          .filter((p) => p.uid !== player.uid)
          .map((p) => ({ uid: p.uid, displayName: p.displayName, isBot: p.isBot })),
        vsBot: playerRecords.some((p) => p.uid !== player.uid && p.isBot),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return { success: true, handId };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("recordHandHistory error:", error);
    throw new HttpsError("internal", "Failed to record hand history");
  }
});
