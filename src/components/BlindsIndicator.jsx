/**
 * ============================================================================
 * BLINDS INDICATOR COMPONENT
 * Compact Blinds Display for Poker Table Header
 * ============================================================================
 *
 * This component shows the current blind levels in a compact format
 * at the top of the table. Features:
 * - Minimal vertical space usage
 * - Clear SB/BB display
 * - Optional ante indicator
 * - Tournament blind level indicator
 *
 * ============================================================================
 */

import { motion } from 'framer-motion';

/**
 * Format chip amount for compact display
 */
function formatBlind(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
  return amount?.toLocaleString() || '0';
}

/**
 * Compact Blinds Indicator Component
 *
 * Props:
 * - smallBlind: Small blind amount
 * - bigBlind: Big blind amount
 * - ante: Optional ante amount
 * - level: Tournament blind level (optional)
 * - variant: 'default' | 'compact' | 'pill'
 */
export function BlindsIndicator({
  smallBlind = 1,
  bigBlind = 2,
  ante = 0,
  level = null,
  variant = 'default',
  className = '',
}) {
  if (variant === 'pill') {
    return (
      <div className={`blinds-indicator-pill flex items-center gap-1 ${className}`}>
        <div
          className="
            flex items-center gap-1.5
            px-2.5 py-1
            rounded-full
            bg-slate-800/80
            border border-slate-700/50
          "
        >
          {/* Blind chip icon */}
          <div className="flex -space-x-0.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-600" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600" />
          </div>

          {/* Blinds text */}
          <span className="text-slate-300 text-xs font-medium">
            {formatBlind(smallBlind)}/{formatBlind(bigBlind)}
          </span>

          {/* Ante (if present) */}
          {ante > 0 && (
            <span className="text-slate-500 text-xs">
              ({formatBlind(ante)})
            </span>
          )}
        </div>

        {/* Level indicator */}
        {level && (
          <div
            className="
              px-2 py-1
              rounded-full
              bg-violet-600/80
              border border-violet-500/50
            "
          >
            <span className="text-violet-100 text-xs font-semibold">
              Lvl {level}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`blinds-indicator-compact flex items-center gap-2 ${className}`}>
        <span className="text-slate-500 text-xs">Blinds</span>
        <span className="text-slate-200 text-xs font-semibold">
          ${formatBlind(smallBlind)}/${formatBlind(bigBlind)}
        </span>
        {ante > 0 && (
          <span className="text-slate-400 text-xs">
            +${formatBlind(ante)} ante
          </span>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <motion.div
      className={`blinds-indicator-default flex items-center gap-3 ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* SB indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className="
            w-5 h-5
            rounded-full
            bg-blue-500
            border border-blue-600
            flex items-center justify-center
            text-white text-[8px] font-bold
            shadow-sm
          "
        >
          SB
        </div>
        <span className="text-slate-300 text-sm font-medium">
          ${formatBlind(smallBlind)}
        </span>
      </div>

      {/* Separator */}
      <span className="text-slate-600">/</span>

      {/* BB indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className="
            w-5 h-5
            rounded-full
            bg-amber-500
            border border-amber-600
            flex items-center justify-center
            text-slate-900 text-[8px] font-bold
            shadow-sm
          "
        >
          BB
        </div>
        <span className="text-slate-300 text-sm font-medium">
          ${formatBlind(bigBlind)}
        </span>
      </div>

      {/* Ante indicator */}
      {ante > 0 && (
        <>
          <span className="text-slate-600">+</span>
          <div className="flex items-center gap-1.5">
            <div
              className="
                w-5 h-5
                rounded-full
                bg-green-500
                border border-green-600
                flex items-center justify-center
                text-white text-[7px] font-bold
                shadow-sm
              "
            >
              A
            </div>
            <span className="text-slate-300 text-sm font-medium">
              ${formatBlind(ante)}
            </span>
          </div>
        </>
      )}

      {/* Tournament level */}
      {level && (
        <div
          className="
            ml-2 px-2 py-0.5
            rounded-full
            bg-violet-600/30
            border border-violet-500/30
          "
        >
          <span className="text-violet-300 text-xs font-medium">
            Level {level}
          </span>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Blinds Timer Display
 * Shows remaining time until blind level increases (for tournaments)
 */
export function BlindsTimer({
  remainingSeconds = 0,
  isWarning = false,
  className = '',
}) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <motion.div
      className={`
        blinds-timer flex items-center gap-2
        px-3 py-1.5
        rounded-lg
        ${isWarning
          ? 'bg-red-600/20 border border-red-500/30'
          : 'bg-slate-800/50 border border-slate-700/30'
        }
        ${className}
      `}
      animate={isWarning ? {
        scale: [1, 1.02, 1],
        transition: { repeat: Infinity, duration: 1 }
      } : {}}
    >
      <svg
        className={`w-4 h-4 ${isWarning ? 'text-red-400' : 'text-slate-400'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`text-sm font-mono font-semibold ${isWarning ? 'text-red-300' : 'text-slate-300'}`}>
        {timeString}
      </span>
      <span className={`text-xs ${isWarning ? 'text-red-400' : 'text-slate-500'}`}>
        until next level
      </span>
    </motion.div>
  );
}

export default BlindsIndicator;
