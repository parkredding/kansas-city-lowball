/**
 * ============================================================================
 * TABLE OVERLAY COMPONENT
 * Professional Poker Table UI - Centralized Pot & Community Cards
 * ============================================================================
 *
 * This component implements the high-industry standard poker table overlay
 * featuring:
 * - Centralized pot display with large, prominent typography
 * - Community cards positioned below the pot
 * - Responsive scaling with aspect ratio maintenance
 * - Dark green gradient felt with wooden rail border
 *
 * Visual Hierarchy:
 * ┌─────────────────────────────────────────────────┐
 * │                TOTAL POT: $1,234                │ ← Large, centered
 * │                                                 │
 * │          [  ] [  ] [  ] [  ] [  ]              │ ← Community cards
 * │                                                 │
 * └─────────────────────────────────────────────────┘
 * ============================================================================
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import ChipStack from './ChipStack';

/**
 * 4-Color Deck Standard for instant suit recognition
 */
const FOUR_COLOR_DECK = {
  h: { symbol: '♥', color: 'text-red-500', name: 'hearts' },
  d: { symbol: '♦', color: 'text-blue-500', name: 'diamonds' },
  c: { symbol: '♣', color: 'text-green-500', name: 'clubs' },
  s: { symbol: '♠', color: 'text-slate-900', name: 'spades' },
};

/**
 * Format currency amounts for display
 */
