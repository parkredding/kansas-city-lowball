import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Pre-Action Types
 * These represent the actions a player can queue before their turn
 */
export const PRE_ACTION_TYPES = {
  NONE: 'none',
  CHECK: 'check',                // Check if possible, otherwise cancel and alert
  CHECK_FOLD: 'check_fold',     // Check if possible, otherwise fold
  CALL: 'call',                  // Call the current bet
  CALL_ANY: 'call_any',          // Call any amount
  FOLD: 'fold',                  // Fold no matter what
};

/**
 * PrePlayControls - Action Queuing System
 *
 * Allows players to pre-select their move while waiting for their turn.
 * Includes safety mechanisms:
 * - Price protection: If bet amount changes, cancel the pre-action
 * - Check/Fold logic: Auto-check if possible, otherwise fold
 *
 * @param {Object} props
 * @param {boolean} props.isVisible - Whether to show the controls (should be !isMyTurn)
 * @param {number} props.currentBet - The current bet to call
 * @param {number} props.playerCurrentRoundBet - Player's current bet this round
 * @param {number} props.playerChips - Player's remaining chips
 * @param {string} props.phase - Current game phase
 * @param {boolean} props.isBettingPhase - Whether we're in a betting phase
 * @param {boolean} props.isDrawPhase - Whether we're in a draw phase
 * @param {function} props.onPreActionSet - Callback when pre-action is set
 * @param {function} props.onPreActionClear - Callback to clear pre-action
 * @param {Object} props.preAction - Current pre-action state { type, amount, cardsToDiscard }
 * @param {boolean} props.isDesktop - Desktop layout mode
 */
