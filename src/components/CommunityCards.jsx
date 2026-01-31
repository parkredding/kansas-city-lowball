import { motion, AnimatePresence } from 'framer-motion';

const SUIT_SYMBOLS = {
  h: { symbol: '\u2665', color: 'text-red-500' },
  d: { symbol: '\u2666', color: 'text-red-500' },
  c: { symbol: '\u2663', color: 'text-gray-900' },
  s: { symbol: '\u2660', color: 'text-gray-900' },
};

/**
 * Single community card component
 */
function CommunityCard({ card, index, isNew = false }) {
  if (!card || !card.suit || !card.rank) {
    return null;
  }

  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <motion.div
      className="w-16 h-24 bg-white rounded-lg relative"
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
      {/* Card content */}
      <div className={`absolute top-1 left-1.5 text-lg font-bold ${suit?.color || 'text-gray-900'}`}>
        {card.rank}
      </div>
      <div className={`absolute top-5 left-1.5 text-lg ${suit?.color || 'text-gray-900'}`}>
        {suit?.symbol || '?'}
      </div>

      {/* Center suit */}
      <div className={`absolute inset-0 flex items-center justify-center text-4xl ${suit?.color || 'text-gray-900'}`}>
        {suit?.symbol || '?'}
      </div>

      {/* Bottom right (inverted) */}
      <div className={`absolute bottom-1 right-1.5 text-lg font-bold rotate-180 ${suit?.color || 'text-gray-900'}`}>
        {card.rank}
      </div>
    </motion.div>
  );
}

/**
 * Empty card placeholder for unrevealed community cards
 */
function EmptyCardSlot() {
  return (
    <div
      className="w-16 h-24 rounded-lg border-2 border-dashed border-gray-500/30 bg-gray-800/20"
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
 */
export function CommunityCards({ cards = [], phase = 'PREFLOP' }) {
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
  const actualCards = cards.length;

  // Check which cards are newly dealt (for animation)
  const isNewCard = (index) => {
    if (phase === 'FLOP' && index < 3) return true;
    if (phase === 'TURN' && index === 3) return true;
    if (phase === 'RIVER' && index === 4) return true;
    return false;
  };

  // If we're in preflop, show nothing
  if (phase === 'PREFLOP' || phase === 'BETTING_1') {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 p-4">
      {/* Board label */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-gray-400 text-sm font-medium uppercase tracking-wide">
        Community Cards
      </div>

      <div className="flex gap-2">
        {/* Flop cards (3) */}
        <div className="flex gap-2">
          <AnimatePresence>
            {[0, 1, 2].map((i) => (
              cards[i] ? (
                <CommunityCard
                  key={`community-${i}`}
                  card={cards[i]}
                  index={i}
                  isNew={isNewCard(i)}
                />
              ) : (
                <EmptyCardSlot key={`empty-${i}`} />
              )
            ))}
          </AnimatePresence>
        </div>

        {/* Divider before turn */}
        <div className="w-1" />

        {/* Turn card */}
        <AnimatePresence>
          {cards[3] ? (
            <CommunityCard
              key="community-3"
              card={cards[3]}
              index={3}
              isNew={isNewCard(3)}
            />
          ) : expectedCards >= 4 ? (
            <EmptyCardSlot key="empty-3" />
          ) : null}
        </AnimatePresence>

        {/* Divider before river */}
        <div className="w-1" />

        {/* River card */}
        <AnimatePresence>
          {cards[4] ? (
            <CommunityCard
              key="community-4"
              card={cards[4]}
              index={4}
              isNew={isNewCard(4)}
            />
          ) : expectedCards >= 5 ? (
            <EmptyCardSlot key="empty-4" />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default CommunityCards;
