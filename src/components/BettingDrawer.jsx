/**
 * ============================================================================
 * BETTING DRAWER COMPONENT
 * "Hybrid Betting Interface" - PWA Gaming Design System
 * ============================================================================
 *
 * A professional betting interface designed for one-handed mobile play.
 * Replaces finicky horizontal sliders with a robust system of:
 *
 * 1. MACRO ROW: Large preset buttons for common bet sizes
 *    [Min] [1/2 Pot] [3/4 Pot] [Pot] [Max]
 *
 * 2. MICRO ROW: Precise manual input with BB incrementers
 *    [-] [Input Field] [+]
 *
 * 3. EXECUTION: Large "Place Bet" confirmation button
 *
 * Design Principles:
 * - All controls within thumb reach (bottom 40% of screen)
 * - Minimum 48px touch targets for reliability
 * - Haptic feedback on every interaction
 * - Clear visual state for selected amounts
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Calculate pot-relative bet amounts
 */
function calculatePotBets(pot, callAmount, currentBet, minRaise, maxRaise) {
  const effectivePot = pot + callAmount;

  return {
    min: minRaise,
    halfPot: Math.max(minRaise, Math.floor(effectivePot * 0.5) + currentBet),
    threeQuarterPot: Math.max(minRaise, Math.floor(effectivePot * 0.75) + currentBet),
    pot: Math.max(minRaise, effectivePot + currentBet),
    max: maxRaise,
  };
}

/**
 * Format chip amount for display
 */
function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 10000) return `${Math.floor(amount / 1000)}k`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toLocaleString();
}

/**
 * BettingDrawer Component
 */
