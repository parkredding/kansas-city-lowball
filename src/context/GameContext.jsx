import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { GameService } from '../game/GameService';
import { HandEvaluator } from '../game/HandEvaluator';

const GameContext = createContext();

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
      }
    });

    return () => unsubscribe();
  }, [currentTableId]);

  // Create a new table
  const createTable = useCallback(async () => {
    if (!currentUser) {
      setError('You must be logged in to create a table');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tableId = await GameService.createTable(currentUser);
      setCurrentTableId(tableId);
      return tableId;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Join an existing table
  const joinTable = useCallback(async (tableId) => {
    if (!currentUser) {
      setError('You must be logged in to join a table');
      return false;
    }

    if (!tableId) {
      setError('Please enter a table ID');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await GameService.joinTable(tableId.toUpperCase(), currentUser);
      setCurrentTableId(tableId.toUpperCase());
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Leave the current table
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

  // Submit a bet
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

  // Determine phase helpers
  const isBettingPhase = tableData?.phase?.startsWith('BETTING_') || false;
  const isDrawPhase = tableData?.phase?.startsWith('DRAW_') || false;
  const isShowdown = tableData?.phase === 'SHOWDOWN';
  const isIdle = tableData?.phase === 'IDLE';

  const value = {
    // State
    currentTableId,
    tableData,
    loading,
    error,

    // Phase helpers
    isBettingPhase,
    isDrawPhase,
    isShowdown,
    isIdle,

    // Actions
    createTable,
    joinTable,
    leaveTable,
    dealCards,
    submitBet,
    submitDraw,
    startNextHand,

    // Utilities
    getCurrentPlayer,
    isMyTurn,
    getActivePlayer,
    evaluateHand,
    setError,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}
