import { useEffect, useRef } from 'react';
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
  const lastProcessedRef = useRef({ phase: null, activePlayerIndex: -1 });
  const tableDataRef = useRef(tableData);

  // Keep ref updated with latest tableData
  useEffect(() => {
    tableDataRef.current = tableData;
  }, [tableData]);

  useEffect(() => {
    // Only run if we're the table creator
    if (!tableData || !currentUserId || currentUserId !== creatorId) {
      return;
    }

    // Only process if we're not already processing
    if (processingRef.current) {
      return;
    }

    const activePlayerIndex = tableData.activePlayerIndex;
    const activePlayer = tableData.players?.[activePlayerIndex];
    const phase = tableData.phase;

    // Check if we've already processed this exact turn (same phase + same player)
    if (phase === lastProcessedRef.current.phase && 
        activePlayerIndex === lastProcessedRef.current.activePlayerIndex) {
      return;
    }

    // Check if game is in a valid phase for bot action
    const isBettingPhase = phase?.startsWith('BETTING_');
    const isDrawPhase = phase?.startsWith('DRAW_');

    if (!isBettingPhase && !isDrawPhase) {
      // Not a valid phase for bot action, update tracking
      lastProcessedRef.current = { phase, activePlayerIndex };
      return;
    }

    // Check if active player is a bot
    if (!activePlayer || !activePlayer.isBot) {
      // Not a bot, update tracking
      lastProcessedRef.current = { phase, activePlayerIndex };
      return;
    }

    // Store bot info for the callback
    const botUid = activePlayer.uid;
    const botDifficulty = activePlayer.botDifficulty || 'medium';
    const gameType = tableData.config?.gameType || 'lowball_27';
    const strategy = getBotStrategy(gameType);

    // Mark as processing
    processingRef.current = true;
    lastProcessedRef.current = { phase, activePlayerIndex };

    // Add a small delay to make bot actions feel more natural
    const delay = Math.random() * 1000 + 500; // 500-1500ms

    setTimeout(async () => {
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
        // But allow all-in players to act in draw phases (they stand pat)
        if (currentIsBettingPhase && (currentActivePlayer.status === 'all-in' || currentActivePlayer.chips === 0)) {
          return;
        }

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
          }
        }
      } catch (error) {
        console.error('Error executing bot action:', error);
      } finally {
        // Reset processing flag after a delay
        setTimeout(() => {
          processingRef.current = false;
        }, 1000);
      }
    }, delay);
  }, [tableData, currentTableId, currentUserId, creatorId]);
}
