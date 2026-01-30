import { useMemo } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import PokerChip, { CHIP_DENOMINATIONS } from './PokerChip';

/**
 * Chip size configurations for overlap calculations
 */
export const CHIP_SIZES = {
  xs: { size: 28, overlap: -6 },
  sm: { size: 36, overlap: -8 },
  md: { size: 48, overlap: -10 },
  lg: { size: 64, overlap: -12 },
};

/**
 * Calculate overlap margin for stacked chips based on size
 */
export function getOverlapMargin(size) {
  const config = CHIP_SIZES[size] || CHIP_SIZES.md;
  return `${config.overlap}px`;
}

/**
 * Calculate chip breakdown by denomination for a given amount
 * Returns array of { denomination, count } in descending order
 */
export function calculateChipBreakdown(amount) {
  const denominations = [1000, 500, 100, 25, 5, 1];
  const result = [];
  let remaining = amount;

  for (const denom of denominations) {
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom);
      result.push({ denomination: denom, count });
      remaining = remaining % denom;
    }
  }

  return result;
}

/**
 * Generate deterministic rotation for chips based on index and denomination
 */
export function getDeterministicRotation(index, denomination, seed = 0, range = 5) {
  const hash = (index * 17 + denomination * 13 + seed * 7) % 100;
  return (hash / 100) * range * 2 - range;
}

/**
 * 3D Chip component with realistic stacking effect using CSS box-shadow
 */
function Chip3D({ color, size = 'md', stackPosition = 0 }) {
  const sizeConfig = {
    sm: { width: 'w-5', height: 'h-2', edge: 2 },
    md: { width: 'w-7', height: 'h-2.5', edge: 3 },
    lg: { width: 'w-9', height: 'h-3', edge: 4 },
  };

  const colorConfig = {
    red: {
      bg: '#dc2626',
      edge: '#991b1b',
      highlight: 'rgba(255,255,255,0.3)',
      stripe: 'rgba(255,255,255,0.15)',
    },
    blue: {
      bg: '#2563eb',
      edge: '#1d4ed8',
      highlight: 'rgba(255,255,255,0.3)',
      stripe: 'rgba(255,255,255,0.15)',
    },
    green: {
      bg: '#16a34a',
      edge: '#15803d',
      highlight: 'rgba(255,255,255,0.3)',
      stripe: 'rgba(255,255,255,0.15)',
    },
    black: {
      bg: '#1f2937',
      edge: '#111827',
      highlight: 'rgba(255,255,255,0.2)',
      stripe: 'rgba(255,255,255,0.1)',
    },
    gold: {
      bg: '#eab308',
      edge: '#ca8a04',
      highlight: 'rgba(255,255,255,0.4)',
      stripe: 'rgba(255,255,255,0.2)',
    },
    purple: {
      bg: '#9333ea',
      edge: '#7e22ce',
      highlight: 'rgba(255,255,255,0.3)',
      stripe: 'rgba(255,255,255,0.15)',
    },
    white: {
      bg: '#f8fafc',
      edge: '#cbd5e1',
      highlight: 'rgba(255,255,255,0.8)',
      stripe: 'rgba(0,0,0,0.05)',
    },
  };

  const config = sizeConfig[size];
  const colors = colorConfig[color] || colorConfig.red;

  // Create stacked 3D effect using multiple box-shadows
  const stackedShadow = Array.from({ length: config.edge }, (_, i) => {
    const offset = (i + 1);
    return `0 ${offset}px 0 ${colors.edge}`;
  }).join(', ');

  return (
    <div
      className={`${config.width} ${config.height} rounded-full relative`}
      style={{
        backgroundColor: colors.bg,
        boxShadow: `
          ${stackedShadow},
          0 ${config.edge + 2}px 6px rgba(0,0,0,0.3),
          inset 0 1px 2px ${colors.highlight},
          inset 0 -1px 2px rgba(0,0,0,0.2)
        `,
        marginTop: stackPosition > 0 ? `-${config.edge + 1}px` : '0',
      }}
    >
      {/* Chip stripe pattern */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: `repeating-linear-gradient(
            90deg,
            transparent 0px,
            transparent 2px,
            ${colors.stripe} 2px,
            ${colors.stripe} 4px
          )`,
        }}
      />
    </div>
  );
}

/**
 * Enhanced Visual chip stack component with 3D effect
 * - amount < 100: Small stack of Red chips
 * - amount >= 100 && < 1000: Mixed stack
 * - amount >= 1000: High Value Gold/Black stack
 */
