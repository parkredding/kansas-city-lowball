import { useMemo, useCallback } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import PokerChip, { CHIP_DENOMINATIONS } from './PokerChip';

/**
 * Chip color class mapping for CSS tower styling
 */
const CHIP_COLOR_CLASSES = {
  1: 'chip-white',
  5: 'chip-red',
  25: 'chip-green',
  100: 'chip-black',
  500: 'chip-purple',
  1000: 'chip-gold',
};

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
 * Enhanced Visual chip stack component using PokerChip
 * Uses denomination-based chips for consistent styling across mobile/desktop
 */
function ChipStack({ amount, size = 'md', showAmount = true, animate = false }) {
  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Convert size to PokerChip size (lg→md, md→sm, sm→xs)
  const chipSize = size === 'lg' ? 'md' : size === 'md' ? 'sm' : 'xs';

  // Create chip objects with denominations (max 8 chips)
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    const maxChips = 8;

    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, maxChips - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          denomination,
          rotation: getDeterministicRotation(count, denomination, 0),
          id: `stack-${denomination}-${count}`,
        });
        count++;
      }
      if (count >= maxChips) break;
    }
    return result;
  }, [breakdown]);

  if (amount <= 0) {
    return null;
  }

  // Split into 2 stacks if more than 5 chips
  const stack1 = chips.slice(0, 5);
  const stack2 = chips.slice(5);

  // Calculate overlap margin dynamically
  const overlapMargin = getOverlapMargin(chipSize);

  // Determine label background color based on amount
  const isHighValue = amount >= 1000;

  return (
    <div className={`flex flex-col items-center ${animate ? 'animate-pulse' : ''}`}>
      <div className="flex items-end gap-1">
        {/* First stack */}
        <div className="flex flex-col-reverse items-center">
          {stack1.map((chip, index) => (
            <motion.div
              key={chip.id}
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
                size={chipSize}
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
                  size={chipSize}
                  rotation={chip.rotation}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {showAmount && (
        <div
          className={`
            font-bold text-white mt-2 px-2 py-0.5 rounded
            ${size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[10px]'}
            ${isHighValue ? 'bg-yellow-600/90' : 'bg-gray-800/90'}
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

/**
 * REALISTIC CHIP TOWER COMPONENT
 *
 * Renders a 3D-style vertical tower of chips with:
 * 1. Denomination-based chip breakdown
 * 2. True vertical stacking with absolute positioning
 * 3. 3D depth effect via box-shadows
 * 4. Organic "jitter" for natural look
 * 5. Multiple tower support for large pots
 *
 * @param {number} amount - Total chip value to display
 * @param {string} size - Chip size: 'xs', 'sm', 'md', 'lg'
 * @param {boolean} showAmount - Whether to show the amount label
 * @param {boolean} animate - Enable entrance animations
 * @param {number} maxChipsPerTower - Max chips before splitting into new tower
 * @param {number} maxTowers - Maximum number of towers
 */
export function ChipTower({
  amount,
  size = 'sm',
  showAmount = true,
  animate = true,
  maxChipsPerTower = 8,
  maxTowers = 3,
}) {
  // Calculate chip breakdown by denomination
  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Generate deterministic jitter for organic look
  const getJitter = useCallback((index, seed = 0) => {
    // Deterministic "random" based on index and seed
    const hash = (index * 17 + seed * 31) % 100;
    const jitterX = ((hash % 5) - 2); // -2 to +2 pixels
    const rotation = ((hash % 7) - 3) * 0.5; // -1.5 to +1.5 degrees
    return { x: jitterX, rotation };
  }, []);

  // Build chip array from breakdown (limited by maxChips total)
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    const maxChips = maxChipsPerTower * maxTowers;

    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, maxChips - count);
      for (let i = 0; i < toAdd; i++) {
        const jitter = getJitter(count, denomination);
        result.push({
          id: `tower-${denomination}-${count}`,
          denomination,
          colorClass: CHIP_COLOR_CLASSES[denomination] || 'chip-black',
          jitter,
        });
        count++;
      }
      if (count >= maxChips) break;
    }
    return result;
  }, [breakdown, maxChipsPerTower, maxTowers, getJitter]);

  // Split chips into multiple towers
  const towers = useMemo(() => {
    const result = [];
    for (let i = 0; i < chips.length; i += maxChipsPerTower) {
      result.push(chips.slice(i, i + maxChipsPerTower));
    }
    return result;
  }, [chips, maxChipsPerTower]);

  // Size configuration for chip dimensions and vertical offset
  const sizeConfig = {
    xs: { chipSize: 28, verticalOffset: 3 },
    sm: { chipSize: 36, verticalOffset: 4 },
    md: { chipSize: 48, verticalOffset: 5 },
    lg: { chipSize: 64, verticalOffset: 6 },
  }[size] || { chipSize: 36, verticalOffset: 4 };

  if (amount <= 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Tower container - holds multiple towers side by side */}
      <div className="chip-tower-container">
        {towers.map((towerChips, towerIndex) => (
          <div
            key={`tower-${towerIndex}`}
            className="chip-tower"
            style={{
              position: 'relative',
              height: (towerChips.length - 1) * sizeConfig.verticalOffset + sizeConfig.chipSize,
              width: sizeConfig.chipSize + 4, // Extra width for jitter
            }}
          >
            {towerChips.map((chip, chipIndex) => {
              const bottomOffset = chipIndex * sizeConfig.verticalOffset;

              return (
                <motion.div
                  key={chip.id}
                  className={`chip-tower-chip chip-${size} ${chip.colorClass}`}
                  style={{
                    position: 'absolute',
                    bottom: bottomOffset,
                    left: '50%',
                    width: sizeConfig.chipSize,
                    height: sizeConfig.chipSize,
                    marginLeft: -sizeConfig.chipSize / 2 + chip.jitter.x,
                    zIndex: chipIndex,
                    transform: `rotate(${chip.jitter.rotation}deg)`,
                  }}
                  initial={animate ? {
                    y: -30,
                    opacity: 0,
                    scale: 0.8,
                  } : false}
                  animate={{
                    y: 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 25,
                    delay: (towerIndex * maxChipsPerTower + chipIndex) * 0.03,
                  }}
                >
                  {/* Chip inner styling with dashed border for edge spots */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      right: 3,
                      bottom: 3,
                      borderRadius: '50%',
                      border: '2px dashed rgba(255,255,255,0.4)',
                    }}
                  />
                  {/* Center denomination marker */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: sizeConfig.chipSize * 0.25,
                      fontWeight: 'bold',
                      color: chip.denomination >= 100 ? 'white' : '#1f2937',
                      textShadow: chip.denomination >= 100
                        ? '0 1px 2px rgba(0,0,0,0.5)'
                        : '0 1px 1px rgba(255,255,255,0.3)',
                    }}
                  >
                    {chip.denomination >= 1000 ? '1K' : `$${chip.denomination}`}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Amount label */}
      {showAmount && (
        <motion.div
          className="chip-tower-amount"
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          ${amount.toLocaleString()}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Pot Tower - Specialized chip tower for pot display
 * Uses larger chips and enhanced 3D effect
 */
export function PotTower({
  amount,
  animate = true,
  isWinning = false,
  winnerId,
}) {
  if (amount <= 0) return null;

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
      <ChipTower
        amount={amount}
        size="md"
        showAmount={true}
        animate={animate}
        maxChipsPerTower={6}
        maxTowers={2}
      />
    </motion.div>
  );
}

export default ChipStack;
