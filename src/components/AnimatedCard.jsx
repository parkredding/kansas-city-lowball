import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const SUIT_SYMBOLS = {
  h: { symbol: '\u2665', color: 'text-red-500' },
  d: { symbol: '\u2666', color: 'text-red-500' },
  c: { symbol: '\u2663', color: 'text-gray-900' },
  s: { symbol: '\u2660', color: 'text-gray-900' },
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
  // Animation variants for different states
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
      y: isSelected ? -8 : 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: delay,
      },
    },
    // Flying to muck (center)
    discarding: {
      x: 0,
      y: -150,
      opacity: 0,
      scale: 0.3,
      rotateY: 180,
      transition: {
        duration: 0.4,
        ease: 'easeIn',
      },
    },
    // New card coming in
    replacing: {
      x: 0,
      y: -100,
      opacity: 0,
      scale: 0.5,
    },
    // Hover effect
    hover: {
      y: isSelected ? -10 : -4,
      scale: 1.02,
      transition: {
        duration: 0.15,
      },
    },
  };

  if (faceDown) {
    return (
      <motion.div
        className="bg-blue-800 rounded-lg shadow-lg w-16 h-24 flex flex-col items-center justify-center border-2 border-blue-900"
        initial="dealing"
        animate="idle"
        variants={cardVariants}
        style={{
          boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)',
        }}
      >
        <div className="w-12 h-18 bg-blue-700 rounded border border-blue-600 flex items-center justify-center">
          <div className="w-8 h-12 rounded bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-500" />
        </div>
      </motion.div>
    );
  }

  const suit = SUIT_SYMBOLS[card?.suit] || SUIT_SYMBOLS.s;

  return (
    <motion.button
      onClick={onClick}
      disabled={!isSelectable}
      className={`
        bg-white rounded-lg shadow-lg w-16 h-24 flex flex-col items-center justify-center border-2
        transition-colors duration-150
        ${isSelected
          ? 'border-yellow-400 ring-2 ring-yellow-400 ring-opacity-50'
          : 'border-gray-300'
        }
        ${isSelectable
          ? 'cursor-pointer hover:border-yellow-300'
          : 'cursor-default'
        }
      `}
      initial="dealing"
      animate="idle"
      exit="discarding"
      whileHover={isSelectable ? 'hover' : undefined}
      variants={cardVariants}
      style={{
        boxShadow: isSelected
          ? '0 8px 20px rgba(234,179,8,0.4), 0 4px 8px rgba(0,0,0,0.2)'
          : '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <span className={`text-xl font-bold ${suit.color}`}>
        {card?.rank || '?'}
      </span>
      <span className={`text-2xl ${suit.color}`}>
        {suit.symbol}
      </span>
    </motion.button>
  );
}

/**
 * AnimatedCardBack for opponent cards
 */
export function AnimatedCardBack({ delay = 0, small = false }) {
  const sizeClasses = small ? 'w-12 h-16' : 'w-16 h-24';
  const innerSizeClasses = small ? 'w-8 h-10' : 'w-12 h-18';

  return (
    <motion.div
      className={`bg-blue-800 rounded-lg shadow-lg ${sizeClasses} flex flex-col items-center justify-center border-2 border-blue-900`}
      initial={{ y: -100, opacity: 0, scale: 0.5 }}
      animate={{
        y: 0,
        opacity: 1,
        scale: 1,
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 25,
          delay: delay,
        },
      }}
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)',
      }}
    >
      <div className={`${innerSizeClasses} bg-blue-700 rounded border border-blue-600 flex items-center justify-center`}>
        <div className="w-6 h-8 rounded bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-500" />
      </div>
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
  return (
    <div className="flex gap-3 justify-center">
      <AnimatePresence mode="popLayout">
        {cards.map((card, index) => (
          <AnimatedCard
            key={`${card.rank}-${card.suit}-${index}`}
            card={card}
            isSelected={selectedIndices.has(index)}
            isSelectable={isSelectable}
            onClick={() => onCardClick?.(index)}
            faceDown={!showCards}
            delay={isDealing ? index * 0.1 : 0}
            index={index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Muck animation overlay - shows cards flying to center
 */
export function MuckAnimation({ isActive, cardCount = 0 }) {
  if (!isActive || cardCount === 0) return null;

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {Array.from({ length: cardCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-16 h-24 bg-blue-800 rounded-lg border-2 border-blue-900"
          initial={{ scale: 1, opacity: 1 }}
          animate={{
            scale: 0,
            opacity: 0,
            rotate: 360,
          }}
          transition={{
            duration: 0.4,
            delay: i * 0.05,
            ease: 'easeIn',
          }}
        />
      ))}
    </motion.div>
  );
}

export default AnimatedCard;
