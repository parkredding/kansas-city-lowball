import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Pre-Action Types
 * These represent the actions a player can queue before their turn
 */
export const PRE_ACTION_TYPES = {
  NONE: 'none',
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

        {/* Pre-Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Check/Fold Button */}
          <button
            type="button"
            onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CHECK_FOLD)}
            className={`${getButtonStyle(PRE_ACTION_TYPES.CHECK_FOLD)} ${getButtonColor(PRE_ACTION_TYPES.CHECK_FOLD)}`}
          >
            <span className="block text-[11px]">Check/Fold</span>
            <span className="block text-[9px] opacity-70">
              {canCheck ? 'Will Check' : 'Will Fold'}
            </span>
          </button>

          {/* Call Button - with amount */}
          {callAmount > 0 && (
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CALL, callAmount)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CALL)} ${getButtonColor(PRE_ACTION_TYPES.CALL)}`}
            >
              <span className="block text-[11px]">Call</span>
              <span className="block text-[9px] opacity-70">${formatAmount(callAmount)}</span>
            </button>
          )}

          {/* Call Any - no price protection */}
          {callAmount > 0 && (
            <button
              type="button"
              onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.CALL_ANY)}
              className={`${getButtonStyle(PRE_ACTION_TYPES.CALL_ANY)} ${getButtonColor(PRE_ACTION_TYPES.CALL_ANY)}`}
            >
              <span className="block text-[11px]">Call Any</span>
              <span className="block text-[9px] opacity-70">No Limit</span>
            </button>
          )}

          {/* Fold Button */}
          <button
            type="button"
            onClick={() => handlePreActionSelect(PRE_ACTION_TYPES.FOLD)}
            className={`${getButtonStyle(PRE_ACTION_TYPES.FOLD)} ${getButtonColor(PRE_ACTION_TYPES.FOLD)}`}
          >
            <span className="block text-[11px]">Fold</span>
            <span className="block text-[9px] opacity-70">Any Bet</span>
          </button>
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
}) {
  const [preAction, setPreAction] = useState({ type: PRE_ACTION_TYPES.NONE, amount: 0 });
  const [wasExecuted, setWasExecuted] = useState(false);

  const callAmount = Math.max(0, currentBet - playerCurrentRoundBet);

  // Execute pre-action when turn starts
  useEffect(() => {
    if (isMyTurn && preAction.type !== PRE_ACTION_TYPES.NONE && !wasExecuted) {
      // Mark as executed to prevent duplicate actions
      setWasExecuted(true);

      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        executePreAction();
      }, 100);

      return () => clearTimeout(timer);
    }

    // Reset execution flag when turn ends
    if (!isMyTurn && wasExecuted) {
      setWasExecuted(false);
    }
  }, [isMyTurn, preAction, wasExecuted]);

  // Execute the queued pre-action
  const executePreAction = useCallback(() => {
    switch (preAction.type) {
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
  }, [preAction, canCheck, callAmount, onCheck, onFold, onCall]);

  // Set a new pre-action
  const setPreActionHandler = useCallback((action) => {
    setPreAction(action);
    setWasExecuted(false);
  }, []);

  // Clear the pre-action
  const clearPreAction = useCallback(() => {
    setPreAction({ type: PRE_ACTION_TYPES.NONE, amount: 0 });
    setWasExecuted(false);
  }, []);

  return {
    preAction,
    setPreAction: setPreActionHandler,
    clearPreAction,
    isPreActionSet: preAction.type !== PRE_ACTION_TYPES.NONE,
  };
}

export default PrePlayControls;
