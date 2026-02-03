/**
 * ============================================================================
 * MOBILE ACTION BAR COMPONENT
 * "Unified Control Stack" - PWA Gaming Design System
 * ============================================================================
 *
 * This component implements the unified action bar that:
 * 1. Shows Pre-Action checkboxes when it's NOT the user's turn
 * 2. Shows Live Action buttons when it IS the user's turn
 * 3. Transitions between them with a smooth cross-fade
 *
 * IMPORTANT: Both states occupy the EXACT SAME vertical space to prevent
 * accidental clicks during the transition.
 *
 * Safety Features:
 * - Pre-action buttons use desaturated/outlined style
 * - Live action buttons use solid, vibrant colors
 * - Cross-fade transition (200ms) provides clear visual state change
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic, HapticPatterns } from '../utils/haptics';

/**
 * Pre-Action Types
 */
export const PRE_ACTION_TYPES = {
  NONE: 'none',
  CHECK: 'check',
  CHECK_FOLD: 'check_fold',
  CALL: 'call',
  CALL_ANY: 'call_any',
  FOLD: 'fold',
};

/**
 * Format chip amount for display
 */
function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 10000) return `${Math.floor(amount / 1000)}k`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount?.toLocaleString() || '0';
}

/**
 * MobileActionBar Component
 *
 * Unified action bar that transitions between pre-action and live action modes
 */
