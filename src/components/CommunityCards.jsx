/**
 * ============================================================================
 * COMMUNITY CARDS COMPONENT
 * 4-Color Deck Standard for Texas Hold'em Board Display
 * ============================================================================
 *
 * This component displays the community cards (board) for Texas Hold'em:
 * - 5 card slots (3 flop + 1 turn + 1 river)
 * - 4-color deck for instant suit recognition
 * - Phase-aware rendering
 * - Smooth deal animations
 *
 * FOUR-COLOR DECK STANDARD:
 * - Spades: Black (traditional)
 * - Hearts: Red (traditional)
 * - Diamonds: BLUE (distinguishes from hearts)
 * - Clubs: GREEN (distinguishes from spades)
 *
 * ============================================================================
 */

import { motion, AnimatePresence } from 'framer-motion';

/**
 * 4-Color Deck Standard Configuration
 * Professional poker uses this for instant suit recognition at a glance
 */
const FOUR_COLOR_DECK = {
  h: {
    symbol: '\u2665', // ♥
    color: 'text-red-500',
    name: 'hearts',
    bgGlow: 'rgba(239, 68, 68, 0.15)',
  },
  d: {
    symbol: '\u2666', // ♦
    color: 'text-blue-500',
    name: 'diamonds',
    bgGlow: 'rgba(59, 130, 246, 0.15)',
  },
  c: {
    symbol: '\u2663', // ♣
    color: 'text-green-500',
    name: 'clubs',
    bgGlow: 'rgba(34, 197, 94, 0.15)',
  },
  s: {
    symbol: '\u2660', // ♠
    color: 'text-slate-900',
    name: 'spades',
    bgGlow: 'rgba(30, 41, 59, 0.15)',
  },
};

/**
 * Single community card component with 4-color deck support
 */
