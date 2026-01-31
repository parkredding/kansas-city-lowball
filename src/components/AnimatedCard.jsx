import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

/**
 * ============================================================================
 * FOUR-COLOR DECK STANDARD
 * Professional poker uses 4-color decks for instant suit recognition.
 *
 * Standard:
 * - Spades: Black (traditional)
 * - Hearts: Red (traditional)
 * - Diamonds: BLUE (distinguishes from hearts)
 * - Clubs: GREEN (distinguishes from spades)
 *
 * This prevents costly misreads at a glance, especially on mobile screens.
 * ============================================================================
 */
const SUIT_SYMBOLS = {
  // Hearts - Red (traditional)
  h: {
    symbol: '\u2665',
    color: 'text-red-600',
    bgClass: 'suit-hearts',
  },
  // Diamonds - BLUE (4-color standard)
  d: {
    symbol: '\u2666',
    color: 'text-blue-600',
    bgClass: 'suit-diamonds',
  },
  // Clubs - GREEN (4-color standard)
  c: {
    symbol: '\u2663',
    color: 'text-green-600',
    bgClass: 'suit-clubs',
  },
  // Spades - Black (traditional)
  s: {
    symbol: '\u2660',
    color: 'text-gray-900',
    bgClass: 'suit-spades',
  },
};

/**
 * Animation timing constants - "Goldilocks Zone"
 * Based on the Ergonomic Sovereignty report recommendations:
 * - Too fast (< 100ms): Feels cheap, hard to track
 * - Goldilocks (200-300ms): Professional, trustworthy
 * - Too slow (> 500ms): Frustrates experienced players
 */
const ANIMATION_TIMING = {
  CARD_DEAL: 250,      // Deal animation duration
  CARD_FLIP: 200,      // Flip reveal duration
  CARD_MUCK: 300,      // Discard to muck duration
  STAGGER_DELAY: 80,   // Delay between sequential card animations
  SPRING_STIFFNESS: 350,
  SPRING_DAMPING: 28,
};

/**
 * AnimatedCard component with deal and discard animations
 *
 * Props:
 * - card: { rank, suit } object
 * - isSelected: boolean for selection highlight
 * - isSelectable: boolean to enable click
 * - onClick: click handler
 * - faceDown: show card back
 * - animationState: 'dealing' | 'idle' | 'discarding' | 'replacing'
 * - delay: animation delay in seconds
 * - deckPosition: { x, y } position of deck for animation origin
 */
