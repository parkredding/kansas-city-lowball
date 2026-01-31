/**
 * Cloud Functions for Kansas City Lowball Poker
 *
 * PASSIVE TIMER SYSTEM (Timestamp & Client-Claim)
 * ================================================
 *
 * This implements a cost-effective timeout system that:
 * 1. Server writes `turnDeadline` ONCE when a turn begins (no intervals)
 * 2. Clients display countdown locally using (turnDeadline - Date.now())
 * 3. ANY client can claim a timeout by calling handleTimeout when timer hits 0
 * 4. Server validates using server time to prevent cheating
 *
 * This approach stays within Firebase Free Tier limits by:
 * - No server-side intervals or scheduled functions
 * - Single write per turn (not per second)
 * - Client-triggered enforcement (on-demand invocation)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Constants
const TURN_TIME_SECONDS = 45;
const GRACE_PERIOD_MS = 2000; // 2 second grace period for network latency

/**
 * handleTimeout - Secure Cloud Function to enforce turn timeouts
 *
 * This function can be triggered by ANY authenticated player when a timer expires.
 * It validates that the deadline has actually passed using server time,
 * preventing clients from cheating by triggering early.
 *
 * ANTI-HANG LOGIC:
 * - Any player at the table can trigger timeout for the active player
 * - Server validates turnDeadline against server time
 * - Atomic transaction ensures exactly one timeout action executes
 * - Idempotent: multiple calls for same timeout are safely ignored
 *
 * @param {Object} data - { tableId: string }
 * @param {Object} context - Firebase auth context
 * @returns {Object} - { success: boolean, action?: string, message?: string }
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
      const updatedPlayers = players.map(p => ({ ...p }));
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
        updates.players = updatedPlayers.map(p => ({
          ...p,
          hasActedThisRound: false,
        }));

        if (nextPhaseResult.phase === "SHOWDOWN") {
          updates.turnDeadline = null;
        } else {
          updates.turnDeadline = calculateTurnDeadline();
        }
      } else if (nextPlayerResult.nextPlayerIndex !== -1) {
        updates.activePlayerIndex = nextPlayerResult.nextPlayerIndex;
        updates.turnDeadline = calculateTurnDeadline();
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
 * Calculate turn deadline (45 seconds from now)
 */
function calculateTurnDeadline() {
  const deadline = new Date();
  deadline.setSeconds(deadline.getSeconds() + TURN_TIME_SECONDS);
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
    // Lowball phase order
    const phaseOrder = {
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