function CommunityCard({ card, index, isNew = false, size = 'md' }) {
  if (!card || !card.suit || !card.rank) {
    return null;
  }

  const suit = FOUR_COLOR_DECK[card.suit];

  // Size configurations
  const sizeClasses = {
    sm: { card: 'w-12 h-[72px]', rank: 'text-sm', centerSuit: 'text-2xl', cornerSuit: 'text-sm' },
    md: { card: 'w-14 h-[84px] sm:w-16 sm:h-24', rank: 'text-base sm:text-lg', centerSuit: 'text-3xl sm:text-4xl', cornerSuit: 'text-base sm:text-lg' },
    lg: { card: 'w-16 h-24 sm:w-20 sm:h-[120px]', rank: 'text-lg sm:text-xl', centerSuit: 'text-4xl sm:text-5xl', cornerSuit: 'text-lg sm:text-xl' },
  };

  const sizes = sizeClasses[size] || sizeClasses.md;

  return (
    <motion.div
      className={`community-card ${sizes.card} bg-white rounded-lg relative overflow-hidden`}
      initial={isNew ? { y: -50, opacity: 0, scale: 0.5, rotateY: 180 } : false}
      animate={{ y: 0, opacity: 1, scale: 1, rotateY: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: isNew ? index * 0.1 : 0,
      }}
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      {/* Top-left corner: rank and suit */}
      <div className={`absolute top-1 left-1.5 ${suit?.color || 'text-slate-900'}`}>
        <div className={`${sizes.rank} font-bold leading-none`}>{card.rank}</div>
        <div className={`${sizes.cornerSuit} leading-none -mt-0.5`}>{suit?.symbol || '?'}</div>
      </div>

      {/* Center suit (large) */}
      <div className={`absolute inset-0 flex items-center justify-center ${sizes.centerSuit} ${suit?.color || 'text-slate-900'}`}>
        {suit?.symbol || '?'}
      </div>

      {/* Bottom-right corner (inverted): rank and suit */}
      <div className={`absolute bottom-1 right-1.5 rotate-180 ${suit?.color || 'text-slate-900'}`}>
        <div className={`${sizes.rank} font-bold leading-none`}>{card.rank}</div>
        <div className={`${sizes.cornerSuit} leading-none -mt-0.5`}>{suit?.symbol || '?'}</div>
      </div>

      {/* Subtle inner border for depth */}
      <div className="absolute inset-0.5 rounded-md border border-gray-200/40 pointer-events-none" />

      {/* Suit-colored glow effect */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${suit?.bgGlow || 'transparent'} 0%, transparent 70%)`,
        }}
      />
    </motion.div>
  );
}

/**
 * Empty card placeholder for unrevealed community cards
 */
function EmptyCardSlot({ size = 'md' }) {
  const sizeClasses = {
    sm: 'w-12 h-[72px]',
    md: 'w-14 h-[84px] sm:w-16 sm:h-24',
    lg: 'w-16 h-24 sm:w-20 sm:h-[120px]',
  };

  return (
    <div
      className={`
        empty-card-slot
        ${sizeClasses[size] || sizeClasses.md}
        rounded-lg
        border-2 border-dashed border-green-600/30
        bg-green-900/20
      `}
    />
  );
}

/**
 * Community Cards display for Texas Hold'em
 * Shows 5 community card slots (3 flop, 1 turn, 1 river)
 *
 * Props:
 * - cards: Array of card objects { rank, suit }
 * - phase: Current game phase ('PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN')
 * - size: Card size variant ('sm', 'md', 'lg')
 * - showLabel: Whether to show "Community Cards" label
 */
export function CommunityCards({
  cards = [],
  phase = 'PREFLOP',
  size = 'md',
  showLabel = false,
}) {
  // Determine how many cards should be shown based on phase
  const getExpectedCards = () => {
    switch (phase) {
      case 'FLOP':
        return 3;
      case 'TURN':
        return 4;
      case 'RIVER':
      case 'SHOWDOWN':
        return 5;
      default:
        return 0;
    }
  };

  const expectedCards = getExpectedCards();

  // Check which cards are newly dealt (for animation)
  const isNewCard = (index) => {
    if (phase === 'FLOP' && index < 3) return true;
    if (phase === 'TURN' && index === 3) return true;
    if (phase === 'RIVER' && index === 4) return true;
    return false;
  };

  // If we're in preflop or early betting, show nothing
  if (phase === 'PREFLOP' || phase === 'BETTING_1') {
    return null;
  }

  // Gap between card groups
  const gapClasses = {
    sm: 'gap-1',
    md: 'gap-1.5 sm:gap-2',
    lg: 'gap-2 sm:gap-3',
  };

  return (
    <div className="community-cards-container flex flex-col items-center">
      {/* Optional label */}
      {showLabel && (
        <div className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">
          Community Cards
        </div>
      )}

      <div className={`flex items-center justify-center ${gapClasses[size] || gapClasses.md}`}>
        {/* Flop cards (3) */}
        <div className={`flop-cards flex ${gapClasses[size] || gapClasses.md}`}>
          <AnimatePresence>
            {[0, 1, 2].map((i) => (
              cards[i] ? (
                <CommunityCard
                  key={`community-${i}`}
                  card={cards[i]}
                  index={i}
                  isNew={isNewCard(i)}
                  size={size}
                />
              ) : expectedCards > i ? (
                <EmptyCardSlot key={`empty-${i}`} size={size} />
              ) : null
            ))}
          </AnimatePresence>
        </div>

        {/* Divider before turn */}
        {expectedCards >= 4 && (
          <div className="turn-divider w-1 sm:w-2" />
        )}

        {/* Turn card */}
        <AnimatePresence>
          {cards[3] ? (
            <CommunityCard
              key="community-3"
              card={cards[3]}
              index={3}
              isNew={isNewCard(3)}
              size={size}
            />
          ) : expectedCards >= 4 ? (
            <EmptyCardSlot key="empty-3" size={size} />
          ) : null}
        </AnimatePresence>

        {/* Divider before river */}
        {expectedCards >= 5 && (
          <div className="river-divider w-1 sm:w-2" />
        )}

        {/* River card */}
        <AnimatePresence>
          {cards[4] ? (
            <CommunityCard
              key="community-4"
              card={cards[4]}
              index={4}
              isNew={isNewCard(4)}
              size={size}
            />
          ) : expectedCards >= 5 ? (
            <EmptyCardSlot key="empty-4" size={size} />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Board Summary Component
 * Shows a compact summary of the community cards (for hand history, etc.)
 */
export function BoardSummary({ cards = [], className = '' }) {
  if (cards.length === 0) return null;

  return (
    <div className={`board-summary flex items-center gap-0.5 ${className}`}>
      {cards.map((card, index) => {
        const suit = FOUR_COLOR_DECK[card?.suit];
        return (
          <span
            key={`board-${index}`}
            className={`text-xs font-semibold ${suit?.color || 'text-slate-400'}`}
          >
            {card?.rank}{suit?.symbol}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Card Badge - Compact single card display
 */
export function CardBadge({ card, size = 'sm', className = '' }) {
  if (!card) return null;

  const suit = FOUR_COLOR_DECK[card.suit];

  const sizeClasses = {
    xs: 'text-[10px] px-1 py-0.5',
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  return (
    <span
      className={`
        card-badge inline-flex items-center
        ${sizeClasses[size]}
        rounded
        bg-white
        font-bold
        ${suit?.color || 'text-slate-900'}
        ${className}
      `}
      style={{
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      {card.rank}{suit?.symbol}
    </span>
  );
}

export default CommunityCards;