function ChipStack({ amount, size = 'md', showAmount = true, animate = false }) {
  // Determine chip configuration based on amount
  const chipConfig = useMemo(() => {
    if (amount <= 0) return { chips: [], type: 'none' };

    // Low value: Red chips
    if (amount < 100) {
      const chipCount = Math.min(5, Math.max(1, Math.ceil(amount / 20)));
      return {
        chips: Array(chipCount).fill('red'),
        type: 'low',
      };
    }

    // High value: Gold and Black chips
    if (amount >= 1000) {
      const goldCount = Math.min(3, Math.floor(amount / 1000));
      const blackCount = Math.min(4, Math.ceil((amount % 1000) / 250));
      return {
        chips: [
          ...Array(goldCount).fill('gold'),
          ...Array(Math.max(1, blackCount)).fill('black'),
        ].slice(0, 7),
        type: 'high',
      };
    }

    // Medium value: Mixed stack
    const denominations = [
      { value: 500, color: 'purple' },
      { value: 100, color: 'black' },
      { value: 50, color: 'green' },
      { value: 25, color: 'blue' },
      { value: 10, color: 'red' },
      { value: 5, color: 'white' },
    ];

    let remaining = amount;
    const chips = [];

    for (const denom of denominations) {
      const count = Math.floor(remaining / denom.value);
      if (count > 0) {
        const visualCount = Math.min(count, 3);
        for (let i = 0; i < visualCount; i++) {
          chips.push(denom.color);
        }
        remaining = remaining % denom.value;
      }
      if (chips.length >= 8) break;
    }

    return { chips, type: 'medium' };
  }, [amount]);

  if (amount <= 0) {
    return null;
  }

  const stackVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.1,
      },
    },
  };

  const chipVariants = {
    hidden: { opacity: 0, y: -20, scale: 0.8 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 25,
      },
    },
  };

  return (
    <div className={`flex flex-col items-center ${animate ? 'animate-pulse' : ''}`}>
      {/* 3D Chip stack visualization */}
      <div className="flex flex-col-reverse items-center relative">
        {chipConfig.chips.map((color, index) => (
          <Chip3D
            key={index}
            color={color}
            size={size}
            stackPosition={index}
          />
        ))}
      </div>
      {showAmount && (
        <div
          className={`
            font-bold text-white mt-2 px-2 py-0.5 rounded
            ${size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[10px]'}
            ${chipConfig.type === 'high' ? 'bg-yellow-600/90' : 'bg-gray-800/90'}
          `}
          style={{
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          ${amount.toLocaleString()}
        </div>
      )}
    </div>
  );
}

/**
 * Bet chip display for current round bets near player seats
 */
export function BetChip({ amount, playerId, animate = true }) {
  if (amount <= 0) return null;

  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Show at most 3 chips for bet display
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, 3 - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          id: `bet-${denomination}-${count}`,
          denomination,
          // Deterministic rotation
          rotation: getDeterministicRotation(count, denomination, 4),
        });
        count++;
      }
      if (count >= 3) break;
    }
    return result;
  }, [breakdown]);

  // Calculate overlap margin dynamically for xs chips
  const overlapMargin = getOverlapMargin('xs');

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={animate ? { scale: 0, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <div className="flex flex-col-reverse items-center">
        {chips.map((chip, index) => (
          <motion.div
            key={chip.id}
            layoutId={playerId ? `${playerId}-${chip.id}` : undefined}
            style={{
              marginTop: index > 0 ? overlapMargin : 0,
              zIndex: index,
            }}
            initial={animate ? { y: -30, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: index * 0.05,
            }}
          >
            <PokerChip
              denomination={chip.denomination}
              size="xs"
              rotation={chip.rotation}
            />
          </motion.div>
        ))}
      </div>
      <motion.span
        className="text-xs font-bold text-yellow-300 mt-1 bg-black/50 px-2 py-0.5 rounded"
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        ${amount.toLocaleString()}
      </motion.span>
    </motion.div>
  );
}

/**
 * Mini chip stack for compact displays (player info, etc.)
 */
export function MiniChipStack({ amount, showAmount = false }) {
  return <ChipStack amount={amount} size="sm" showAmount={showAmount} />;
}

/**
 * Pot display with large animated chips
 */
export function PotDisplay({ amount, animate = true, isWinning = false }) {
  if (amount <= 0) return null;

  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Show more chips for pot display (up to 12)
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, 12 - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          id: `pot-${denomination}-${count}`,
          denomination,
          // Deterministic rotation
          rotation: getDeterministicRotation(count, denomination, 3),
        });
        count++;
      }
      if (count >= 12) break;
    }
    return result;
  }, [breakdown]);

  // Split into 2 stacks if more than 6 chips
  const stack1 = chips.slice(0, 6);
  const stack2 = chips.slice(6);

  // Calculate overlap margin dynamically for sm chips
  const overlapMargin = getOverlapMargin('sm');

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={isWinning ? {
        scale: [1, 1.1, 0.5],
        opacity: [1, 1, 0],
        y: [0, -10, 50],
      } : { scale: 1, opacity: 1 }}
      transition={isWinning ? {
        duration: 0.8,
        times: [0, 0.3, 1],
      } : {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
    >
      <div className="flex items-end gap-2">
        {/* First stack */}
        <div className="flex flex-col-reverse items-center">
          {stack1.map((chip, index) => (
            <motion.div
              key={chip.id}
              layoutId={chip.id}
              style={{
                marginTop: index > 0 ? overlapMargin : 0,
                zIndex: index,
              }}
              initial={animate ? { y: -20, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 25,
                delay: index * 0.03,
              }}
            >
              <PokerChip
                denomination={chip.denomination}
                size="sm"
                rotation={chip.rotation}
              />
            </motion.div>
          ))}
        </div>

        {/* Second stack if needed */}
        {stack2.length > 0 && (
          <div className="flex flex-col-reverse items-center">
            {stack2.map((chip, index) => (
              <motion.div
                key={chip.id}
                layoutId={chip.id}
                style={{
                  marginTop: index > 0 ? overlapMargin : 0,
                  zIndex: index,
                }}
                initial={animate ? { y: -20, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                  delay: 0.1 + index * 0.03,
                }}
              >
                <PokerChip
                  denomination={chip.denomination}
                  size="sm"
                  rotation={chip.rotation}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pot amount label */}
      <motion.div
        className="bg-yellow-600/95 px-4 py-2 rounded-lg mt-2 shadow-xl border border-yellow-500"
        initial={animate ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-white font-bold text-lg drop-shadow-md">
          ${amount.toLocaleString()}
        </span>
      </motion.div>
    </motion.div>
  );
}

export default ChipStack;