export function AnimatedCard({
  card,
  isSelected = false,
  isSelectable = false,
  onClick,
  faceDown = false,
  animationState = 'idle',
  delay = 0,
  index = 0,
}) {
  // Animation variants using Goldilocks timing
  const cardVariants = {
    // Initial position (off-screen, at deck)
    dealing: {
      x: 0,
      y: -100,
      opacity: 0,
      scale: 0.5,
      rotateY: 180,
    },
    // Normal position in hand
    idle: {
      x: 0,
      y: isSelected ? -12 : 0, // Larger lift for selected cards
      opacity: 1,
      scale: isSelected ? 1.05 : 1,
      rotateY: 0,
      transition: {
        type: 'spring',
        stiffness: ANIMATION_TIMING.SPRING_STIFFNESS,
        damping: ANIMATION_TIMING.SPRING_DAMPING,
        delay: delay,
      },
    },
    // Flying to muck (center) - uses Goldilocks timing
    discarding: {
      x: 0,
      y: -150,
      opacity: 0,
      scale: 0.3,
      rotateY: 180,
      transition: {
        duration: ANIMATION_TIMING.CARD_MUCK / 1000,
        ease: [0.4, 0, 1, 1], // easeIn for natural acceleration
      },
    },
    // New card coming in
    replacing: {
      x: 0,
      y: -100,
      opacity: 0,
      scale: 0.5,
    },
    // Hover effect (desktop only - touch has :active)
    hover: {
      y: isSelected ? -14 : -6,
      scale: 1.03,
      transition: {
        duration: 0.1,
        ease: 'easeOut',
      },
    },
  };

  // Safety check for invalid card data - show card back if card is invalid
  if (faceDown || !card || !card.suit || !card.rank) {
    return (
      <motion.div
        className="w-14 h-20 rounded-lg relative overflow-hidden"
        initial="dealing"
        animate="idle"
        variants={cardVariants}
        style={{
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f33 50%, #1e3a5f 100%)',
        }}
      >
        {/* Card border */}
        <div className="absolute inset-0.5 rounded-md border border-amber-600/30" />
        
        {/* Diamond pattern overlay */}
        <div 
          className="absolute inset-1 rounded opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(45deg, transparent 40%, rgba(212,175,55,0.15) 40%, rgba(212,175,55,0.15) 60%, transparent 60%),
              linear-gradient(-45deg, transparent 40%, rgba(212,175,55,0.15) 40%, rgba(212,175,55,0.15) 60%, transparent 60%)
            `,
            backgroundSize: '8px 8px',
          }}
        />
        
        {/* Center emblem */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-3/5 h-3/5 rounded-full border border-amber-500/40 flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
            }}
          >
            <span className="text-amber-500/50 text-xs">♠</span>
          </div>
        </div>
        
        {/* Glossy highlight */}
        <div 
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
          }}
        />
      </motion.div>
    );
  }

  const suit = SUIT_SYMBOLS[card.suit] || SUIT_SYMBOLS.s;

  return (
    <motion.button
      onClick={onClick}
      disabled={!isSelectable}
      className={`
        w-14 h-20 rounded-lg flex flex-col items-center justify-center relative overflow-hidden
        ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-green-800' : ''}
        ${isSelectable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
      `}
      initial="dealing"
      animate="idle"
      exit="discarding"
      whileHover={isSelectable ? 'hover' : undefined}
      variants={cardVariants}
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)',
        boxShadow: isSelected
          ? '0 8px 20px rgba(217,164,6,0.4), 0 4px 8px rgba(0,0,0,0.25)'
          : '0 3px 10px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
      }}
    >
      <span className={`text-xl font-bold ${suit.color} leading-none`}>
        {card?.rank || '?'}
      </span>
      <span className={`text-2xl ${suit.color} leading-none -mt-0.5`}>
        {suit.symbol}
      </span>
      
      {/* Subtle inner border */}
      <div className="absolute inset-0.5 rounded-md border border-gray-200/50 pointer-events-none" />
    </motion.button>
  );
}

/**
 * AnimatedCardBack for opponent cards - Professional casino design
 */
export function AnimatedCardBack({ delay = 0, small = false }) {
  const sizeClasses = small ? 'w-10 h-14' : 'w-14 h-20';

  return (
    <motion.div
      className={`${sizeClasses} rounded-lg relative overflow-hidden`}
      initial={{ y: -80, opacity: 0, scale: 0.6 }}
      animate={{
        y: 0,
        opacity: 1,
        scale: 1,
        transition: {
          type: 'spring',
          stiffness: ANIMATION_TIMING.SPRING_STIFFNESS,
          damping: ANIMATION_TIMING.SPRING_DAMPING,
          delay: delay,
        },
      }}
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f33 50%, #1e3a5f 100%)',
      }}
    >
      {/* Card border */}
      <div className="absolute inset-0.5 rounded-md border border-amber-600/30" />
      
      {/* Diamond pattern overlay */}
      <div 
        className="absolute inset-1 rounded opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(45deg, transparent 40%, rgba(212,175,55,0.15) 40%, rgba(212,175,55,0.15) 60%, transparent 60%),
            linear-gradient(-45deg, transparent 40%, rgba(212,175,55,0.15) 40%, rgba(212,175,55,0.15) 60%, transparent 60%)
          `,
          backgroundSize: '6px 6px',
        }}
      />
      
      {/* Center emblem */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="w-1/2 h-1/2 rounded-full border border-amber-500/30 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)',
          }}
        >
          <span className="text-amber-500/40 text-[10px]">♠</span>
        </div>
      </div>
      
      {/* Glossy highlight */}
      <div 
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
        }}
      />
    </motion.div>
  );
}

/**
 * AnimatedHand component - renders a hand of cards with stagger animation
 */
