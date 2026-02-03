/**
 * ============================================================================
 * HAND HISTORY WIDGET
 * Semi-Transparent Floating Widget for Previous Hand Results
 * ============================================================================
 *
 * This component displays a compact, floating hand history widget in the
 * top-right corner of the poker table. Features:
 * - Semi-transparent glass morphism design
 * - Shows previous winners and amounts
 * - Non-intrusive positioning (doesn't overlap table)
 * - Expandable/collapsible for detailed history
 *
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Format currency for display
 */
function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount?.toLocaleString() || '0';
}

/**
 * Format hand type for display (e.g., "TWO_PAIR" -> "Two Pair")
 */
function formatHandType(handType) {
  if (!handType) return '';
  return handType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Single Hand History Entry
 */
function HandHistoryEntry({ entry, index, isLatest = false }) {
  const { winner, amount, handType, handNumber, timestamp } = entry;

  return (
    <motion.div
      className={`
        hand-entry flex items-center justify-between gap-3 py-2 px-3
        ${index > 0 ? 'border-t border-slate-600/30' : ''}
        ${isLatest ? 'bg-amber-500/10' : ''}
      `}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Winner Info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Winner indicator */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLatest ? 'bg-amber-400' : 'bg-slate-500'}`} />

        {/* Winner name */}
        <span className="text-slate-200 text-sm font-medium truncate">
          {winner || 'Unknown'}
        </span>
      </div>

      {/* Win Details */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Hand type (if available) */}
        {handType && (
          <span className="text-slate-400 text-xs hidden sm:inline">
            {formatHandType(handType)}
          </span>
        )}

        {/* Amount won */}
        <span className="text-amber-400 text-sm font-bold">
          +${formatAmount(amount)}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Hand History Widget Component
 *
 * Props:
 * - history: Array of { winner, amount, handType, handNumber, timestamp }
 * - maxVisible: Maximum entries to show when collapsed
 * - position: 'top-right' | 'top-left' (default: 'top-right')
 */
export function HandHistory({
  history = [],
  maxVisible = 3,
  position = 'top-right',
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get visible entries
  const visibleHistory = useMemo(() => {
    if (isExpanded) return history.slice(0, 10);
    return history.slice(0, maxVisible);
  }, [history, maxVisible, isExpanded]);

  // Don't render if no history
  if (history.length === 0) return null;

  const positionClasses = {
    'top-right': 'top-2 right-2 sm:top-3 sm:right-3',
    'top-left': 'top-2 left-2 sm:top-3 sm:left-3',
  };

  return (
    <motion.div
      className={`
        hand-history-widget
        absolute ${positionClasses[position]}
        z-30
        min-w-[180px] max-w-[280px] sm:max-w-[320px]
        ${className}
      `}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Glass Container */}
      <div
        className="
          rounded-xl overflow-hidden
          bg-slate-900/80
          border border-slate-700/50
        "
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="
            w-full flex items-center justify-between gap-2
            px-3 py-2
            bg-slate-800/50
            hover:bg-slate-700/50
            transition-colors
          "
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-slate-300 text-xs font-semibold uppercase tracking-wide">
              Hand History
            </span>
          </div>

          {/* Expand/Collapse indicator */}
          <div className="flex items-center gap-1">
            {history.length > maxVisible && (
              <span className="text-slate-500 text-xs">
                {visibleHistory.length}/{history.length}
              </span>
            )}
            <motion.svg
              className="w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </div>
        </button>

        {/* History Entries */}
        <AnimatePresence>
          <div className="history-entries">
            {visibleHistory.map((entry, index) => (
              <HandHistoryEntry
                key={entry.handNumber || `hand-${index}`}
                entry={entry}
                index={index}
                isLatest={index === 0}
              />
            ))}
          </div>
        </AnimatePresence>

        {/* "View All" indicator when collapsed */}
        {!isExpanded && history.length > maxVisible && (
          <div className="px-3 py-1.5 text-center border-t border-slate-600/30">
            <span className="text-slate-500 text-xs">
              +{history.length - maxVisible} more
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Latest Win Banner Component
 * Shows a temporary banner for the most recent win
 */
export function LatestWinBanner({
  winner,
  amount,
  handType,
  show = false,
  onHide,
  duration = 4000,
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="
            latest-win-banner
            fixed top-[15%] left-1/2 -translate-x-1/2
            z-50
            px-6 py-4
            rounded-2xl
            bg-gradient-to-r from-amber-600/95 to-amber-500/95
            border border-amber-400/50
            shadow-2xl
          "
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onAnimationComplete={() => {
            if (onHide) {
              setTimeout(onHide, duration);
            }
          }}
        >
          <div className="flex items-center gap-4">
            {/* Trophy Icon */}
            <div className="text-3xl">
              🏆
            </div>

            {/* Win Info */}
            <div className="flex flex-col">
              <span className="text-amber-100 text-sm font-medium">
                {winner || 'Winner'} wins!
              </span>
              <div className="flex items-center gap-2">
                <span className="text-white text-2xl font-bold">
                  +${formatAmount(amount)}
                </span>
                {handType && (
                  <span className="text-amber-200 text-sm">
                    with {formatHandType(handType)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default HandHistory;
