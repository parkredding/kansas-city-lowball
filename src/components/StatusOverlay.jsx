/**
 * ============================================================================
 * STATUS OVERLAY COMPONENT
 * "Dynamic HUD" - PWA Gaming Design System
 * ============================================================================
 *
 * This component displays critical betting information in a dedicated status
 * area near the action bar, keeping the table felt clean for player avatars
 * and community cards.
 *
 * Information Displayed:
 * - Amount to Call (when facing a bet)
 * - Current Bet (the bet you need to match)
 * - Pot Size (total chips in play)
 * - Your Stack (quick reference)
 *
 * Design Principles:
 * - Compact, non-intrusive display
 * - Clear visual hierarchy
 * - Only shows relevant information (hides when no bet to call)
 * - Color-coded for quick recognition
 * ============================================================================
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Format chip amount for display
 */
function formatAmount(amount) {
  if (amount === undefined || amount === null) return '0';
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 10000) return `${Math.floor(amount / 1000)}k`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toLocaleString();
}

/**
 * StatusOverlay Component
 *
 * Displays betting status information in a compact bar format
 */
export const StatusOverlay = memo(function StatusOverlay({
  pot = 0,
  currentBet = 0,
  callAmount = 0,
  playerChips = 0,
  playerCurrentRoundBet = 0,
  isMyTurn = false,
  phase = '',
}) {
  // Calculate if there's a bet to call
  const hasBetToCall = callAmount > 0;
  const canCheck = callAmount === 0;

  // Only show detailed info when there's action
  const showBettingInfo = hasBetToCall || currentBet > 0;

  return (
    <div className="status-overlay w-full">
      {/* Compact status bar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        {/* Left side: Pot info */}
        <div className="flex items-center gap-3">
          {/* Pot Display */}
          <div className="status-item status-pot">
            <span className="status-label text-slate-500">Pot</span>
            <span className="status-value text-amber-400 font-semibold">
              ${formatAmount(pot)}
            </span>
          </div>

          {/* Current Bet - only show if there's a bet */}
          <AnimatePresence>
            {currentBet > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="status-item status-bet"
              >
                <span className="status-label text-slate-500">Bet</span>
                <span className="status-value text-sky-400 font-semibold">
                  ${formatAmount(currentBet)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: Call amount indicator (prominent when facing bet) */}
        <AnimatePresence>
          {hasBetToCall && isMyTurn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="status-call-indicator flex items-center gap-2 px-3 py-1 rounded-full bg-sky-600/20 border border-sky-500/30"
            >
              <span className="text-sky-400 text-[10px] uppercase tracking-wide">To Call</span>
              <span className="text-sky-300 font-bold">${formatAmount(callAmount)}</span>
            </motion.div>
          )}
          {canCheck && isMyTurn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="status-check-indicator flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30"
            >
              <span className="text-emerald-400 text-[10px] uppercase tracking-wide">Check Available</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right side: Player stack */}
        <div className="flex items-center gap-3">
          {/* Your bet this round - only show if you've bet */}
          <AnimatePresence>
            {playerCurrentRoundBet > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="status-item status-your-bet"
              >
                <span className="status-label text-slate-500">Your Bet</span>
                <span className="status-value text-violet-400 font-semibold">
                  ${formatAmount(playerCurrentRoundBet)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stack */}
          <div className="status-item status-stack">
            <span className="status-label text-slate-500">Stack</span>
            <span className="status-value text-slate-300 font-semibold">
              ${formatAmount(playerChips)}
            </span>
          </div>
        </div>
      </div>

      {/* Turn indicator line */}
      <AnimatePresence>
        {isMyTurn && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.3 }}
            className="turn-indicator-line mt-2 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full origin-center"
          />
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * Compact Status Badge Component
 * For showing individual status items
 */
export function StatusBadge({
  label,
  value,
  color = 'slate',
  animate = false,
}) {
  const colorClasses = {
    slate: 'text-slate-300 bg-slate-800/50',
    amber: 'text-amber-400 bg-amber-900/30',
    sky: 'text-sky-400 bg-sky-900/30',
    emerald: 'text-emerald-400 bg-emerald-900/30',
    violet: 'text-violet-400 bg-violet-900/30',
    red: 'text-red-400 bg-red-900/30',
  };

  return (
    <motion.div
      className={`
        status-badge inline-flex items-center gap-1.5 px-2 py-1 rounded-md
        ${colorClasses[color] || colorClasses.slate}
      `}
      animate={animate ? { scale: [1, 1.05, 1] } : undefined}
      transition={{ duration: 0.3 }}
    >
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </motion.div>
  );
}

/**
 * Turn Indicator Component
 * Prominent "YOUR TURN" display
 */
export function TurnIndicator({ isMyTurn, timeRemaining }) {
  return (
    <AnimatePresence>
      {isMyTurn && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="turn-indicator flex items-center justify-center gap-2 py-1"
        >
          <motion.span
            className="w-2 h-2 rounded-full bg-amber-500"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
            Your Turn
          </span>
          {timeRemaining !== undefined && timeRemaining > 0 && (
            <span className="text-amber-400/70 text-xs">
              ({timeRemaining}s)
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StatusOverlay;