export function BettingDrawer({
  isOpen,
  onClose,
  onSubmit,
  pot = 0,
  callAmount = 0,
  currentBet = 0,
  minRaise,
  maxRaise,
  bigBlind = 2,
  playerChips,
  disabled = false,
}) {
  const [selectedAmount, setSelectedAmount] = useState(minRaise);
  const [inputValue, setInputValue] = useState(String(minRaise));
  const [activePreset, setActivePreset] = useState('min');

  // Calculate pot-relative presets
  const presets = useMemo(() =>
    calculatePotBets(pot, callAmount, currentBet, minRaise, maxRaise),
    [pot, callAmount, currentBet, minRaise, maxRaise]
  );

  // Clamp amount to valid range
  const clampAmount = useCallback((value) => {
    return Math.min(Math.max(value, minRaise), maxRaise);
  }, [minRaise, maxRaise]);

  // Reset when drawer opens or minRaise changes
  useEffect(() => {
    if (isOpen) {
      setSelectedAmount(minRaise);
      setInputValue(String(minRaise));
      setActivePreset('min');
    }
  }, [isOpen, minRaise]);

  // Handle preset button click
  const handlePresetClick = useCallback((presetKey, value) => {
    const clampedValue = clampAmount(value);
    setSelectedAmount(clampedValue);
    setInputValue(String(clampedValue));
    setActivePreset(presetKey);
  }, [clampAmount]);

  // Handle increment/decrement by Big Blind
  const handleIncrement = useCallback((delta) => {
    const newValue = clampAmount(selectedAmount + (delta * bigBlind));
    setSelectedAmount(newValue);
    setInputValue(String(newValue));
    setActivePreset(null);
  }, [selectedAmount, bigBlind, clampAmount]);

  // Handle direct input change
  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(value);
    setActivePreset(null);
  };

  // Handle input blur (validate and clamp)
  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10) || minRaise;
    const clamped = clampAmount(parsed);
    setSelectedAmount(clamped);
    setInputValue(String(clamped));
  };

  // Handle bet submission
  const handleSubmit = () => {
    if (disabled || selectedAmount < minRaise || selectedAmount > maxRaise) return;
    onSubmit(selectedAmount);
    onClose();
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  // Preset buttons configuration
  const presetButtons = useMemo(() => [
    { key: 'min', label: 'Min', value: presets.min },
    { key: 'halfPot', label: '½ Pot', value: presets.halfPot },
    { key: 'threeQuarterPot', label: '¾ Pot', value: presets.threeQuarterPot },
    { key: 'pot', label: 'Pot', value: presets.pot },
    { key: 'max', label: 'Max', value: presets.max },
  ].filter((preset, index, arr) => {
    // Filter out duplicates and out-of-range values
    if (preset.value < minRaise || preset.value > maxRaise) return false;
    return arr.findIndex(p => p.value === preset.value) === index;
  }), [presets, minRaise, maxRaise]);

  // Determine if this is an all-in bet
  const isAllIn = selectedAmount === maxRaise && maxRaise === playerChips;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
          />

          {/* Drawer */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 betting-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 400,
            }}
            style={{
              paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div
              className="bg-slate-900/98 backdrop-blur-xl rounded-t-2xl border-t border-slate-700/50 p-4"
              style={{
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Drawer Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1 bg-slate-600 rounded-full" />
              </div>

              {/* Header with amount display */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-slate-400 text-sm">
                    {currentBet > 0 ? 'Raise to' : 'Bet'}
                  </span>
                  <div className="text-2xl font-bold text-amber-400">
                    ${formatAmount(selectedAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-xs">Pot</div>
                  <div className="text-slate-300 font-medium">
                    ${formatAmount(pot)}
                  </div>
                </div>
              </div>

              {/* ================================================
                  MACRO ROW: Pot-Relative Preset Buttons
                  Large, tap-friendly buttons for common bet sizes
                  ================================================ */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {presetButtons.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handlePresetClick(preset.key, preset.value)}
                    disabled={disabled}
                    className={`
                      py-3 px-2 rounded-xl font-semibold text-sm
                      transition-all duration-100
                      min-h-[52px]
                      ${activePreset === preset.key
                        ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30 scale-105'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <span className="block text-xs font-medium opacity-80">
                      {preset.label}
                    </span>
                    <span className="block text-[10px] opacity-60 mt-0.5">
                      ${formatAmount(preset.value)}
                    </span>
                  </button>
                ))}
              </div>

              {/* ================================================
                  MICRO ROW: Manual Input with BB Incrementers
                  Flanking +/- buttons for precise 1 BB adjustments
                  ================================================ */}
              <div className="flex items-center gap-3 mb-5">
                {/* Decrement Button */}
                <button
                  type="button"
                  onClick={() => handleIncrement(-1)}
                  disabled={disabled || selectedAmount <= minRaise}
                  className={`
                    w-14 h-14 rounded-xl font-bold text-2xl
                    flex items-center justify-center
                    transition-all duration-100
                    ${selectedAmount <= minRaise
                      ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600 active:scale-95 active:bg-slate-800'
                    }
                  `}
                  aria-label={`Decrease by ${bigBlind} (1 BB)`}
                >
                  −
                </button>

                {/* Manual Input Field */}
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-medium">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onFocus={(e) => e.target.select()}
                    disabled={disabled}
                    className={`
                      w-full h-14 pl-8 pr-4 rounded-xl
                      bg-slate-800 border-2 border-slate-600
                      text-center text-xl font-bold text-amber-400
                      focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors duration-150
                    `}
                    style={{
                      /* Prevent iOS zoom on input focus */
                      fontSize: '18px',
                    }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                    {bigBlind > 0 ? `${Math.round(selectedAmount / bigBlind)} BB` : ''}
                  </span>
                </div>

                {/* Increment Button */}
                <button
                  type="button"
                  onClick={() => handleIncrement(1)}
                  disabled={disabled || selectedAmount >= maxRaise}
                  className={`
                    w-14 h-14 rounded-xl font-bold text-2xl
                    flex items-center justify-center
                    transition-all duration-100
                    ${selectedAmount >= maxRaise
                      ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600 active:scale-95 active:bg-slate-800'
                    }
                  `}
                  aria-label={`Increase by ${bigBlind} (1 BB)`}
                >
                  +
                </button>
              </div>

              {/* Quick increment buttons for larger jumps */}
              <div className="flex justify-center gap-2 mb-5">
                {[5, 10, 25].map((multiplier) => {
                  const incrementAmount = multiplier * bigBlind;
                  const canIncrement = selectedAmount + incrementAmount <= maxRaise;
                  const canDecrement = selectedAmount - incrementAmount >= minRaise;

                  return (
                    <div key={multiplier} className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleIncrement(-multiplier)}
                        disabled={disabled || !canDecrement}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                      >
                        -{multiplier} BB
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIncrement(multiplier)}
                        disabled={disabled || !canIncrement}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                      >
                        +{multiplier} BB
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* ================================================
                  EXECUTION: Place Bet Button
                  Large, prominent confirmation button
                  ================================================ */}
              <div className="flex gap-3">
                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-4 rounded-xl font-semibold text-base bg-slate-700 text-slate-300 hover:bg-slate-600 active:scale-98 transition-all"
                >
                  Cancel
                </button>

                {/* Place Bet Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={disabled || selectedAmount < minRaise || selectedAmount > maxRaise}
                  className={`
                    flex-[2] py-4 rounded-xl font-bold text-lg
                    flex items-center justify-center gap-2
                    transition-all duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                    active:scale-98
                    ${isAllIn
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-lg shadow-amber-500/30'
                    }
                  `}
                >
                  {isAllIn ? (
                    <>
                      <span className="text-xl">🔥</span>
                      <span>ALL IN</span>
                    </>
                  ) : (
                    <>
                      <span>{currentBet > 0 ? 'Raise' : 'Bet'}</span>
                      <span className="font-normal opacity-80">
                        ${formatAmount(selectedAmount)}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Info Footer */}
              <div className="flex justify-between mt-3 text-xs text-slate-500">
                <span>Min: ${formatAmount(minRaise)}</span>
                <span>Your chips: ${formatAmount(playerChips)}</span>
                <span>Max: ${formatAmount(maxRaise)}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact action bar for quick decisions
 * Used when not in betting mode
 */
export function ActionBar({
  onFold,
  onCheck,
  onCall,
  onOpenBetting,
  onAllIn,
  canCheck = false,
  callAmount = 0,
  currentBet = 0,
  minRaise = 0,
  maxRaise = 0,
  canRaise = true,
  disabled = false,
  isMyTurn = false,
}) {
  const handleAction = (action, callback) => {
    callback?.();
  };

  const mustAllInToCall = callAmount > 0 && maxRaise < callAmount && maxRaise > 0;

  return (
    <div
      className={`
        flex gap-2 p-3
        bg-slate-900/95 backdrop-blur-xl
        border-t border-slate-700/50
        transition-all duration-300
        ${isMyTurn ? 'ring-2 ring-amber-500/50 ring-inset' : ''}
      `}
      style={{
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Fold */}
      <button
        type="button"
        onClick={() => handleAction('fold', onFold)}
        disabled={disabled}
        className="flex-1 py-4 rounded-xl font-bold text-base bg-red-600 hover:bg-red-500 active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-600/30"
      >
        Fold
      </button>

      {/* Check / Call / All-In to Call */}
      {canCheck ? (
        <button
          type="button"
          onClick={() => handleAction('check', onCheck)}
          disabled={disabled}
          className="flex-1 py-4 rounded-xl font-bold text-base bg-green-600 hover:bg-green-500 active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/30"
        >
          Check
        </button>
      ) : mustAllInToCall ? (
        <button
          type="button"
          onClick={() => handleAction('allin', onAllIn)}
          disabled={disabled}
          className="flex-1 py-4 rounded-xl font-bold text-base bg-violet-600 hover:bg-violet-500 active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/30"
        >
          <span className="block text-sm">All-In</span>
          <span className="block text-xs opacity-80">${formatAmount(maxRaise)}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleAction('call', onCall)}
          disabled={disabled}
          className="flex-1 py-4 rounded-xl font-bold text-base bg-sky-600 hover:bg-sky-500 active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-600/30"
        >
          <span className="block text-sm">Call</span>
          <span className="block text-xs opacity-80">${formatAmount(callAmount)}</span>
        </button>
      )}

      {/* Raise / Bet - Opens the Betting Drawer */}
      {canRaise && (
        <button
          type="button"
          onClick={() => handleAction('raise', onOpenBetting)}
          disabled={disabled}
          className="flex-1 py-4 rounded-xl font-bold text-base bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/30"
        >
          <span className="block text-sm">
            {currentBet > 0 ? 'Raise' : 'Bet'}
          </span>
          <span className="block text-xs opacity-70">${formatAmount(minRaise)}+</span>
        </button>
      )}
    </div>
  );
}

export default BettingDrawer;