export function MobileActionBar({
  // Turn state
  isMyTurn,
  disabled = false,

  // Betting state
  currentBet = 0,
  callAmount = 0,
  playerCurrentRoundBet = 0,
  playerChips = 0,
  minRaise = 0,
  maxRaise = 0,
  pot = 0,
  bigBlind = 2,

  // Action handlers (live actions)
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn,

  // Pre-action state
  preAction = { type: PRE_ACTION_TYPES.NONE, amount: 0 },
  onPreActionSet,
  onPreActionClear,

  // Phase info
  isBettingPhase = true,
}) {
  const [showRaisePanel, setShowRaisePanel] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  // Calculate derived values
  const canCheck = callAmount === 0;
  const canRaise = maxRaise > callAmount && (maxRaise + playerCurrentRoundBet) >= minRaise;
  const mustAllInToCall = callAmount > 0 && maxRaise < callAmount && maxRaise > 0;

  // Reset raise panel when turn changes
  useEffect(() => {
    if (!isMyTurn) {
      setShowRaisePanel(false);
    }
  }, [isMyTurn]);

  // Update raise amount when minRaise changes
  useEffect(() => {
    setRaiseAmount(Math.max(minRaise, raiseAmount));
  }, [minRaise]);

  // Handle pre-action selection
  const handlePreActionSelect = useCallback((type, amount = 0) => {
    triggerHaptic(HapticPatterns.TAP);
    if (preAction.type === type) {
      onPreActionClear?.();
    } else {
      onPreActionSet?.({ type, amount });
    }
  }, [preAction.type, onPreActionSet, onPreActionClear]);

  // Handle live action
  const handleAction = useCallback((actionName, callback) => {
    triggerHaptic(HapticPatterns.TAP);
    callback?.();
  }, []);

  // Handle raise submission
  const handleRaiseSubmit = useCallback(() => {
    triggerHaptic(HapticPatterns.SUCCESS);
    onRaise?.(raiseAmount);
    setShowRaisePanel(false);
  }, [raiseAmount, onRaise]);

  // If not in betting phase, render nothing
  if (!isBettingPhase) {
    return null;
  }

  // Animation variants for cross-fade
  const fadeVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <div className="mobile-action-bar-container relative px-3 pb-1">
      {/* Raise Panel - Slides up from action bar */}
      <AnimatePresence>
        {showRaisePanel && isMyTurn && (
          <RaisePanel
            raiseAmount={raiseAmount}
            setRaiseAmount={setRaiseAmount}
            minRaise={minRaise}
            maxRaise={maxRaise}
            playerChips={playerChips}
            currentBet={currentBet}
            pot={pot}
            callAmount={callAmount}
            bigBlind={bigBlind}
            disabled={disabled}
            onSubmit={handleRaiseSubmit}
            onCancel={() => setShowRaisePanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Action Bar - Cross-fades between Pre-Action and Live Action */}
      <AnimatePresence mode="wait">
        {isMyTurn ? (
          /* LIVE ACTION BUTTONS */
          <motion.div
            key="live-actions"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="live-action-bar"
          >
            <LiveActionButtons
              canCheck={canCheck}
              canRaise={canRaise}
              mustAllInToCall={mustAllInToCall}
              callAmount={callAmount}
              minRaise={minRaise}
              maxRaise={maxRaise}
              currentBet={currentBet}
              disabled={disabled}
              showRaisePanel={showRaisePanel}
              onFold={() => handleAction('fold', onFold)}
              onCheck={() => handleAction('check', onCheck)}
              onCall={() => handleAction('call', onCall)}
              onAllIn={() => handleAction('allin', onAllIn)}
              onToggleRaise={() => setShowRaisePanel(!showRaisePanel)}
            />
          </motion.div>
        ) : (
          /* PRE-ACTION BUTTONS */
          <motion.div
            key="pre-actions"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="pre-action-bar"
          >
            <PreActionButtons
              canCheck={canCheck}
              callAmount={callAmount}
              preAction={preAction}
              onSelect={handlePreActionSelect}
              onClear={onPreActionClear}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Live Action Buttons Component
 * Solid, vibrant colors for immediate actions
 */
function LiveActionButtons({
  canCheck,
  canRaise,
  mustAllInToCall,
  callAmount,
  minRaise,
  maxRaise,
  currentBet,
  disabled,
  showRaisePanel,
  onFold,
  onCheck,
  onCall,
  onAllIn,
  onToggleRaise,
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {/* Zone 1: FOLD - Always available */}
      <button
        type="button"
        onClick={onFold}
        disabled={disabled}
        className="action-btn-live action-btn-fold py-3 rounded-xl font-bold text-sm"
      >
        <span className="block">Fold</span>
      </button>

      {/* Zone 2: CHECK / CALL / ALL-IN TO CALL */}
      {canCheck ? (
        <button
          type="button"
          onClick={onCheck}
          disabled={disabled}
          className="action-btn-live action-btn-check py-3 rounded-xl font-bold text-sm"
        >
          <span className="block">Check</span>
        </button>
      ) : mustAllInToCall ? (
        <button
          type="button"
          onClick={onAllIn}
          disabled={disabled}
          className="action-btn-live action-btn-allin py-3 rounded-xl font-bold text-sm"
        >
          <span className="block text-xs">All-In</span>
          <span className="block text-[10px] opacity-80">${formatAmount(maxRaise)}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onCall}
          disabled={disabled}
          className="action-btn-live action-btn-call py-3 rounded-xl font-bold text-sm"
        >
          <span className="block text-xs">Call</span>
          <span className="block text-[10px] opacity-80">${formatAmount(callAmount)}</span>
        </button>
      )}

      {/* Zone 3: RAISE / BET */}
      {canRaise ? (
        <button
          type="button"
          onClick={onToggleRaise}
          disabled={disabled}
          className={`
            action-btn-live py-3 rounded-xl font-bold text-sm
            ${showRaisePanel ? 'action-btn-raise-active' : 'action-btn-raise'}
          `}
        >
          <span className="block text-xs">{currentBet > 0 ? 'Raise' : 'Bet'}</span>
          <span className="block text-[10px] opacity-80">${formatAmount(minRaise)}+</span>
        </button>
      ) : (
        <div className="py-3" /> /* Placeholder to maintain grid */
      )}

      {/* Zone 4: ALL-IN (quick access) */}
      {canRaise && maxRaise > minRaise ? (
        <button
          type="button"
          onClick={onAllIn}
          disabled={disabled}
          className="action-btn-live action-btn-allin py-3 rounded-xl font-bold text-sm"
        >
          <span className="block text-xs">All-In</span>
          <span className="block text-[10px] opacity-80">${formatAmount(maxRaise)}</span>
        </button>
      ) : (
        <div className="py-3" /> /* Placeholder to maintain grid */
      )}
    </div>
  );
}

/**
 * Pre-Action Buttons Component
 * Desaturated/outlined style to differentiate from live actions
 */
function PreActionButtons({
  canCheck,
  callAmount,
  preAction,
  onSelect,
  onClear,
}) {
  const isSelected = (type) => preAction.type === type;

  return (
    <div className="space-y-2">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500 font-medium">Pre-Select Action</span>
        {preAction.type !== PRE_ACTION_TYPES.NONE && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Pre-action button grid - matches live action layout */}
      <div className="grid grid-cols-4 gap-2">
        {/* Zone 1: PRE-FOLD */}
        <button
          type="button"
          onClick={() => onSelect(PRE_ACTION_TYPES.FOLD)}
          className={`
            preaction-btn py-3 rounded-xl text-sm transition-all
            ${isSelected(PRE_ACTION_TYPES.FOLD)
              ? 'preaction-btn-selected preaction-btn-fold-selected'
              : 'preaction-btn-default preaction-btn-fold'
            }
          `}
        >
          <span className="block text-xs font-medium">Fold</span>
          <span className="block text-[10px] opacity-70">Any Bet</span>
        </button>

        {/* Zone 2: PRE-CHECK or PRE-CALL */}
        {canCheck ? (
          <button
            type="button"
            onClick={() => onSelect(PRE_ACTION_TYPES.CHECK)}
            className={`
              preaction-btn py-3 rounded-xl text-sm transition-all
              ${isSelected(PRE_ACTION_TYPES.CHECK)
                ? 'preaction-btn-selected preaction-btn-check-selected'
                : 'preaction-btn-default preaction-btn-check'
              }
            `}
          >
            <span className="block text-xs font-medium">Check</span>
            <span className="block text-[10px] opacity-70">If Able</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(PRE_ACTION_TYPES.CALL, callAmount)}
            className={`
              preaction-btn py-3 rounded-xl text-sm transition-all
              ${isSelected(PRE_ACTION_TYPES.CALL)
                ? 'preaction-btn-selected preaction-btn-call-selected'
                : 'preaction-btn-default preaction-btn-call'
              }
            `}
          >
            <span className="block text-xs font-medium">Call</span>
            <span className="block text-[10px] opacity-70">${formatAmount(callAmount)}</span>
          </button>
        )}

        {/* Zone 3: CHECK/FOLD */}
        <button
          type="button"
          onClick={() => onSelect(PRE_ACTION_TYPES.CHECK_FOLD)}
          className={`
            preaction-btn py-3 rounded-xl text-sm transition-all
            ${isSelected(PRE_ACTION_TYPES.CHECK_FOLD)
              ? 'preaction-btn-selected preaction-btn-checkfold-selected'
              : 'preaction-btn-default preaction-btn-checkfold'
            }
          `}
        >
          <span className="block text-xs font-medium">Chk/Fold</span>
          <span className="block text-[10px] opacity-70">{canCheck ? 'If Bet' : 'Will Fold'}</span>
        </button>

        {/* Zone 4: CALL ANY (only when there's a bet) */}
        {callAmount > 0 ? (
          <button
            type="button"
            onClick={() => onSelect(PRE_ACTION_TYPES.CALL_ANY)}
            className={`
              preaction-btn py-3 rounded-xl text-sm transition-all
              ${isSelected(PRE_ACTION_TYPES.CALL_ANY)
                ? 'preaction-btn-selected preaction-btn-callany-selected'
                : 'preaction-btn-default preaction-btn-callany'
              }
            `}
          >
            <span className="block text-xs font-medium">Call Any</span>
            <span className="block text-[10px] opacity-70">No Limit</span>
          </button>
        ) : (
          <div className="py-3" /> /* Placeholder */
        )}
      </div>

      {/* Selected action indicator */}
      {preAction.type !== PRE_ACTION_TYPES.NONE && (
        <div className="flex items-center justify-center gap-2 text-xs text-amber-400/80 pt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>
            {preAction.type === PRE_ACTION_TYPES.CHECK && 'Will Check (if able)'}
            {preAction.type === PRE_ACTION_TYPES.CHECK_FOLD && (canCheck ? 'Will Check' : 'Will Fold')}
            {preAction.type === PRE_ACTION_TYPES.CALL && `Will Call $${formatAmount(preAction.amount)}`}
            {preAction.type === PRE_ACTION_TYPES.CALL_ANY && 'Will Call Any Amount'}
            {preAction.type === PRE_ACTION_TYPES.FOLD && 'Will Fold'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Raise Panel Component
 * Slides up from action bar when raise button is tapped
 */
function RaisePanel({
  raiseAmount,
  setRaiseAmount,
  minRaise,
  maxRaise,
  playerChips,
  currentBet,
  pot,
  callAmount,
  bigBlind,
  disabled,
  onSubmit,
  onCancel,
}) {
  // Calculate presets
  const effectivePot = pot + callAmount;
  const presets = [
    { label: 'Min', value: minRaise },
    { label: '½ Pot', value: Math.max(minRaise, Math.floor(effectivePot * 0.5) + currentBet) },
    { label: 'Pot', value: Math.max(minRaise, effectivePot + currentBet) },
    { label: 'Max', value: maxRaise },
  ].filter((p, i, arr) => {
    if (p.value < minRaise || p.value > maxRaise) return false;
    return arr.findIndex(x => x.value === p.value) === i;
  });

  const handleInputChange = (e) => {
    const value = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || minRaise;
    setRaiseAmount(Math.min(Math.max(value, minRaise), maxRaise));
  };

  const handleIncrement = (delta) => {
    triggerHaptic(HapticPatterns.TICK);
    setRaiseAmount(prev => Math.min(Math.max(prev + delta * bigBlind, minRaise), maxRaise));
  };

  const isAllIn = raiseAmount === maxRaise && maxRaise === playerChips;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: 20, height: 0 }}
      transition={{ duration: 0.2 }}
      className="raise-panel mb-3 p-3 rounded-xl bg-slate-800/95 border border-slate-700/50"
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Amount Display */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-slate-400 text-xs">{currentBet > 0 ? 'Raise to' : 'Bet'}</span>
        <span className="text-amber-400 font-bold text-lg">${formatAmount(raiseAmount)}</span>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              triggerHaptic(HapticPatterns.TAP);
              setRaiseAmount(preset.value);
            }}
            disabled={disabled}
            className={`
              py-2 px-2 rounded-lg text-xs font-medium transition-all
              ${raiseAmount === preset.value
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }
            `}
          >
            <span className="block">{preset.label}</span>
            <span className="block text-[9px] opacity-70">${formatAmount(preset.value)}</span>
          </button>
        ))}
      </div>

      {/* Manual Input with Incrementers */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => handleIncrement(-1)}
          disabled={disabled || raiseAmount <= minRaise}
          className="w-10 h-10 rounded-lg bg-slate-700 text-slate-300 font-bold text-lg disabled:opacity-30 active:scale-95 transition-all"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={raiseAmount}
          onChange={handleInputChange}
          disabled={disabled}
          className="flex-1 h-10 px-3 rounded-lg bg-slate-900 border border-slate-600 text-center text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => handleIncrement(1)}
          disabled={disabled || raiseAmount >= maxRaise}
          className="w-10 h-10 rounded-lg bg-slate-700 text-slate-300 font-bold text-lg disabled:opacity-30 active:scale-95 transition-all"
        >
          +
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-white font-medium text-sm rounded-xl flex items-center justify-center"
          style={{
            minHeight: '40px',
            background: 'rgba(51, 65, 85, 0.6)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            boxShadow: '0 2px 0 rgba(51, 65, 85, 0.7), 0 3px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="flex-[2] font-bold text-sm rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            minHeight: '40px',
            background: isAllIn
              ? 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)'
              : 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
            color: 'white',
            boxShadow: isAllIn
              ? '0 3px 0 #6d28d9, 0 5px 12px rgba(139, 92, 246, 0.35)'
              : '0 3px 0 #b45309, 0 5px 12px rgba(180, 83, 9, 0.3)',
          }}
        >
          {isAllIn ? 'ALL IN' : `${currentBet > 0 ? 'Raise' : 'Bet'} $${formatAmount(raiseAmount)}`}
        </button>
      </div>
    </motion.div>
  );
}

export default MobileActionBar;