function formatCurrency(amount) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 10000) return `$${Math.floor(amount / 1000)}k`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount?.toLocaleString() || '0'}`;
}

/**
 * Draw Round Indicator Component
 * Displays the current draw round prominently for Draw Poker variants
 * Shows: "Draw 1", "Draw 2", "Draw 3", or "Final Betting"
 */
export function DrawRoundIndicator({ phase, gameType = 'lowball_27' }) {
  // Only show for draw poker variants
  if (gameType === 'holdem') return null;

  // Parse the phase to determine what to display
  const getDrawInfo = () => {
    switch (phase) {
      case 'BETTING_1':
        return { label: 'Pre-Draw', sublabel: 'First Betting Round', number: 0 };
      case 'DRAW_1':
        return { label: 'Draw 1', sublabel: 'Select cards to discard', number: 1 };
      case 'BETTING_2':
        return { label: 'After Draw 1', sublabel: 'Second Betting Round', number: 1 };
      case 'DRAW_2':
        return { label: 'Draw 2', sublabel: 'Select cards to discard', number: 2 };
      case 'BETTING_3':
        return { label: 'After Draw 2', sublabel: 'Third Betting Round', number: 2 };
      case 'DRAW_3':
        return { label: 'Final Draw', sublabel: 'Last chance to draw', number: 3 };
      case 'BETTING_4':
        return { label: 'Final Betting', sublabel: 'Last betting round', number: 3 };
      case 'SHOWDOWN':
        return { label: 'Showdown', sublabel: 'Reveal hands', number: 4 };
      default:
        return null;
    }
  };

  const info = getDrawInfo();
  if (!info) return null;

  const isDrawPhase = phase?.startsWith('DRAW_');

  return (
    <motion.div
      className="draw-round-indicator"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div
        className={`
          inline-flex flex-col items-center justify-center
          px-4 py-2 rounded-xl
          ${isDrawPhase
            ? 'bg-gradient-to-r from-amber-600/90 to-orange-600/90 ring-2 ring-amber-400/50'
            : 'bg-slate-800/90 ring-1 ring-slate-600/50'
          }
          backdrop-blur-sm
          shadow-lg
        `}
        style={{
          boxShadow: isDrawPhase
            ? '0 4px 20px rgba(245, 158, 11, 0.4), 0 2px 8px rgba(0,0,0,0.3)'
            : '0 4px 12px rgba(0,0,0,0.4)',
        }}
      >
        <span
          className={`
            text-sm sm:text-base font-bold tracking-wide
            ${isDrawPhase ? 'text-white' : 'text-amber-400'}
          `}
        >
          {info.label}
        </span>
        <span
          className={`
            text-[10px] sm:text-xs font-medium
            ${isDrawPhase ? 'text-amber-100/80' : 'text-slate-400'}
          `}
        >
          {info.sublabel}
        </span>

        {/* Progress dots for draw rounds */}
        {info.number > 0 && info.number < 4 && (
          <div className="flex gap-1.5 mt-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`
                  w-1.5 h-1.5 rounded-full transition-all
                  ${n <= info.number
                    ? isDrawPhase ? 'bg-white' : 'bg-amber-400'
                    : 'bg-slate-600'
                  }
                `}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Centralized Pot Display Component
 * Large, prominent display directly above community cards
 */
export function CentralPotDisplay({
  totalPot = 0,
  sidePots = [],
  animate = true,
  showChips = true,
}) {
  if (totalPot <= 0) return null;

  const totalWithSidePots = totalPot + sidePots.reduce((sum, pot) => sum + (pot.amount || 0), 0);

  return (
    <motion.div
      className="central-pot-display flex flex-col items-center gap-2"
      initial={animate ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Main Pot Label - Large, Centered Typography */}
      <motion.div
        className="pot-label-container"
        layout
      >
        <div className="flex items-center gap-3">
          {/* Optional chip icon */}
          {showChips && (
            <div className="pot-chips-mini flex -space-x-1">
              <div className="w-4 h-4 rounded-full bg-red-600 border border-red-800 shadow-sm" />
              <div className="w-4 h-4 rounded-full bg-green-600 border border-green-800 shadow-sm" />
              <div className="w-4 h-4 rounded-full bg-blue-600 border border-blue-800 shadow-sm" />
            </div>
          )}

          {/* Pot Amount */}
          <div className="pot-amount-display">
            <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">
              Total Pot
            </span>
            <motion.span
              className="text-amber-400 text-3xl font-bold tracking-tight ml-3"
              key={totalWithSidePots}
              initial={{ scale: 1.1, color: '#fbbf24' }}
              animate={{ scale: 1, color: '#fbbf24' }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {formatCurrency(totalWithSidePots)}
            </motion.span>
          </div>
        </div>
      </motion.div>

      {/* Side Pots Indicator (if any) */}
      {sidePots.length > 0 && (
        <div className="side-pots-row flex gap-2 flex-wrap justify-center">
          {sidePots.map((pot, index) => (
            <motion.div
              key={`sidepot-${index}`}
              className="sidepot-pill px-3 py-1 rounded-full bg-slate-700/80 border border-slate-600/50"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span className="text-slate-400 text-xs">Side Pot {index + 1}: </span>
              <span className="text-amber-300 text-xs font-semibold">{formatCurrency(pot.amount)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Enhanced Community Card Component
 * Implements 4-color deck for instant suit recognition
 */
function CommunityCardEnhanced({ card, index, isNew = false }) {
  if (!card || !card.suit || !card.rank) {
    return <EmptyCardSlotEnhanced />;
  }

  const suit = FOUR_COLOR_DECK[card.suit];

  return (
    <motion.div
      className="community-card-enhanced relative"
      initial={isNew ? { y: -50, opacity: 0, scale: 0.5, rotateY: 180 } : false}
      animate={{ y: 0, opacity: 1, scale: 1, rotateY: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: isNew ? index * 0.1 : 0,
      }}
    >
      <div
        className="w-[52px] h-[76px] sm:w-[60px] sm:h-[88px] rounded-lg bg-white relative overflow-hidden"
        style={{
          boxShadow: '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        {/* Top-left rank and suit */}
        <div className={`absolute top-1 left-1.5 ${suit?.color || 'text-slate-900'}`}>
          <div className="text-sm sm:text-base font-bold leading-none">{card.rank}</div>
          <div className="text-sm sm:text-base leading-none -mt-0.5">{suit?.symbol}</div>
        </div>

        {/* Center suit (large) */}
        <div className={`absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl ${suit?.color || 'text-slate-900'}`}>
          {suit?.symbol}
        </div>

        {/* Bottom-right rank and suit (inverted) */}
        <div className={`absolute bottom-1 right-1.5 rotate-180 ${suit?.color || 'text-slate-900'}`}>
          <div className="text-sm sm:text-base font-bold leading-none">{card.rank}</div>
          <div className="text-sm sm:text-base leading-none -mt-0.5">{suit?.symbol}</div>
        </div>

        {/* Subtle inner border */}
        <div className="absolute inset-0.5 rounded-md border border-gray-200/30 pointer-events-none" />
      </div>
    </motion.div>
  );
}

/**
 * Empty Card Slot Placeholder
 */
function EmptyCardSlotEnhanced() {
  return (
    <div
      className="w-[52px] h-[76px] sm:w-[60px] sm:h-[88px] rounded-lg border-2 border-dashed border-green-600/30 bg-green-900/20"
    />
  );
}

/**
 * Enhanced Community Cards Row
 * Shows 5 community card slots (3 flop + 1 turn + 1 river)
 */
export function CommunityCardsEnhanced({ cards = [], phase = 'PREFLOP' }) {
  const getExpectedCards = () => {
    switch (phase) {
      case 'FLOP': return 3;
      case 'TURN': return 4;
      case 'RIVER':
      case 'SHOWDOWN': return 5;
      default: return 0;
    }
  };

  const expectedCards = getExpectedCards();

  const isNewCard = (index) => {
    if (phase === 'FLOP' && index < 3) return true;
    if (phase === 'TURN' && index === 3) return true;
    if (phase === 'RIVER' && index === 4) return true;
    return false;
  };

  // Don't show in preflop
  if (phase === 'PREFLOP' || phase === 'BETTING_1') {
    return null;
  }

  return (
    <div className="community-cards-enhanced flex items-center justify-center gap-1.5 sm:gap-2">
      {/* Flop cards (3) */}
      <div className="flop-cards flex gap-1.5 sm:gap-2">
        <AnimatePresence>
          {[0, 1, 2].map((i) => (
            cards[i] ? (
              <CommunityCardEnhanced
                key={`community-${i}`}
                card={cards[i]}
                index={i}
                isNew={isNewCard(i)}
              />
            ) : expectedCards > i ? (
              <EmptyCardSlotEnhanced key={`empty-${i}`} />
            ) : null
          ))}
        </AnimatePresence>
      </div>

      {/* Divider before turn */}
      {expectedCards >= 4 && <div className="w-1 sm:w-2" />}

      {/* Turn card */}
      <AnimatePresence>
        {cards[3] ? (
          <CommunityCardEnhanced
            key="community-3"
            card={cards[3]}
            index={3}
            isNew={isNewCard(3)}
          />
        ) : expectedCards >= 4 ? (
          <EmptyCardSlotEnhanced key="empty-3" />
        ) : null}
      </AnimatePresence>

      {/* Divider before river */}
      {expectedCards >= 5 && <div className="w-1 sm:w-2" />}

      {/* River card */}
      <AnimatePresence>
        {cards[4] ? (
          <CommunityCardEnhanced
            key="community-4"
            card={cards[4]}
            index={4}
            isNew={isNewCard(4)}
          />
        ) : expectedCards >= 5 ? (
          <EmptyCardSlotEnhanced key="empty-4" />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Main Table Overlay Component
 * Combines pot display with community cards in a centralized layout
 */
export function TableOverlay({
  totalPot = 0,
  sidePots = [],
  communityCards = [],
  phase = 'PREFLOP',
  showPot = true,
  className = '',
  gameType = 'lowball_27',
}) {
  // Determine if this is a draw game
  const isDrawGame = gameType !== 'holdem';

  return (
    <div className={`table-overlay flex flex-col items-center gap-4 ${className}`}>
      {/* Draw Round Indicator - Only for draw poker variants */}
      {isDrawGame && (
        <DrawRoundIndicator phase={phase} gameType={gameType} />
      )}

      {/* Centralized Pot Display */}
      {showPot && (
        <CentralPotDisplay
          totalPot={totalPot}
          sidePots={sidePots}
        />
      )}

      {/* Community Cards (for Hold'em) */}
      <CommunityCardsEnhanced
        cards={communityCards}
        phase={phase}
      />
    </div>
  );
}

export default TableOverlay;
