/**
 * ============================================================================
 * PLAYER HUD (Heads-Up Display) COMPONENT
 * Real-Time Player Stats Overlay
 * ============================================================================
 *
 * This component displays a HUD overlay on the player's card area showing:
 * - Win probability percentage
 * - Current hand type (e.g., "TWO PAIR", "FLUSH")
 * - Hand strength indicator
 *
 * This is a massive UX win for casual players as it helps them understand
 * their current hand strength without memorizing poker hand rankings.
 *
 * ============================================================================
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

/**
 * Format hand category name for display
 * e.g., "TWO_PAIR" -> "Two Pair", "FULL_HOUSE" -> "Full House"
 */
function formatHandType(handType) {
  if (!handType) return '';
  return handType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get hand strength tier (for color coding)
 * Returns 'weak', 'medium', 'strong', or 'monster'
 */
function getHandStrengthTier(handCategory) {
  const tiers = {
    // Weak hands
    HIGH_CARD: 'weak',
    // Medium hands
    ONE_PAIR: 'medium',
    TWO_PAIR: 'medium',
    // Strong hands
    THREE_OF_A_KIND: 'strong',
    STRAIGHT: 'strong',
    FLUSH: 'strong',
    // Monster hands
    FULL_HOUSE: 'monster',
    FOUR_OF_A_KIND: 'monster',
    STRAIGHT_FLUSH: 'monster',
    ROYAL_FLUSH: 'monster',
    // Lowball hands (Kansas City Lowball)
    SEVEN_LOW: 'monster',
    EIGHT_LOW: 'strong',
    NINE_LOW: 'medium',
    TEN_LOW: 'weak',
  };
  return tiers[handCategory] || 'weak';
}

/**
 * Get color classes based on strength tier
 */
function getStrengthColors(tier) {
  const colors = {
    weak: {
      bg: 'bg-slate-600/90',
      border: 'border-slate-500',
      text: 'text-slate-300',
      accent: 'text-slate-400',
      glow: 'rgba(100, 116, 139, 0.3)',
    },
    medium: {
      bg: 'bg-amber-600/90',
      border: 'border-amber-500',
      text: 'text-amber-100',
      accent: 'text-amber-300',
      glow: 'rgba(245, 158, 11, 0.3)',
    },
    strong: {
      bg: 'bg-green-600/90',
      border: 'border-green-500',
      text: 'text-green-100',
      accent: 'text-green-300',
      glow: 'rgba(34, 197, 94, 0.3)',
    },
    monster: {
      bg: 'bg-gradient-to-r from-violet-600/90 to-purple-600/90',
      border: 'border-violet-500',
      text: 'text-violet-100',
      accent: 'text-violet-300',
      glow: 'rgba(139, 92, 246, 0.4)',
    },
  };
  return colors[tier] || colors.weak;
}

/**
 * Win Percentage Badge Component
 */
function WinPercentBadge({ percent = 0, size = 'md' }) {
  // Determine color based on win percentage
  const getPercentColor = (pct) => {
    if (pct >= 80) return 'text-green-400';
    if (pct >= 60) return 'text-emerald-400';
    if (pct >= 40) return 'text-amber-400';
    if (pct >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-2.5 py-1.5',
  };

  return (
    <motion.div
      className={`
        win-percent-badge
        ${sizeClasses[size]}
        rounded-md
        bg-slate-900/80
        border border-slate-700/50
        font-mono font-bold
        ${getPercentColor(percent)}
      `}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <span className="text-slate-500 text-[10px] mr-1">WIN</span>
      {Math.round(percent)}%
    </motion.div>
  );
}

/**
 * Hand Type Badge Component
 */
function HandTypeBadge({
  handType,
  handDescription = '',
  tier = 'weak',
  size = 'md',
}) {
  const colors = getStrengthColors(tier);
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <motion.div
      className={`
        hand-type-badge
        ${sizeClasses[size]}
        rounded-md
        ${colors.bg}
        border ${colors.border}
        ${colors.text}
        font-bold
        uppercase tracking-wide
      `}
      initial={{ scale: 0.9, opacity: 0, y: 5 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        boxShadow: `0 4px 12px ${colors.glow}`,
      }}
    >
      {formatHandType(handType)}
    </motion.div>
  );
}

/**
 * Strength Bar Component
 * Visual indicator of hand strength
 */
function StrengthBar({ strength = 0, maxStrength = 10 }) {
  const percentage = (strength / maxStrength) * 100;

  // Determine color based on strength
  const getBarColor = () => {
    if (percentage >= 80) return 'bg-gradient-to-r from-violet-500 to-purple-500';
    if (percentage >= 60) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (percentage >= 40) return 'bg-gradient-to-r from-amber-500 to-yellow-500';
    if (percentage >= 20) return 'bg-gradient-to-r from-orange-500 to-amber-500';
    return 'bg-gradient-to-r from-red-500 to-orange-500';
  };

  return (
    <div className="strength-bar w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${getBarColor()} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      />
    </div>
  );
}

/**
 * Main Player HUD Component
 *
 * Props:
 * - handCategory: The hand type (e.g., 'TWO_PAIR', 'FLUSH')
 * - handDescription: Optional description (e.g., 'Aces and Kings')
 * - winPercent: Win probability (0-100)
 * - handStrength: Numeric hand strength (0-10)
 * - showWinPercent: Whether to show win percentage
 * - showStrengthBar: Whether to show strength bar
 * - variant: 'compact' | 'default' | 'expanded'
 * - position: 'above' | 'below' | 'overlay'
 */
export function PlayerHUD({
  handCategory = null,
  handDescription = '',
  winPercent = null,
  handStrength = null,
  showWinPercent = true,
  showStrengthBar = false,
  variant = 'default',
  position = 'overlay',
  className = '',
}) {
  const tier = useMemo(() => getHandStrengthTier(handCategory), [handCategory]);
  const colors = useMemo(() => getStrengthColors(tier), [tier]);

  // Don't render if no hand data
  if (!handCategory && winPercent === null) return null;

  // Position classes
  const positionClasses = {
    above: 'absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full',
    below: 'absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full',
    overlay: 'absolute inset-x-0 bottom-0',
  };

  if (variant === 'compact') {
    return (
      <motion.div
        className={`
          player-hud-compact
          ${positionClasses[position]}
          flex items-center gap-1.5
          px-2 py-1
          rounded-lg
          bg-slate-900/80
          border border-slate-700/50
          z-10
          ${className}
        `}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        {handCategory && (
          <span className={`text-[10px] font-bold uppercase ${colors.accent}`}>
            {formatHandType(handCategory)}
          </span>
        )}
        {winPercent !== null && showWinPercent && (
          <span className="text-[10px] font-mono text-slate-400">
            {Math.round(winPercent)}%
          </span>
        )}
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      className={`
        player-hud
        ${positionClasses[position]}
        flex flex-col items-center gap-1
        p-2
        rounded-lg
        bg-slate-900/90
        border border-slate-700/50
        z-10
        ${className}
      `}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Hand Type Badge */}
      {handCategory && (
        <HandTypeBadge
          handType={handCategory}
          handDescription={handDescription}
          tier={tier}
          size={variant === 'expanded' ? 'lg' : 'md'}
        />
      )}

      {/* Win Percentage */}
      {winPercent !== null && showWinPercent && (
        <WinPercentBadge
          percent={winPercent}
          size={variant === 'expanded' ? 'md' : 'sm'}
        />
      )}

      {/* Strength Bar */}
      {handStrength !== null && showStrengthBar && (
        <div className="w-full mt-1">
          <StrengthBar strength={handStrength} maxStrength={10} />
        </div>
      )}

      {/* Hand Description (for expanded variant) */}
      {variant === 'expanded' && handDescription && (
        <span className="text-[10px] text-slate-400 text-center mt-0.5">
          {handDescription}
        </span>
      )}
    </motion.div>
  );
}

/**
 * Opponent HUD Component
 * Simplified version for opponent card areas
 */
export function OpponentHUD({
  handCategory = null,
  isFolded = false,
  isAllIn = false,
  className = '',
}) {
  if (isFolded) {
    return (
      <motion.div
        className={`
          opponent-hud-folded
          px-2 py-0.5
          rounded-md
          bg-slate-800/80
          text-slate-500 text-[10px] font-medium
          uppercase tracking-wide
          ${className}
        `}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Folded
      </motion.div>
    );
  }

  if (isAllIn) {
    return (
      <motion.div
        className={`
          opponent-hud-allin
          px-2 py-0.5
          rounded-md
          bg-violet-600/80
          text-violet-100 text-[10px] font-bold
          uppercase tracking-wide
          ${className}
        `}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        All-In
      </motion.div>
    );
  }

  if (!handCategory) return null;

  const tier = getHandStrengthTier(handCategory);
  const colors = getStrengthColors(tier);

  return (
    <motion.div
      className={`
        opponent-hud
        px-2 py-0.5
        rounded-md
        ${colors.bg}
        border ${colors.border}
        ${colors.text}
        text-[10px] font-bold
        uppercase tracking-wide
        ${className}
      `}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {formatHandType(handCategory)}
    </motion.div>
  );
}

export default PlayerHUD;
