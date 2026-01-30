import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { GameService, BetAction } from '../game/GameService';
import { HandEvaluator } from '../game/HandEvaluator';
import { DEFAULT_MIN_BET } from '../game/constants';

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

  // Track if we've processed a timeout to avoid duplicates
  const timeoutProcessedRef = useRef(false);

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
        // Reset timeout flag when table data changes
        timeoutProcessedRef.current = false;
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

  // Join an existing table
  const joinTable = useCallback(async (tableId, password = null) => {
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
      await GameService.joinTable(tableId.toUpperCase(), currentUser, userWallet, password);
      setCurrentTableId(tableId.toUpperCase());
      return true;
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

  // Leave the current table (with cash out)
  const leaveTable = useCallback(async () => {
    if (!currentTableId || !tableData || !currentUser) return;

    try {
      await GameService.leaveTable(currentTableId, tableData, currentUser.uid);
    } catch (err) {
      console.error('Error leaving table:', err);
    }

    setCurrentTableId(null);
    setTableData(null);
    setError(null);
  }, [currentTableId, tableData, currentUser]);

  // Deal cards (start the game)
  const dealCards = useCallback(async () => {
    if (!currentTableId || !tableData) return;

    try {
      await GameService.dealCards(currentTableId, tableData);
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

  // Handle turn timeout (auto-fold/check)
  const handleTimeout = useCallback(async () => {
    if (!currentTableId || !tableData || !currentUser) return;
    if (timeoutProcessedRef.current) return;

    const activePlayer = tableData.players[tableData.activePlayerIndex];
    if (!activePlayer) return;

    // Only the active player should trigger timeout action
    // This prevents multiple clients from triggering the same action
    if (activePlayer.uid !== currentUser.uid) return;

    timeoutProcessedRef.current = true;

    try {
      await GameService.handleTimeout(currentTableId, tableData, activePlayer.uid);
    } catch (err) {
      console.error('Error handling timeout:', err);
      timeoutProcessedRef.current = false;
    }
  }, [currentTableId, tableData, currentUser]);

  // Get current player's data
  const getCurrentPlayer = useCallback(() => {
    if (!tableData || !currentUser) return null;
    return tableData.players.find((p) => p.uid === currentUser.uid);
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

  // Evaluate a hand
  const evaluateHand = useCallback((hand) => {
    if (!hand || hand.length !== 5) return null;
    return HandEvaluator.evaluate(hand);
  }, []);

  // Calculate call amount
  const getCallAmount = useCallback(() => {
    if (!tableData || !currentUser) return 0;
    const player = tableData.players.find((p) => p.uid === currentUser.uid);
    if (!player) return 0;
    const currentBet = tableData.currentBet || 0;
    return Math.max(0, currentBet - (player.currentRoundBet || 0));
  }, [tableData, currentUser]);

  // Calculate minimum raise
  const getMinRaise = useCallback(() => {
    if (!tableData) return 0;
    const currentBet = tableData.currentBet || 0;
    const minBet = tableData.minBet || 50;
    return currentBet + minBet;
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
  const isBettingPhase = tableData?.phase?.startsWith('BETTING_') || false;
  const isDrawPhase = tableData?.phase?.startsWith('DRAW_') || false;
  const isShowdown = tableData?.phase === 'SHOWDOWN';
  const isIdle = tableData?.phase === 'IDLE';

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
    handleTimeout,
    updateUsername,
    sendChatMessage,

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
