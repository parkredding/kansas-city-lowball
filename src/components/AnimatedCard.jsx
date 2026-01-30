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

  const suit = SUIT_SYMBOLS[card?.suit] || SUIT_SYMBOLS.s;

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
          stiffness: 350,
          damping: 28,
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
