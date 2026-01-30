import { useEffect, useRef, useState, useCallback } from 'react';
import { getBotStrategy } from './BotFactory';
import { BetAction, GameService } from '../GameService';

/**
 * Hook that orchestrates bot actions
 * Runs in the table creator's browser and manages all bot players
 * 
 * @param {Object} tableData - Current table data
 * @param {string} currentTableId - Current table ID
 * @param {string} currentUserId - Current user's UID
 * @param {string} creatorId - Table creator's UID
 */
export function useBotOrchestrator(tableData, currentTableId, currentUserId, creatorId) {
  const processingRef = useRef(false);
  const lastProcessedRef = useRef({ phase: null, activePlayerIndex: -1, timestamp: 0 });
  const tableDataRef = useRef(tableData);
  const botTimeoutRef = useRef(null);
  const botActionTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const [retryCounter, setRetryCounter] = useState(0);

  // Keep ref updated with latest tableData
  useEffect(() => {
    tableDataRef.current = tableData;
  }, [tableData]);

  // Cleanup timeouts on unmount and track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (botTimeoutRef.current) {
        clearTimeout(botTimeoutRef.current);
      }
      if (botActionTimeoutRef.current) {
        clearTimeout(botActionTimeoutRef.current);
      }
    };
  }, []);

  // Function to trigger a retry
  const triggerRetry = useCallback(() => {
    setRetryCounter(prev => prev + 1);
  }, []);

  useEffect(() => {
    // Only run if we're the table creator
    if (!tableData || !currentUserId || currentUserId !== creatorId) {
      return;
    }

    // Clear any pending timeouts when table data changes
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    if (botActionTimeoutRef.current) {
      clearTimeout(botActionTimeoutRef.current);
      botActionTimeoutRef.current = null;
    }

    // Only process if we're not already processing
    if (processingRef.current) {
      // Schedule a retry in case we're stuck
      botActionTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return; // Skip if unmounted
        if (processingRef.current) {
          console.warn('Bot orchestrator appears stuck - forcing reset');
          processingRef.current = false;
          triggerRetry();
        }
      }, 5000);
      return;
    }

    const activePlayerIndex = tableData.activePlayerIndex;
    const activePlayer = tableData.players?.[activePlayerIndex];
    const phase = tableData.phase;

    // Check if we've already processed this exact turn (same phase + same player)
    // Also allow reprocessing if enough time has passed (safety mechanism)
    const now = Date.now();
    const timeSinceLastProcess = now - (lastProcessedRef.current.timestamp || 0);
    const isSameTurn = phase === lastProcessedRef.current.phase && 
                       activePlayerIndex === lastProcessedRef.current.activePlayerIndex;
    
    if (isSameTurn && timeSinceLastProcess < 10000) {
      return;
    }

    // Check if game is in a valid phase for bot action
    const isBettingPhase = phase?.startsWith('BETTING_');
    const isDrawPhase = phase?.startsWith('DRAW_');

    if (!isBettingPhase && !isDrawPhase) {
      // Not a valid phase for bot action, update tracking
      lastProcessedRef.current = { phase, activePlayerIndex, timestamp: Date.now() };
      return;
    }

    // Check if active player is a bot
    if (!activePlayer || !activePlayer.isBot) {
      // Not a bot, update tracking
      lastProcessedRef.current = { phase, activePlayerIndex, timestamp: Date.now() };
      return;
    }

    // Store bot info for the callback
    const botUid = activePlayer.uid;
    const botDifficulty = activePlayer.botDifficulty || 'medium';
    const gameType = tableData.config?.gameType || 'lowball_27';
    const strategy = getBotStrategy(gameType);

    // Mark as processing
    processingRef.current = true;
    lastProcessedRef.current = { phase, activePlayerIndex, timestamp: Date.now() };

    // Set up a fallback timeout in case bot action fails
    // This will trigger a default action (check/fold for betting, stand pat for draw)
    const fallbackTimeout = 10000; // 10 seconds
    botTimeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current) return; // Skip if unmounted
      
      try {
        const latestTableData = tableDataRef.current;
        if (!latestTableData || !currentTableId) return;
        
        const currentActivePlayer = latestTableData.players?.[latestTableData.activePlayerIndex];
        if (!currentActivePlayer || currentActivePlayer.uid !== botUid || !currentActivePlayer.isBot) {
          return; // Bot is no longer active
        }

        const currentPhase = latestTableData.phase;
        console.warn(`Bot ${botUid} action timeout - executing fallback action`);
        
        if (currentPhase?.startsWith('DRAW_')) {
          // Stand pat (discard nothing)
          await GameService.submitDraw(currentTableId, latestTableData, botUid, []);
        } else if (currentPhase?.startsWith('BETTING_')) {
          // Check if possible, otherwise fold
          await GameService.handleTimeout(currentTableId, latestTableData, botUid);
        }
      } catch (err) {
        console.error('Error in bot fallback timeout:', err);
      } finally {
        if (mountedRef.current) {
          processingRef.current = false;
        }
      }
    }, fallbackTimeout);

    // Add a small delay to make bot actions feel more natural
    const delay = Math.random() * 1000 + 500; // 500-1500ms

    setTimeout(async () => {
      if (!mountedRef.current) return; // Skip if unmounted
      
      try {
        // Re-check phase and active player from latest tableData
        const latestTableData = tableDataRef.current;
        if (!latestTableData || !currentTableId) {
          return;
        }

        // Verify it's still the same bot's turn
        const currentActivePlayerIndex = latestTableData.activePlayerIndex;
        const currentActivePlayer = latestTableData.players?.[currentActivePlayerIndex];
        
        if (!currentActivePlayer || 
            currentActivePlayer.uid !== botUid || 
            !currentActivePlayer.isBot) {
          // Bot is no longer the active player, abort
          return;
        }

        // Re-check phase from latest tableData
        const currentPhase = latestTableData.phase;
        const currentIsBettingPhase = currentPhase?.startsWith('BETTING_');
        const currentIsDrawPhase = currentPhase?.startsWith('DRAW_');

        // Skip if bot is all-in or has zero chips (can't act in betting phases)
        // But allow all-in players to act in draw phases (they can choose to discard)
        if (currentIsBettingPhase && (currentActivePlayer.status === 'all-in' || currentActivePlayer.chips === 0)) {
          // Clear the fallback timeout since we're skipping this action
          if (botTimeoutRef.current) {
            clearTimeout(botTimeoutRef.current);
            botTimeoutRef.current = null;
          }
          processingRef.current = false;
          return;
        }

        let actionSucceeded = false;

        if (currentIsDrawPhase) {
          // Handle draw phase
          const hand = currentActivePlayer.hand || [];
          if (hand.length === 5) {
            const discardIndices = strategy.decideDiscard(
              hand,
              latestTableData,
              currentActivePlayer,
              botDifficulty
            );

            // Execute the draw using bot's UID
            await GameService.submitDraw(currentTableId, latestTableData, botUid, discardIndices);
            actionSucceeded = true;
          }
        } else if (currentIsBettingPhase) {
          // Handle betting phase
          const hand = currentActivePlayer.hand || [];
          const playerChips = currentActivePlayer.chips || 0;
          const currentBet = latestTableData.currentBet || 0;
          const playerBet = currentActivePlayer.currentRoundBet || 0;
          const callAmount = Math.max(0, currentBet - playerBet);

          // Determine legal actions
          const legalActions = [];
          if (currentActivePlayer.status === 'active') {
            legalActions.push(BetAction.FOLD);
            
            if (callAmount === 0) {
              legalActions.push(BetAction.CHECK);
            } else {
              legalActions.push(BetAction.CALL);
            }

            if (playerChips > callAmount) {
              legalActions.push(BetAction.RAISE);
              legalActions.push(BetAction.BET);
            }

            // ALL_IN is always available if player has chips (regardless of call amount)
            if (playerChips > 0) {
              legalActions.push(BetAction.ALL_IN);
            }
          }

          // Get bot decision
          const decision = strategy.decideBet(
            hand,
            latestTableData,
            currentActivePlayer,
            legalActions,
            botDifficulty
          );

          // Execute the betting action using bot's UID
          if (decision && decision.action) {
            await GameService.performBetAction(
              currentTableId,
              latestTableData,
              botUid,
              decision.action,
              decision.amount || 0
            );
            actionSucceeded = true;
          }
        }

        // Clear fallback timeout if action succeeded
        if (actionSucceeded && botTimeoutRef.current) {
          clearTimeout(botTimeoutRef.current);
          botTimeoutRef.current = null;
        }
      } catch (error) {
        console.error('Error executing bot action:', error);
        // Don't clear the fallback timeout - let it handle the error case
      } finally {
        // Reset processing flag with a shorter delay
        // This allows the next bot action to be processed quickly
        setTimeout(() => {
          if (!mountedRef.current) return; // Skip if unmounted
          processingRef.current = false;
          // Trigger a retry to ensure we don't miss the next bot's turn
          triggerRetry();
        }, 300);
      }
    }, delay);
  }, [tableData, currentTableId, currentUserId, creatorId, retryCounter, triggerRetry]);
}
