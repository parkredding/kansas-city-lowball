import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { GameService, BetAction } from '../game/GameService';
import { HandEvaluator } from '../game/HandEvaluator';
import { TexasHoldemHandEvaluator } from '../game/TexasHoldemHandEvaluator';
import { DEFAULT_MIN_BET, GAME_TYPES, TABLE_MODES, TOURNAMENT_STATES, getBlindLevel } from '../game/constants';

const GameContext = createContext();

/**
 * Check if a user needs to set their username
 * @param {Object} userWallet - User wallet data
 * @returns {boolean} - True if username is not set
 */
const needsUsernameSetup = (userWallet) => {
  return !userWallet?.username || userWallet.username.trim().length === 0;
};

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export function GameProvider({ children }) {
  const { currentUser } = useAuth();
  const [currentTableId, setCurrentTableId] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // User wallet state
  const [userWallet, setUserWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Track if we've requested timeout processing to avoid duplicate requests
  // Note: In server-hosted model, the server handles deduplication via transactions
  const timeoutRequestedRef = useRef(false);

  // Initialize user wallet when logged in
  useEffect(() => {
    if (!currentUser) {
      setUserWallet(null);
      return;
    }

    setWalletLoading(true);

    // Initialize user (creates if doesn't exist)
    GameService.getOrCreateUser(currentUser.uid, currentUser.displayName)
      .then((userData) => {
        setUserWallet(userData);
        setWalletLoading(false);
      })
      .catch((err) => {
        console.error('Error initializing user:', err);
        setWalletLoading(false);
      });

    // Subscribe to user wallet updates
    const unsubscribe = GameService.subscribeToUser(currentUser.uid, (data, err) => {
      if (err) {
        console.error('User subscription error:', err);
      } else if (data) {
        setUserWallet(data);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to table updates when currentTableId changes
  useEffect(() => {
    if (!currentTableId) {
      setTableData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = GameService.subscribeToTable(currentTableId, (data, err) => {
      setLoading(false);
      if (err) {
        setError(err.message);
        setTableData(null);
      } else {
        setTableData(data);
        setError(null);
        // Reset timeout request flag when table data changes (new turn started)
        timeoutRequestedRef.current = false;
      }
    });

    return () => unsubscribe();
  }, [currentTableId]);

  // Create a new table
  const createTable = useCallback(async (config = null) => {
    if (!currentUser) {
      setError('You must be logged in to create a table');
      return null;
    }

    if (needsUsernameSetup(userWallet)) {
      setError('Please set your username before creating a table');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Don't pass minBet explicitly - let it use the default value
      const tableId = await GameService.createTable(currentUser, userWallet, DEFAULT_MIN_BET, config);
      setCurrentTableId(tableId);
      return tableId;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userWallet]);

  // Join an existing table (as player or railbird depending on game state)
  const joinTable = useCallback(async (tableId, password = null, asRailbird = false) => {
    if (!currentUser) {
      setError('You must be logged in to join a table');
      return false;
    }

    if (!tableId) {
      setError('Please enter a table ID');
      return false;
    }

    if (needsUsernameSetup(userWallet)) {
      setError('Please set your username before joining a table');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await GameService.joinTable(tableId.toUpperCase(), currentUser, userWallet, password, asRailbird);
      setCurrentTableId(tableId.toUpperCase());
      return result; // Returns { joinedAs: 'player' | 'railbird' }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userWallet]);

  // Buy in to current table
  const buyIn = useCallback(async (amount) => {
    if (!currentTableId || !currentUser) {
      setError('Must be at a table to buy in');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await GameService.buyInToTable(currentTableId, currentUser.uid, amount);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentTableId, currentUser]);

  // Leave the current table (with cash out if player, or remove from railbirds)
  const leaveTable = useCallback(async () => {
    if (!currentTableId || !tableData || !currentUser) return;

    try {
      // Check if user is a railbird
      const isRailbird = (tableData.railbirds || []).some((r) => r.uid === currentUser.uid);
      
      if (isRailbird) {
        await GameService.removeRailbird(currentTableId, currentUser.uid);
      } else {
        await GameService.leaveTable(currentTableId, tableData, currentUser.uid);
      }
    } catch (err) {
      console.error('Error leaving table:', err);
    }

    setCurrentTableId(null);
    setTableData(null);
    setError(null);
  }, [currentTableId, tableData, currentUser]);

  // Kick a bot player from the table (only table creator can do this)
  const kickBot = useCallback(async (botUid) => {
    if (!currentTableId || !currentUser) {
      setError('Must be at a table to kick bots');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await GameService.kickBot(currentTableId, botUid, currentUser.uid);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentTableId, currentUser]);

  // Add a bot player to the table (only table creator can do this)
  // If game is in progress, bot will be flagged to join next hand
  const addBot = useCallback(async (difficulty = 'hard') => {
    if (!currentTableId || !currentUser) {
      setError('Must be at a table to add bots');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const bot = await GameService.addBot(currentTableId, currentUser.uid, difficulty);
      return bot;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentTableId, currentUser]);

  // Promote self from railbird to player (when game is IDLE and seats available)
  const joinAsPlayer = useCallback(async () => {
    if (!currentTableId || !currentUser) {
      setError('Must be at a table to join as player');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await GameService.promoteRailbirdToPlayer(currentTableId, currentUser.uid);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentTableId, currentUser]);

  // Request to sit out from the game
  // If game is IDLE: Immediately demote to railbird
  // If game is in progress: Set pending flag (will become railbird after hand ends)
  const requestSitOut = useCallback(async () => {
    if (!currentTableId || !currentUser) {
      setError('Must be at a table to sit out');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await GameService.requestSitOut(currentTableId, currentUser.uid);
      return { success: true, immediate: result.immediate };
    } catch (err) {
      setError(err.message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [currentTableId, currentUser]);

  // Cancel a pending sit out request
  const cancelSitOut = useCallback(async () => {
    if (!currentTableId || !currentUser) {
      setError('Must be at a table to cancel sit out');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await GameService.cancelSitOut(currentTableId, currentUser.uid);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentTableId, currentUser]);

  // Check if current player has pending sit out
  const hasPendingSitOut = useCallback(() => {
    if (!tableData || !currentUser) return false;
    const player = tableData.players.find((p) => p.uid === currentUser.uid);
    return player?.pendingSitOut === true;
  }, [tableData, currentUser]);

  // Start cut for dealer phase (first hand of game)
  const startCutForDealer = useCallback(async () => {
    if (!currentTableId || !tableData) return;

    try {
      await GameService.startCutForDealer(currentTableId, tableData);
    } catch (err) {
      setError(err.message);
    }
  }, [currentTableId, tableData]);

  // Resolve cut for dealer and proceed to deal
  const resolveCutForDealer = useCallback(async () => {
    if (!currentTableId || !tableData) return;

    try {
      await GameService.resolveCutForDealer(currentTableId, tableData);
    } catch (err) {
      setError(err.message);
    }
  }, [currentTableId, tableData]);

  // Deal cards (start the game)
  const dealCards = useCallback(async () => {
    if (!currentTableId || !tableData) return;

    try {
      // Check if this is the first hand (no dealer has been determined yet)
      // If hasHadFirstDeal is not set and we're in IDLE, start cut for dealer
      if (!tableData.hasHadFirstDeal && tableData.phase === 'IDLE') {
        await GameService.startCutForDealer(currentTableId, tableData);
      } else {
        // Deal based on game type
        const gameType = tableData.config?.gameType || 'lowball_27';
        if (gameType === 'holdem') {
          await GameService.dealHoldemCards(currentTableId, tableData);
        } else {
          await GameService.dealCards(currentTableId, tableData);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }, [currentTableId, tableData]);

  // Perform a betting action (FOLD, CHECK, CALL, RAISE, BET, ALL_IN)
  // Returns { success: true } on success, or { success: false, error: string } on failure
  const performBetAction = useCallback(async (action, amount = 0) => {
    if (!currentTableId || !tableData || !currentUser) {
      return { success: false, error: 'Not connected to table' };
    }

    try {
      const result = await GameService.performBetAction(currentTableId, tableData, currentUser.uid, action, amount);
      setError(null);
      return { success: true, ...result };
    } catch (err) {
      // Set error for display in UI
      setError(err.message);
      // Return error info so UI can show immediate feedback
      return { success: false, error: err.message };
    }
  }, [currentTableId, tableData, currentUser]);

  // Submit a bet (legacy interface)
  const submitBet = useCallback(async (amount = 0) => {
    if (!currentTableId || !tableData || !currentUser) return;

    try {
      await GameService.submitBet(currentTableId, tableData, currentUser.uid, amount);
    } catch (err) {
      setError(err.message);
    }
  }, [currentTableId, tableData, currentUser]);

  // Submit a draw
  const submitDraw = useCallback(async (cardIndices = []) => {
    if (!currentTableId || !tableData || !currentUser) return;

    try {
      await GameService.submitDraw(currentTableId, tableData, currentUser.uid, cardIndices);
    } catch (err) {
      setError(err.message);
    }
  }, [currentTableId, tableData, currentUser]);

  // Start next hand
  const startNextHand = useCallback(async () => {
    if (!currentTableId || !tableData) return;

    try {
      await GameService.startNextHand(currentTableId, tableData);
    } catch (err) {
      setError(err.message);
    }
  }, [currentTableId, tableData]);

  // Reveal hand at showdown (show instead of muck)
  const revealHand = useCallback(async () => {
    if (!currentTableId || !currentUser) return false;

    try {
      await GameService.revealHand(currentTableId, currentUser.uid);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [currentTableId, currentUser]);

  // Request server-side timeout processing (Server-Hosted Architecture)
  //
  // In the server-hosted model:
  // - The server's scheduled function processes ALL timeouts automatically (every ~1 minute)
  // - Clients can request IMMEDIATE processing to reduce latency
  // - This is fire-and-forget - the server handles everything
  // - No need for client-side fallback - server will always process eventually
  //
  // Benefits over the old passive timer system:
  // - No race conditions from player refresh/back button
  // - No timer hang bugs from client-side claiming failures
  // - Server is single source of truth for all state transitions
  const handleTimeout = useCallback(async () => {
    if (!currentTableId || !tableData || !currentUser) return;
    if (timeoutRequestedRef.current) return;

    const activePlayer = tableData.players[tableData.activePlayerIndex];
    if (!activePlayer) return;

    // Mark as requested to avoid duplicate requests
    // The server handles actual deduplication via transactions
    timeoutRequestedRef.current = true;

    try {
      // Request immediate server-side processing (fire-and-forget)
      // Even if this fails, the server's scheduled function will process it
      const result = await GameService.requestTimeoutProcessing(currentTableId);

      if (result.success) {
        console.log('Server processed timeout:', result.message);
      } else {
        // Reset flag to allow retry - the server may not have processed it yet
        // (e.g., clock skew, deadline not yet passed on server side)
        console.log('Timeout request not processed:', result.message);
        timeoutRequestedRef.current = false;
      }
    } catch (err) {
      console.error('Error requesting timeout processing:', err);
      // Reset flag to allow retry, but server will handle it anyway
      timeoutRequestedRef.current = false;
    }
  }, [currentTableId, tableData, currentUser]);

  // Get current player's data
  const getCurrentPlayer = useCallback(() => {
    if (!tableData || !currentUser) return null;
    return tableData.players.find((p) => p.uid === currentUser.uid);
  }, [tableData, currentUser]);

  // Check if current user is a railbird
  const isRailbird = useCallback(() => {
    if (!tableData || !currentUser) return false;
    return (tableData.railbirds || []).some((r) => r.uid === currentUser.uid);
  }, [tableData, currentUser]);

  // Get current user's railbird data
  const getCurrentRailbird = useCallback(() => {
    if (!tableData || !currentUser) return null;
    return (tableData.railbirds || []).find((r) => r.uid === currentUser.uid);
  }, [tableData, currentUser]);

  // Check if user can become a player (is railbird, game is IDLE, seats available)
  const canBecomePlayer = useCallback(() => {
    if (!tableData || !currentUser) return false;
    const userIsRailbird = (tableData.railbirds || []).some((r) => r.uid === currentUser.uid);
    const gameIsIdle = tableData.phase === 'IDLE';
    const seatsAvailable = tableData.players.length < 6; // MAX_PLAYERS
    return userIsRailbird && gameIsIdle && seatsAvailable;
  }, [tableData, currentUser]);

  // Check if the current user is the table creator
  const isTableCreator = useCallback(() => {
    if (!tableData || !currentUser) return false;
    return tableData.createdBy === currentUser.uid;
  }, [tableData, currentUser]);

  // Check if it's the current user's turn
  const isMyTurn = useCallback(() => {
    if (!tableData || !currentUser) return false;
    const playerIndex = tableData.players.findIndex((p) => p.uid === currentUser.uid);
    return playerIndex === tableData.activePlayerIndex;
  }, [tableData, currentUser]);

  // Get the active player
  const getActivePlayer = useCallback(() => {
    if (!tableData || tableData.players.length === 0) return null;
    return tableData.players[tableData.activePlayerIndex];
  }, [tableData]);

  // Evaluate a hand (game-type aware)
  const evaluateHand = useCallback((hand, communityCards = null) => {
    const gameType = tableData?.config?.gameType || 'lowball_27';

    if (gameType === 'holdem') {
      // For Hold'em, combine hole cards with community cards
      const community = communityCards || tableData?.communityCards || [];
      const allCards = [...(hand || []), ...community];
      if (allCards.length < 5) return null;
      return TexasHoldemHandEvaluator.evaluate(allCards);
    } else {
      // For Lowball, evaluate 5-card hand directly
      if (!hand || hand.length !== 5) return null;
      return HandEvaluator.evaluate(hand);
    }
  }, [tableData]);

  // Calculate call amount
  const getCallAmount = useCallback(() => {
    if (!tableData || !currentUser) return 0;
    const player = tableData.players.find((p) => p.uid === currentUser.uid);
    if (!player) return 0;
    const currentBet = tableData.currentBet || 0;
    return Math.max(0, currentBet - (player.currentRoundBet || 0));
  }, [tableData, currentUser]);

  // Calculate minimum raise
  // For No Limit / Pot Limit:
  //   - BET (currentBet = 0): minimum is the big blind
  //   - RAISE: minimum is currentBet + max(bigBlind, lastRaiseAmount)
  //     This ensures raises are always at least 2x the big blind
  // For Fixed Limit: raises are in fixed increments of the big blind
  const getMinRaise = useCallback(() => {
    if (!tableData) return 0;
    const currentBet = tableData.currentBet || 0;
    const bettingType = tableData.config?.bettingType || 'no_limit';

    // Determine the big blind amount based on game mode
    let bigBlind;
    const isSitAndGo = tableData.config?.tableMode === TABLE_MODES.SIT_AND_GO;
    const blindTimer = tableData.tournament?.blindTimer;

    if (isSitAndGo && blindTimer) {
      // For SnG tournaments, use the current blind level
      const blindInfo = getBlindLevel(blindTimer.currentLevel || 0);
      bigBlind = blindInfo.bigBlind;
    } else {
      // For cash games, minBet represents the big blind
      bigBlind = tableData.minBet || DEFAULT_MIN_BET;
    }

    // For Fixed Limit: raises are in fixed increments of the big blind
    if (bettingType === 'fixed_limit') {
      return currentBet + bigBlind;
    }

    // No Limit / Pot Limit:
    // BET (no current bet): minimum is the big blind
    if (currentBet === 0) {
      return bigBlind;
    }

    // RAISE: minimum raise increment must match previous raise or big blind (whichever is larger)
    const lastRaise = tableData.lastRaiseAmount || 0;
    const minRaiseIncrement = Math.max(bigBlind, lastRaise);
    return currentBet + minRaiseIncrement;
  }, [tableData]);

  // Check if player can check
  const canCheck = useCallback(() => {
    if (!tableData || !currentUser) return false;
    const player = tableData.players.find((p) => p.uid === currentUser.uid);
    if (!player) return false;
    const currentBet = tableData.currentBet || 0;
    return (player.currentRoundBet || 0) >= currentBet;
  }, [tableData, currentUser]);

  // Determine phase helpers
  const gameType = tableData?.config?.gameType || 'lowball_27';
  const isHoldem = gameType === 'holdem';

  // Hold'em phases: PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
  const holdemBettingPhases = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
  const isBettingPhase = tableData?.phase?.startsWith('BETTING_') ||
                         holdemBettingPhases.includes(tableData?.phase);
  const isDrawPhase = tableData?.phase?.startsWith('DRAW_') || false;
  const isShowdown = tableData?.phase === 'SHOWDOWN';
  const isIdle = tableData?.phase === 'IDLE';
  const isCutForDealer = tableData?.phase === 'CUT_FOR_DEALER';

  // Hold'em specific phases
  const isPreflop = tableData?.phase === 'PREFLOP';
  const isFlop = tableData?.phase === 'FLOP';
  const isTurn = tableData?.phase === 'TURN';
  const isRiver = tableData?.phase === 'RIVER';

  // Check if user needs to set username
  const needsUsername = needsUsernameSetup(userWallet);

  // Update username
  const updateUsername = useCallback(async (newUsername) => {
    if (!currentUser) {
      throw new Error('Must be logged in to update username');
    }

    setLoading(true);
    try {
      await GameService.updateUsername(currentUser.uid, newUsername);
      // The subscription will update userWallet automatically
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Send chat message
  const sendChatMessage = useCallback(async (text) => {
    if (!currentTableId || !userWallet) {
      return;
    }

    const senderName = GameService.getDisplayName(userWallet);
    try {
      await GameService.sendChatMessage(currentTableId, senderName, text);
    } catch (err) {
      console.error('Failed to send chat message:', err);
      setError('Failed to send message');
    }
  }, [currentTableId, userWallet]);

  // Get current user's display name (username or fallback)
  const getDisplayName = useCallback(() => {
    return GameService.getDisplayName(userWallet);
  }, [userWallet]);

  // ============================================
  // TOURNAMENT STATE & HELPERS
  // ============================================

  // Check if table is a Sit & Go tournament
  const isSitAndGo = useCallback(() => {
    return GameService.isSitAndGo(tableData);
  }, [tableData]);

  // Check tournament state
  const isTournamentRegistering = useCallback(() => {
    return GameService.isTournamentRegistering(tableData);
  }, [tableData]);

  const isTournamentRunning = useCallback(() => {
    return GameService.isTournamentRunning(tableData);
  }, [tableData]);

  const isTournamentCompleted = useCallback(() => {
    return GameService.isTournamentCompleted(tableData);
  }, [tableData]);

  // Get tournament info for display
  const getTournamentInfo = useCallback(() => {
    return GameService.getTournamentInfo(tableData);
  }, [tableData]);

  // Handle tournament elimination
  const handleTournamentElimination = useCallback(async (playerUid) => {
    if (!currentTableId) {
      setError('Not connected to table');
      return null;
    }

    try {
      const result = await GameService.handleTournamentElimination(currentTableId, playerUid);

      // If tournament completed, distribute prizes
      if (result.tournamentComplete) {
        await GameService.completeTournament(currentTableId);
      }

      return result;
    } catch (err) {
      console.error('Failed to handle elimination:', err);
      setError(err.message);
      return null;
    }
  }, [currentTableId]);

  // Increase blind level when timer expires
  const increaseBlindLevel = useCallback(async () => {
    if (!currentTableId) {
      return { success: false, error: 'Not connected to table' };
    }

    try {
      const result = await GameService.increaseBlindLevel(currentTableId);
      return result;
    } catch (err) {
      console.error('Failed to increase blind level:', err);
      return { success: false, error: err.message };
    }
  }, [currentTableId]);

  // Check for players that need to be eliminated
  const getPlayersToEliminate = useCallback(() => {
    return GameService.getPlayersToEliminate(tableData);
  }, [tableData]);

  // Check if current user can join the tournament (railbird wanting to become player)
  const canJoinTournament = useCallback(() => {
    if (!tableData || !currentUser) return false;

    const tournament = tableData.tournament;
    if (!tournament) return false;

    // Must be in REGISTERING state
    if (tournament.state !== TOURNAMENT_STATES.REGISTERING) return false;

    // Must be a railbird
    const userIsRailbird = (tableData.railbirds || []).some((r) => r.uid === currentUser.uid);
    if (!userIsRailbird) return false;

    // Must have available seats
    const seatsAvailable = tableData.players.length < tournament.totalSeats;
    if (!seatsAvailable) return false;

    // Must have sufficient balance
    const userBalance = userWallet?.balance || 0;
    if (userBalance < tournament.buyIn) return false;

    // Must not have been previously eliminated
    const wasEliminated = (tournament.eliminationOrder || []).some(e => e.uid === currentUser.uid);
    if (wasEliminated) return false;

    return true;
  }, [tableData, currentUser, userWallet]);

  // Check if current player is eliminated in tournament
  const isEliminated = useCallback(() => {
    if (!tableData || !currentUser) return false;
    if (!GameService.isSitAndGo(tableData)) return false;

    const player = tableData.players.find((p) => p.uid === currentUser.uid);
    return player?.seatState === 'ELIMINATED' || player?.status === 'eliminated';
  }, [tableData, currentUser]);

  // Get current player's finish position in tournament
  const getFinishPosition = useCallback(() => {
    if (!tableData || !currentUser) return null;
    if (!GameService.isSitAndGo(tableData)) return null;

    const player = tableData.players.find((p) => p.uid === currentUser.uid);
    return player?.finishPosition || null;
  }, [tableData, currentUser]);

  const value = {
    // State
    currentTableId,
    tableData,
    loading,
    error,

    // Wallet state
    userWallet,
    walletLoading,

    // Username state
    needsUsername,

    // Phase helpers
    isBettingPhase,
    isDrawPhase,
    isShowdown,
    isIdle,
    isCutForDealer,

    // Hold'em phase helpers
    isHoldem,
    isPreflop,
    isFlop,
    isTurn,
    isRiver,
    gameType,

    // Actions
    createTable,
    joinTable,
    buyIn,
    leaveTable,
    dealCards,
    performBetAction,
    submitBet,
    submitDraw,
    startNextHand,
    revealHand,
    handleTimeout,
    updateUsername,
    sendChatMessage,
    kickBot,
    addBot,
    joinAsPlayer,
    requestSitOut,
    cancelSitOut,
    startCutForDealer,
    resolveCutForDealer,

    // Utilities
    getCurrentPlayer,
    isMyTurn,
    getActivePlayer,
    evaluateHand,
    getCallAmount,
    getMinRaise,
    canCheck,
    getDisplayName,
    setError,
    isRailbird,
    getCurrentRailbird,
    canBecomePlayer,
    isTableCreator,
    hasPendingSitOut,

    // Tournament state & helpers
    isSitAndGo,
    isTournamentRegistering,
    isTournamentRunning,
    isTournamentCompleted,
    getTournamentInfo,
    handleTournamentElimination,
    increaseBlindLevel,
    getPlayersToEliminate,
    canJoinTournament,
    isEliminated,
    getFinishPosition,

    // Export BetAction for use in components
    BetAction,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Re-export BetAction for convenience
export { BetAction };
