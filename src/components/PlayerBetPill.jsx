/**
 * ============================================================================
 * PLAYER BET PILL COMPONENT
 * High-Contrast Bet Display Pills Near Player Avatars
 * ============================================================================
 *
 * This component displays betting amounts as small "pill" components
 * near the respective player avatars. Features:
 * - High-contrast white pill on dark background for visibility
 * - Chip icon to denote value
 * - Smooth animations for bet changes
 * - Multiple variants for different contexts
 *
 * Design Note: Inspired by professional poker apps that use white pills
 * for "Call 60" type actions - high visibility against dark felt.
 *
 * ============================================================================
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

/**
 * Format chip amount for compact display
 */
function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 10000) return `${Math.floor(amount / 1000)}k`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount?.toLocaleString() || '0';
}

/**
 * Mini Chip Icon Component
 */
function ChipIcon({ size = 'sm', className = '' }) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <div className={`chip-icon ${sizeClasses[size]} ${className}`}>
      <div className="relative w-full h-full">
        {/* Stacked chip effect */}
        <div className="absolute inset-0 rounded-full bg-red-600 border border-red-700 shadow-sm" style={{ transform: 'translateY(-1px)' }} />
        <div className="absolute inset-0 rounded-full bg-red-500 border border-red-600 shadow-sm" />
        {/* Chip dashes */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute top-0 left-1/2 w-0.5 h-1 bg-white/40 -translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-0.5 h-1 bg-white/40 -translate-x-1/2" />
          <div className="absolute left-0 top-1/2 w-1 h-0.5 bg-white/40 -translate-y-1/2" />
          <div className="absolute right-0 top-1/2 w-1 h-0.5 bg-white/40 -translate-y-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Player Bet Pill Component
 *
 * Shows the player's current bet/action with high-contrast pill design
 *
 * Props:
 * - amount: Bet amount to display
 * - action: Optional action label ('CALL', 'RAISE', 'BET', 'ALL-IN')
 * - variant: 'default' | 'action' | 'call' | 'raise' | 'allin'
 * - position: Position relative to player avatar
 * - animate: Enable/disable animations
 */
export function PlayerBetPill({
  amount = 0,
  action = null,
  variant = 'default',
  size = 'md',
  animate = true,
  className = '',
}) {
  // Don't render if no amount
  if (amount <= 0) return null;

  // Variant styles
  const variantStyles = {
    default: 'bg-white text-slate-900 border-slate-300',
    action: 'bg-white text-slate-900 border-slate-300',
    call: 'bg-sky-100 text-sky-900 border-sky-300',
    raise: 'bg-amber-100 text-amber-900 border-amber-300',
    allin: 'bg-violet-100 text-violet-900 border-violet-300',
    bet: 'bg-amber-100 text-amber-900 border-amber-300',
  };

  // Size variants
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const chipSize = size === 'lg' ? 'md' : size === 'sm' ? 'xs' : 'sm';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`bet-${amount}`}
        className={`
          player-bet-pill
          inline-flex items-center gap-1.5
          ${sizeStyles[size]}
          rounded-full
          ${variantStyles[variant] || variantStyles.default}
          border
          shadow-md
          font-semibold
          ${className}
        `}
        initial={animate ? { scale: 0.8, opacity: 0, y: 5 } : false}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -5 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }}
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.15)',
        }}
      >
        {/* Chip Icon */}
        <ChipIcon size={chipSize} />

        {/* Action label (if any) */}
        {action && (
          <span className="uppercase tracking-wide font-bold text-[10px] opacity-70">
            {action}
          </span>
        )}

        {/* Amount */}
        <span className="font-bold">
          ${formatAmount(amount)}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Action Call Pill
 * Specifically designed for "Amount to Call" display
 */
export function CallAmountPill({
  amount = 0,
  isAllIn = false,
  animate = true,
  className = '',
}) {
  if (amount <= 0) return null;

  return (
    <motion.div
      className={`
        call-amount-pill
        inline-flex items-center gap-2
        px-3 py-1.5
        rounded-full
        ${isAllIn
          ? 'bg-violet-500 text-white border-violet-400'
          : 'bg-white text-slate-900 border-slate-300'
        }
        border
        shadow-lg
        font-bold text-sm
        ${className}
      `}
      initial={animate ? { scale: 0.9, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)',
      }}
    >
      <ChipIcon size="sm" />
      <span className="uppercase text-[10px] tracking-wide opacity-70">
        {isAllIn ? 'All-In' : 'Call'}
      </span>
      <span className="font-bold">
        ${formatAmount(amount)}
      </span>
    </motion.div>
  );
}

/**
 * Staged Bet Display
 * Shows chips in the betting area (between player and pot)
 */
export function StagedBetDisplay({
  amount = 0,
  playerId,
  position = { x: '50%', y: '50%' },
  animate = true,
}) {
  if (amount <= 0) return null;

  // Calculate chip breakdown for visual display
  const chipBreakdown = useMemo(() => {
    const chips = [];
    let remaining = amount;
    const denominations = [500, 100, 25, 5, 1];

    for (const denom of denominations) {
      const count = Math.floor(remaining / denom);
      if (count > 0) {
        chips.push({ denomination: denom, count: Math.min(count, 3) });
        remaining %= denom;
      }
      if (chips.length >= 3) break;
    }

    return chips;
  }, [amount]);

  return (
    <motion.div
      className="staged-bet-display flex flex-col items-center"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
      initial={animate ? { scale: 0, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Mini chip stack */}
      <div className="flex flex-col-reverse items-center">
        {chipBreakdown.slice(0, 3).map((chip, index) => (
          <motion.div
            key={`${playerId}-chip-${index}`}
            className="w-5 h-5 rounded-full shadow-sm"
            style={{
              marginTop: index > 0 ? '-8px' : 0,
              zIndex: index,
              background: getChipColor(chip.denomination),
              border: `2px solid ${getChipBorderColor(chip.denomination)}`,
            }}
            initial={animate ? { y: -20, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
          />
        ))}
      </div>

      {/* Amount label */}
      <motion.span
        className="
          mt-1 px-2 py-0.5
          rounded-full
          bg-black/60
          text-amber-300 text-xs font-bold
          shadow
        "
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        ${formatAmount(amount)}
      </motion.span>
    </motion.div>
  );
}

/**
 * Get chip color based on denomination
 */
function getChipColor(denomination) {
  const colors = {
    1: '#ffffff',     // White
    5: '#ef4444',     // Red
    25: '#22c55e',    // Green
    100: '#1f1f1f',   // Black
    500: '#8b5cf6',   // Purple
    1000: '#eab308',  // Yellow
  };
  return colors[denomination] || colors[1];
}

/**
 * Get chip border color based on denomination
 */
function getChipBorderColor(denomination) {
  const colors = {
    1: '#d1d5db',     // Gray
    5: '#b91c1c',     // Dark red
    25: '#15803d',    // Dark green
    100: '#404040',   // Dark gray
    500: '#6d28d9',   // Dark purple
    1000: '#a16207',  // Dark yellow
  };
  return colors[denomination] || colors[1];
}

export default PlayerBetPill;
