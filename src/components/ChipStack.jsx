import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import PokerChip, { CHIP_DENOMINATIONS } from './PokerChip';

/**
 * Configuration for chip stacking behavior
 */
const STACK_CONFIG = {
  maxChipsPerStack: 10,      // Split into new column after this many
  maxStacks: 5,             // Maximum number of columns
  overlapPercent: 0.82,     // How much chips overlap (negative margin %)
  rotationRange: 5,         // Random rotation range in degrees (-5 to +5)
};

/**
 * Size configurations for different stack sizes
 */
const SIZE_CONFIGS = {
  xs: { chipSize: 'xs', gap: 2, stackGap: 4 },
  sm: { chipSize: 'sm', gap: 3, stackGap: 6 },
  md: { chipSize: 'md', gap: 4, stackGap: 8 },
  lg: { chipSize: 'lg', gap: 5, stackGap: 12 },
};

/**
 * Greedy algorithm to break down an amount into optimal chip denominations
 * Returns array of chip objects with denomination and count
 */
export function calculateChipBreakdown(amount) {
  if (amount <= 0) return [];

  // Sorted from highest to lowest
  const denominations = [1000, 500, 100, 25, 5, 1];
  const breakdown = [];
  let remaining = Math.floor(amount);

  for (const denom of denominations) {
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom);
      breakdown.push({ denomination: denom, count });
      remaining = remaining % denom;
    }
  }

  return breakdown;
}

/**
 * Convert breakdown into individual chip objects with unique IDs and rotations
 * Limit total chips and organize into stacks
 */
function createChipObjects(breakdown, maxTotal = 50) {
  const chips = [];
  let totalCount = 0;

  for (const { denomination, count } of breakdown) {
    const chipsToAdd = Math.min(count, maxTotal - totalCount);

    for (let i = 0; i < chipsToAdd; i++) {
      // Generate consistent but varied rotation based on index
      const rotation = (Math.random() - 0.5) * 2 * STACK_CONFIG.rotationRange;
      chips.push({
        id: `chip-${denomination}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        denomination,
        rotation,
        stackIndex: Math.floor(chips.length / STACK_CONFIG.maxChipsPerStack),
      });
      totalCount++;
      if (totalCount >= maxTotal) break;
    }
    if (totalCount >= maxTotal) break;
  }

  return chips;
}

/**
 * Organize chips into stack columns
 */
function organizeIntoStacks(chips) {
  const stacks = [];
  const maxStacks = STACK_CONFIG.maxStacks;

  for (const chip of chips) {
    const stackIndex = Math.min(chip.stackIndex, maxStacks - 1);
    if (!stacks[stackIndex]) {
      stacks[stackIndex] = [];
    }
    stacks[stackIndex].push(chip);
  }

  return stacks;
}

/**
 * Main ChipStack component with physics-based animations
 */
function ChipStack({
  amount,
  size = 'md',
  showAmount = true,
  animate = true,
  layoutId,
  playerId,
  compact = false,
  onAnimationComplete,
}) {
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  // Memoize breakdown calculation
  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Memoize chip objects - limit more for compact mode
  const maxChips = compact ? 15 : 50;
  const chips = useMemo(
    () => createChipObjects(breakdown, maxChips),
    [breakdown, maxChips]
  );

  // Organize into stacks
  const stacks = useMemo(() => organizeIntoStacks(chips), [chips]);

  // Calculate overlap margin
  const chipSizes = { xs: 28, sm: 36, md: 48, lg: 64 };
  const chipHeight = chipSizes[sizeConfig.chipSize] || 48;
  const overlapMargin = -Math.floor(chipHeight * STACK_CONFIG.overlapPercent);

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
    <LayoutGroup id={layoutId || playerId}>
      <motion.div
        className="flex flex-col items-center"
        initial={animate ? 'hidden' : false}
        animate="visible"
        variants={stackVariants}
        onAnimationComplete={onAnimationComplete}
      >
        {/* Chip stacks container */}
        <div
          className="flex items-end justify-center"
          style={{ gap: sizeConfig.stackGap }}
        >
          {stacks.map((stack, stackIndex) => (
            <div
              key={`stack-${stackIndex}`}
              className="flex flex-col-reverse items-center"
            >
              {stack.map((chip, chipIndex) => (
                <motion.div
                  key={chip.id}
                  layoutId={playerId ? `${playerId}-${chip.id}` : undefined}
                  variants={animate ? chipVariants : undefined}
                  style={{
                    marginTop: chipIndex > 0 ? overlapMargin : 0,
                    zIndex: chipIndex,
                  }}
                >
                  <PokerChip
                    denomination={chip.denomination}
                    size={sizeConfig.chipSize}
                    rotation={chip.rotation}
                  />
                </motion.div>
              ))}
            </div>
          ))}
        </div>

        {/* Amount label */}
        {showAmount && (
          <motion.div
            initial={animate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-2 bg-gray-900/90 px-3 py-1 rounded-lg shadow-lg border border-gray-700"
          >
            <span className="text-white font-bold text-sm">
              ${amount.toLocaleString()}
            </span>
          </motion.div>
        )}
      </motion.div>
    </LayoutGroup>
  );
}

/**
 * Mini chip stack for player seats - more compact
 */
export function MiniChipStack({ amount, showAmount = false }) {
  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Show at most 5 chips for mini display
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, 5 - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          denomination,
          rotation: (Math.random() - 0.5) * 6,
        });
        count++;
      }
      if (count >= 5) break;
    }
    return result;
  }, [breakdown]);

  if (amount <= 0) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col-reverse items-center">
        {chips.map((chip, index) => (
          <div
            key={index}
            style={{
              marginTop: index > 0 ? -22 : 0,
              zIndex: index,
            }}
          >
            <PokerChip
              denomination={chip.denomination}
              size="xs"
              rotation={chip.rotation}
            />
          </div>
        ))}
      </div>
      {showAmount && (
        <span className="text-xs font-bold text-white mt-1 bg-gray-800/80 px-1.5 rounded">
          ${amount.toLocaleString()}
        </span>
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
          denomination,
          rotation: (Math.random() - 0.5) * 8,
          id: `bet-${denomination}-${i}`,
        });
        count++;
      }
      if (count >= 3) break;
    }
    return result;
  }, [breakdown]);

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
            layoutId={playerId ? `${playerId}-bet-${chip.id}` : undefined}
            style={{
              marginTop: index > 0 ? -18 : 0,
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
 * Pot display with large animated chips
 */
export function PotDisplay({ amount, animate = true, isWinning = false, winnerId }) {
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
          denomination,
          rotation: (Math.random() - 0.5) * 6,
          id: `pot-${denomination}-${i}`,
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
              layoutId={`pot-${chip.id}`}
              style={{
                marginTop: index > 0 ? -32 : 0,
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
                layoutId={`pot-${chip.id}`}
                style={{
                  marginTop: index > 0 ? -32 : 0,
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