function PrePlayControls({
  isVisible,
  currentBet = 0,
  playerCurrentRoundBet = 0,
  playerChips = 0,
  phase,
  isBettingPhase,
  isDrawPhase,
  onPreActionSet,
  onPreActionClear,
  preAction = { type: PRE_ACTION_TYPES.NONE, amount: 0 },
  isDesktop = false,
}) {
  // Calculate the amount needed to call
  const callAmount = Math.max(0, currentBet - playerCurrentRoundBet);
  const canCheck = callAmount === 0;

  // Track previous bet for price protection
  const [lastKnownBet, setLastKnownBet] = useState(currentBet);

  // Price protection: Clear pre-action if bet amount changes
  useEffect(() => {
    if (preAction.type === PRE_ACTION_TYPES.CALL && preAction.amount !== undefined) {
      // If the bet changed from what we queued, cancel the pre-action
      if (callAmount !== preAction.amount && preAction.amount > 0) {
        // Bet changed - clear the pre-action
        onPreActionClear?.();
      }
    }
    setLastKnownBet(currentBet);
  }, [currentBet, callAmount, preAction, onPreActionClear]);

  // Handle pre-action selection
  const handlePreActionSelect = useCallback((type, amount = 0) => {
    if (preAction.type === type) {
      // Toggle off if already selected
      onPreActionClear?.();
    } else {
      onPreActionSet?.({ type, amount });
    }
  }, [preAction.type, onPreActionSet, onPreActionClear]);

  // Get button style based on selection state
  const getButtonStyle = (actionType) => {
    const isSelected = preAction.type === actionType;
    const baseStyle = 'py-2 px-3 rounded-lg font-medium text-xs transition-all duration-200';

    if (isSelected) {
      return `${baseStyle} ring-2 ring-offset-2 ring-offset-slate-900`;
    }
    return baseStyle;
  };

  // Get button color based on action type and selection
  const getButtonColor = (actionType) => {
    const isSelected = preAction.type === actionType;

    switch (actionType) {
      case PRE_ACTION_TYPES.CHECK:
        return isSelected
          ? 'bg-emerald-600 text-white ring-emerald-400'
          : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600/80';
      case PRE_ACTION_TYPES.CHECK_FOLD:
        return isSelected
          ? 'bg-sky-600 text-white ring-sky-400'
          : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600/80';
      case PRE_ACTION_TYPES.CALL:
      case PRE_ACTION_TYPES.CALL_ANY:
        return isSelected
          ? 'bg-emerald-600 text-white ring-emerald-400'
          : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600/80';
      case PRE_ACTION_TYPES.FOLD:
        return isSelected
          ? 'bg-red-600 text-white ring-red-400'
          : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600/80';
      default:
        return 'bg-slate-700/80 text-slate-300 hover:bg-slate-600/80';
    }
  };

  // Format amount for display
  const formatAmount = (amount) => {
    if (amount >= 10000) return `${Math.floor(amount / 1000)}k`;
    return amount.toLocaleString();
  };

  if (!isVisible) return null;

  // Only show during betting phases
  if (!isBettingPhase) {
    return null;
  }

  const containerClass = isDesktop
    ? 'bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 w-full border border-slate-700/50'
    : 'bg-slate-900/95 backdrop-blur-sm rounded-xl p-3 w-full max-w-lg border border-slate-700/50';

  /**
   * ZONE-BASED LAYOUT for Pre-Action Buttons
   *
   * Critical UX Fix: Pre-Action buttons MUST align 1:1 with Real-Action buttons
   * to prevent misclicks when the turn starts.
   *
   * Zone 1 (Left):    Always FOLD - Pre-Fold goes here
   * Zone 2 (Center):  CHECK/CALL actions - Pre-Check, Check/Fold, Call go here
   * Zone 3 (Right):   BET/RAISE actions - Call Any goes here
   *
   * If Pre-Check is available, Zone 1 stays empty/disabled to prevent accidental folding.
   */

  // Determine which zones have content
  const hasFoldAction = true; // Fold is always available
  const hasCheckAction = canCheck;
  const hasCallAction = callAmount > 0;

  return (
    <AnimatePresence>
      <motion.div
        className={containerClass}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">Pre-Select Action</span>
          {preAction.type !== PRE_ACTION_TYPES.NONE && (
            <motion.button
              type="button"
              onClick={onPreActionClear}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Clear
            </motion.button>
          )}
        </div>

        {/* Pre-Action Buttons - Zone-aligned grid */}
        {/* Always use 4-column grid to match BettingControls layout */}
        <div className="grid grid-cols-4 gap-2">

          {/* ZONE 1 (Left) - FOLD ONLY
              This zone ALWAYS maps to Fold in real actions.
              NEVER put Check here to prevent accidental folding. */}
          <button
            type="button"
            onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.FOLD)}
            className={`${getButtonStyle(PRE_ACTION_TYPES.FOLD)} ${getButtonColor(PRE_ACTION_TYPES.FOLD)} preplay-btn`}
          >
            <span className="preplay-btn-text">Fold</span>
            <span className="preplay-btn-subtext">Any Bet</span>
          </button>

          {/* ZONE 2 (Center-Left) - CHECK / CALL actions
              This zone maps to Check/Call in real actions.
              Pre-Check and Check/Fold go here. */}
          {canCheck ? (
            // When we can check, show Check button (maps to Check in real actions)
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CHECK)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CHECK)} ${getButtonColor(PRE_ACTION_TYPES.CHECK)} preplay-btn`}
            >
              <span className="preplay-btn-text">Check</span>
              <span className="preplay-btn-subtext">Will Check</span>
            </button>
          ) : (
            // When there's a bet, show Call button (maps to Call in real actions)
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CALL, callAmount)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CALL)} ${getButtonColor(PRE_ACTION_TYPES.CALL)} preplay-btn`}
            >
              <span className="preplay-btn-text">Call</span>
              <span className="preplay-btn-subtext">${formatAmount(callAmount)}</span>
            </button>
          )}

          {/* ZONE 3 (Center-Right) - CONDITIONAL actions
              Check/Fold when there's a bet, or secondary check option */}
          {callAmount > 0 ? (
            // When there's a bet, show Check/Fold (will fold if bet increases)
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CHECK_FOLD)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CHECK_FOLD)} ${getButtonColor(PRE_ACTION_TYPES.CHECK_FOLD)} preplay-btn`}
            >
              <span className="preplay-btn-text">Chk/Fold</span>
              <span className="preplay-btn-subtext">Will Fold</span>
            </button>
          ) : (
            // When we can check, show Check/Fold as backup option
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CHECK_FOLD)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CHECK_FOLD)} ${getButtonColor(PRE_ACTION_TYPES.CHECK_FOLD)} preplay-btn`}
            >
              <span className="preplay-btn-text">Chk/Fold</span>
              <span className="preplay-btn-subtext">If Bet</span>
            </button>
          )}

          {/* ZONE 4 (Right) - AGGRESSIVE actions
              Call Any (no price protection) - maps to Raise zone */}
          {callAmount > 0 ? (
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CALL_ANY)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CALL_ANY)} ${getButtonColor(PRE_ACTION_TYPES.CALL_ANY)} preplay-btn`}
            >
              <span className="preplay-btn-text">Call Any</span>
              <span className="preplay-btn-subtext">No Limit</span>
            </button>
          ) : (
            // Placeholder when no bet - keeps grid aligned
            <div className="py-2 px-3" />
          )}
        </div>

        {/* Selected Action Indicator */}
        {preAction.type !== PRE_ACTION_TYPES.NONE && (
          <motion.div
            className="mt-2 pt-2 border-t border-slate-700/50"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Queued:</span>
              <span className="text-amber-400 font-medium">
                {preAction.type === PRE_ACTION_TYPES.CHECK && 'Check (if able)'}
                {preAction.type === PRE_ACTION_TYPES.CHECK_FOLD && (canCheck ? 'Check' : 'Fold')}
                {preAction.type === PRE_ACTION_TYPES.CALL && `Call $${formatAmount(preAction.amount)}`}
                {preAction.type === PRE_ACTION_TYPES.CALL_ANY && 'Call Any'}
                {preAction.type === PRE_ACTION_TYPES.FOLD && 'Fold'}
              </span>
            </div>
            {preAction.type === PRE_ACTION_TYPES.CALL && (
              <p className="text-[10px] text-amber-500/70 mt-1">
                Bet changed? Action will cancel automatically.
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook to manage pre-action state and execution
 *
 * @param {Object} options
 * @param {boolean} options.isMyTurn - Is it currently the player's turn
 * @param {number} options.currentBet - Current bet amount
 * @param {number} options.playerCurrentRoundBet - Player's bet this round
 * @param {function} options.onFold - Fold action handler
 * @param {function} options.onCheck - Check action handler
 * @param {function} options.onCall - Call action handler
 * @param {boolean} options.canCheck - Whether player can check
 * @param {function} options.onCheckBlocked - Called when CHECK action is blocked due to bet
 * @returns {Object} Pre-action state and handlers
 */
export function usePrePlayAction({
  isMyTurn,
  currentBet,
  playerCurrentRoundBet,
  onFold,
  onCheck,
  onCall,
  canCheck,
  onCheckBlocked,
}) {
  const [preAction, setPreAction] = useState({ type: PRE_ACTION_TYPES.NONE, amount: 0 });
  // Use ref instead of state to prevent re-render from clearing the timeout
  const wasExecutedRef = useRef(false);

  const callAmount = Math.max(0, currentBet - playerCurrentRoundBet);

  // Execute the queued pre-action
  const executePreAction = useCallback(() => {
    switch (preAction.type) {
      case PRE_ACTION_TYPES.CHECK:
        // Check if able, otherwise cancel and alert player
        if (canCheck) {
          onCheck?.();
        } else {
          // There's a bet on the table - cancel and notify player
          onCheckBlocked?.(callAmount);
          // Don't execute any action - give control back to player
        }
        break;

      case PRE_ACTION_TYPES.CHECK_FOLD:
        if (canCheck) {
          onCheck?.();
        } else {
          onFold?.();
        }
        break;

      case PRE_ACTION_TYPES.CALL:
        // Price protection: only call if amount matches
        if (callAmount === preAction.amount || preAction.amount === 0) {
          if (canCheck) {
            onCheck?.();
          } else {
            onCall?.();
          }
        }
        // If amount changed, do nothing (user gets control back)
        break;

      case PRE_ACTION_TYPES.CALL_ANY:
        // Call any amount without price protection
        if (canCheck) {
          onCheck?.();
        } else {
          onCall?.();
        }
        break;

      case PRE_ACTION_TYPES.FOLD:
        onFold?.();
        break;

      default:
        break;
    }

    // Clear the pre-action after execution
    setPreAction({ type: PRE_ACTION_TYPES.NONE, amount: 0 });
  }, [preAction, canCheck, callAmount, onCheck, onFold, onCall, onCheckBlocked]);

  // Execute pre-action when turn starts
  useEffect(() => {
    // Reset execution flag when turn ends
    if (!isMyTurn) {
      wasExecutedRef.current = false;
      return;
    }

    if (preAction.type !== PRE_ACTION_TYPES.NONE && !wasExecutedRef.current) {
      // Mark as executed to prevent duplicate actions
      wasExecutedRef.current = true;

      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        executePreAction();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isMyTurn, preAction.type, executePreAction]);

  // Set a new pre-action
  const setPreActionHandler = useCallback((action) => {
    setPreAction(action);
    wasExecutedRef.current = false;
  }, []);

  // Clear the pre-action
  const clearPreAction = useCallback(() => {
    setPreAction({ type: PRE_ACTION_TYPES.NONE, amount: 0 });
    wasExecutedRef.current = false;
  }, []);

  return {
    preAction,
    setPreAction: setPreActionHandler,
    clearPreAction,
    isPreActionSet: preAction.type !== PRE_ACTION_TYPES.NONE,
  };
}

export default PrePlayControls;