export function AnimatedHand({
  cards,
  selectedIndices = new Set(),
  onCardClick,
  isSelectable = false,
  showCards = true,
  isDealing = false,
}) {
  // Safety check for invalid cards array
  if (!cards || !Array.isArray(cards)) {
    return null;
  }

  return (
    <div className="flex gap-3 justify-center">
      <AnimatePresence mode="popLayout">
        {cards.map((card, index) => (
          <AnimatedCard
            key={`${card?.rank || 'unknown'}-${card?.suit || 'unknown'}-${index}`}
            card={card}
            isSelected={selectedIndices.has(index)}
            isSelectable={isSelectable}
            onClick={() => onCardClick?.(index)}
            faceDown={!showCards}
            delay={isDealing ? index * (ANIMATION_TIMING.STAGGER_DELAY / 1000) : 0}
            index={index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Muck (Discard Pile) Component - Visual representation of the muck at table center
 */
export function MuckPile({ cardCount = 0, isReceiving = false }) {
  if (cardCount <= 0 && !isReceiving) return null;

  return (
    <motion.div
      className="relative w-16 h-20"
      animate={isReceiving ? {
        scale: [1, 1.1, 1],
      } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Stack of card backs representing the muck */}
      {Array.from({ length: Math.min(cardCount, 5) }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-12 h-16 rounded-lg"
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f33 50%, #1e3a5f 100%)',
            top: `${i * -2}px`,
            left: `${i * 1}px`,
            transform: `rotate(${(i - 2) * 8}deg)`,
            zIndex: i,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
        >
          <div className="absolute inset-0.5 rounded-md border border-amber-600/20" />
        </motion.div>
      ))}
      {/* Muck label */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-400 whitespace-nowrap">
        Muck
      </div>
    </motion.div>
  );
}

/**
 * Balatro-Style Discard Animation Overlay
 *
 * Creates smooth "whoosh" animations for cards flying to the muck:
 * - Hero cards: Visually detach and fly rapidly to center
 * - Opponent cards: Card backs spawn at seat and whoosh to muck
 * - High z-index ensures cards fly OVER everything
 * - NO shaking - clean, direct trajectory
 */
export function DiscardAnimationOverlay({
  discardingCards = [],
  muckPosition = { x: 50, y: 50 },
  onAnimationComplete,
}) {
  if (discardingCards.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <AnimatePresence onExitComplete={onAnimationComplete}>
        {discardingCards.map((discardInfo, index) => (
          <DiscardingCard
            key={discardInfo.id || index}
            card={discardInfo.card}
            startPosition={discardInfo.startPosition}
            endPosition={muckPosition}
            delay={index * 0.05}
            isHero={discardInfo.isHero}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Individual discarding card with Balatro-style whoosh animation
 */
function DiscardingCard({
  card,
  startPosition = { x: 50, y: 80 },
  endPosition = { x: 50, y: 50 },
  delay = 0,
  isHero = false,
}) {
  const suit = card ? SUIT_SYMBOLS[card.suit] : null;

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${startPosition.x}%`,
        top: `${startPosition.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
      }}
      initial={{
        scale: 1,
        opacity: 1,
        rotate: 0,
      }}
      animate={{
        left: `${endPosition.x}%`,
        top: `${endPosition.y}%`,
        scale: 0.4,
        opacity: 0,
        rotate: isHero ? 0 : (Math.random() - 0.5) * 30,
      }}
      exit={{
        opacity: 0,
        scale: 0,
      }}
      transition={{
        duration: ANIMATION_TIMING.CARD_MUCK / 1000,
        delay: delay,
        ease: [0.4, 0, 1, 1], // easeIn for natural acceleration
      }}
    >
      {/* Render card face for hero, card back for opponents */}
      {isHero && card && suit ? (
        <div
          className="w-14 h-20 rounded-lg flex flex-col items-center justify-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <span className={`text-xl font-bold ${suit.color} leading-none`}>
            {card.rank}
          </span>
          <span className={`text-2xl ${suit.color} leading-none -mt-0.5`}>
            {suit.symbol}
          </span>
        </div>
      ) : (
        <div
          className="w-14 h-20 rounded-lg relative overflow-hidden"
          style={{
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f33 50%, #1e3a5f 100%)',
          }}
        >
          <div className="absolute inset-0.5 rounded-md border border-amber-600/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-3/5 h-3/5 rounded-full border border-amber-500/40 flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
              }}
            >
              <span className="text-amber-500/50 text-xs font-serif">♠</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Hook to manage discard animation state
 */
export function useDiscardAnimation() {
  const [discardingCards, setDiscardingCards] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const triggerDiscard = (cards, isHero = false, startPosition = { x: 50, y: 80 }) => {
    const newCards = cards.map((card, index) => ({
      id: `${Date.now()}-${index}`,
      card: card,
      startPosition: startPosition,
      isHero: isHero,
    }));

    setDiscardingCards(newCards);
    setIsAnimating(true);
  };

  const onComplete = () => {
    setDiscardingCards([]);
    setIsAnimating(false);
  };

  return {
    discardingCards,
    isAnimating,
    triggerDiscard,
    onComplete,
  };
}

/**
 * Opponent Discard Animation - spawns card backs that whoosh to muck
 */
export function OpponentDiscardAnimation({
  playerId,
  cardCount = 0,
  playerPosition = { x: 50, y: 20 },
  muckPosition = { x: 50, y: 50 },
  isActive = false,
  onComplete,
}) {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (isActive && cardCount > 0) {
      // Create card animations
      const newCards = Array.from({ length: cardCount }).map((_, i) => ({
        id: `${playerId}-${Date.now()}-${i}`,
        index: i,
      }));
      setCards(newCards);

      // Clear after animation
      const timer = setTimeout(() => {
        setCards([]);
        onComplete?.();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isActive, cardCount, playerId, onComplete]);

  if (cards.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {cards.map((card, index) => (
        <motion.div
          key={card.id}
          className="absolute"
          style={{
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{
            scale: 0.8,
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            left: `${muckPosition.x}%`,
            top: `${muckPosition.y}%`,
            scale: 0.3,
            opacity: 0,
            rotate: (index - cardCount / 2) * 15,
          }}
          transition={{
            duration: 0.3,
            delay: index * 0.06,
            ease: [0.4, 0, 1, 1],
          }}
        >
          {/* Card back */}
          <div
            className="w-10 h-14 rounded-lg"
            style={{
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f33 50%, #1e3a5f 100%)',
            }}
          >
            <div className="absolute inset-0.5 rounded-md border border-amber-600/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-amber-500/50 text-[10px]">♠</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default AnimatedCard;
