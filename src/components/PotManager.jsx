import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import PokerChip, { CHIP_DENOMINATIONS } from './PokerChip';
import { calculateChipBreakdown } from './ChipStack';

/**
 * PotManager - Manages pot display with animations for betting and winning
 *
 * Features:
 * - Main pot display in center of table
 * - Side pot support for all-in scenarios
 * - Flying chip animations from players to pot
 * - Winning animation that slides chips to winner
 * - Sound trigger callbacks
 */

/**
 * Individual pot stack component
 */
function PotStack({
  amount,
  label,
  index = 0,
  animate = true,
  isWinning = false,
  winnerPosition = null,
  onAnimationComplete,
  onChipLand,
}) {
  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Create chip objects with stable IDs
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    const maxChips = 8;

    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, maxChips - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          denomination,
          rotation: ((count + i) * 7 + index * 3) % 10 - 5, // Deterministic rotation
          id: `pot-${index}-${denomination}-${count + i}`,
        });
        count++;
      }
      if (count >= maxChips) break;
    }
    return result;
  }, [breakdown, index]);

  // Split into columns if too many chips
  const stack1 = chips.slice(0, 5);
  const stack2 = chips.slice(5);

  // Calculate winning animation target
  const winningAnimation = isWinning && winnerPosition ? {
    x: winnerPosition.x,
    y: winnerPosition.y,
    scale: 0.5,
    opacity: 0,
  } : {};

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={animate ? { scale: 0, opacity: 0 } : false}
      animate={isWinning ? winningAnimation : { scale: 1, opacity: 1, x: 0, y: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={isWinning ? {
        type: 'spring',
        stiffness: 150,
        damping: 20,
        delay: index * 0.1,
      } : {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: index * 0.05,
      }}
      onAnimationComplete={() => {
        if (isWinning && onAnimationComplete) {
          onAnimationComplete();
        }
      }}
    >
      <div className="flex items-end gap-1">
        {/* First stack */}
        <div className="flex flex-col-reverse items-center">
          {stack1.map((chip, chipIndex) => (
            <motion.div
              key={chip.id}
              layoutId={chip.id}
              style={{
                marginTop: chipIndex > 0 ? -28 : 0,
                zIndex: chipIndex,
              }}
              initial={animate ? { y: -30, opacity: 0, rotateX: -90 } : false}
              animate={{ y: 0, opacity: 1, rotateX: 0 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 20,
                delay: chipIndex * 0.04 + index * 0.1,
              }}
              onAnimationComplete={() => {
                if (chipIndex === stack1.length - 1 && onChipLand) {
                  onChipLand();
                }
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
            {stack2.map((chip, chipIndex) => (
              <motion.div
                key={chip.id}
                layoutId={chip.id}
                style={{
                  marginTop: chipIndex > 0 ? -28 : 0,
                  zIndex: chipIndex,
                }}
                initial={animate ? { y: -30, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 20,
                  delay: 0.15 + chipIndex * 0.04 + index * 0.1,
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

      {/* Pot label */}
      <motion.div
        className={`
          mt-2 px-3 py-1.5 rounded-lg shadow-lg
          ${index === 0
            ? 'bg-yellow-600/95 border border-yellow-500'
            : 'bg-gray-700/95 border border-gray-600'
          }
        `}
        initial={animate ? { opacity: 0, y: 10 } : false}
        animate={isWinning ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + index * 0.05 }}
      >
        {label && (
          <span className="text-xs text-gray-300 block text-center mb-0.5">
            {label}
          </span>
        )}
        <span className="text-white font-bold text-sm block text-center">
          ${amount.toLocaleString()}
        </span>
      </motion.div>
    </motion.div>
  );
}

/**
 * Flying chips animation component
 * Shows chips flying from a player position to the pot
 */
export function FlyingChips({
  amount,
  fromPosition,
  toPosition,
  playerId,
  onComplete,
  onChipLand,
}) {
  const [isFlying, setIsFlying] = useState(true);

  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Create flying chip objects (limit to 3 for performance)
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, 3 - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          denomination,
          id: `flying-${playerId}-${denomination}-${count + i}`,
          delay: (count + i) * 0.08,
        });
        count++;
      }
      if (count >= 3) break;
    }
    return result;
  }, [breakdown, playerId]);

  useEffect(() => {
    if (!isFlying && onComplete) {
      onComplete();
    }
  }, [isFlying, onComplete]);

  if (!isFlying) return null;

  return (
    <AnimatePresence>
      {chips.map((chip, index) => (
        <motion.div
          key={chip.id}
          className="fixed z-50 pointer-events-none"
          initial={{
            x: fromPosition.x,
            y: fromPosition.y,
            scale: 0.8,
            opacity: 1,
          }}
          animate={{
            x: toPosition.x,
            y: toPosition.y,
            scale: 1,
            opacity: 1,
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 25,
            delay: chip.delay,
          }}
          onAnimationComplete={() => {
            if (index === chips.length - 1) {
              setIsFlying(false);
              if (onChipLand) onChipLand();
            }
          }}
        >
          <PokerChip
            denomination={chip.denomination}
            size="sm"
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

/**
 * Main PotManager component
 */
function PotManager({
  mainPot = 0,
  sidePots = [],
  isShowdown = false,
  winnerId = null,
  winnerPosition = null,
  onWinAnimationComplete,
  onChipLand, // Callback for sound effects
}) {
  const [isWinning, setIsWinning] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger winning animation when showdown with winner
  useEffect(() => {
    if (isShowdown && winnerId && !hasAnimated) {
      // Small delay before starting win animation
      const timer = setTimeout(() => {
        setIsWinning(true);
        setHasAnimated(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isShowdown, winnerId, hasAnimated]);

  // Reset animation state when pot changes significantly
  useEffect(() => {
    if (mainPot === 0) {
      setIsWinning(false);
      setHasAnimated(false);
    }
  }, [mainPot]);

  const handleWinAnimationComplete = useCallback(() => {
    if (onWinAnimationComplete) {
      onWinAnimationComplete();
    }
  }, [onWinAnimationComplete]);

  const handleChipLand = useCallback(() => {
    if (onChipLand) {
      onChipLand();
    }
  }, [onChipLand]);

  // Calculate total pot for display
  const totalPot = mainPot + sidePots.reduce((sum, pot) => sum + (pot.amount || 0), 0);

  if (totalPot <= 0) {
    return null;
  }

  return (
    <LayoutGroup id="pot-manager">
      <div className="flex flex-col items-center gap-3">
        {/* Side pots (displayed above main pot) */}
        {sidePots.length > 0 && (
          <div className="flex gap-4 flex-wrap justify-center">
            {sidePots.map((pot, index) => (
              <PotStack
                key={`sidepot-${index}`}
                amount={pot.amount}
                label={`Side Pot ${index + 1}`}
                index={index + 1}
                isWinning={isWinning && pot.winnerId === winnerId}
                winnerPosition={winnerPosition}
                onAnimationComplete={handleWinAnimationComplete}
                onChipLand={handleChipLand}
              />
            ))}
          </div>
        )}

        {/* Main pot */}
        <PotStack
          amount={mainPot}
          label={sidePots.length > 0 ? 'Main Pot' : undefined}
          index={0}
          isWinning={isWinning}
          winnerPosition={winnerPosition}
          onAnimationComplete={handleWinAnimationComplete}
          onChipLand={handleChipLand}
        />

        {/* Total pot indicator when there are side pots */}
        {sidePots.length > 0 && (
          <motion.div
            className="bg-gray-800/80 px-4 py-1 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: isWinning ? 0 : 1 }}
          >
            <span className="text-gray-400 text-xs">Total: </span>
            <span className="text-white font-bold text-sm">
              ${totalPot.toLocaleString()}
            </span>
          </motion.div>
        )}
      </div>
    </LayoutGroup>
  );
}

/**
 * Compact pot display for mobile/small screens
 */
export function CompactPotDisplay({ amount, animate = true }) {
  if (amount <= 0) return null;

  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Show only 3 chips max
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, 3 - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          denomination,
          rotation: (count + i) * 3 - 3,
        });
        count++;
      }
      if (count >= 3) break;
    }
    return result;
  }, [breakdown]);

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Mini chip stack */}
      <div className="flex flex-col-reverse items-center">
        {chips.map((chip, index) => (
          <div
            key={index}
            style={{
              marginTop: index > 0 ? -20 : 0,
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

      {/* Amount */}
      <div className="bg-yellow-600/90 px-3 py-1.5 rounded-lg shadow-lg">
        <span className="text-white font-bold">
          ${amount.toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Player bet display that positions chips between player and center
 * Used for current round bets
 */
export function PlayerBetChips({
  amount,
  playerId,
  position, // { x, y } relative to table center
  animate = true,
}) {
  const breakdown = useMemo(() => calculateChipBreakdown(amount), [amount]);

  // Create chips (max 4)
  const chips = useMemo(() => {
    const result = [];
    let count = 0;
    for (const { denomination, count: denomCount } of breakdown) {
      const toAdd = Math.min(denomCount, 4 - count);
      for (let i = 0; i < toAdd; i++) {
        result.push({
          denomination,
          rotation: (count + i) * 5 - 7.5,
          id: `player-bet-${playerId}-${denomination}-${count + i}`,
        });
        count++;
      }
      if (count >= 4) break;
    }
    return result;
  }, [breakdown, playerId]);

  if (amount <= 0) return null;

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{
        position: 'absolute',
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: 'translate(-50%, -50%)',
      }}
      initial={animate ? { scale: 0, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Chip stack */}
      <div className="flex flex-col-reverse items-center">
        {chips.map((chip, index) => (
          <motion.div
            key={chip.id}
            layoutId={chip.id}
            style={{
              marginTop: index > 0 ? -18 : 0,
              zIndex: index,
            }}
            initial={animate ? { y: -20, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 350,
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

      {/* Amount label */}
      <motion.span
        className="text-xs font-bold text-yellow-300 mt-1 bg-black/60 px-2 py-0.5 rounded shadow"
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        ${amount.toLocaleString()}
      </motion.span>
    </motion.div>
  );
}

/**
 * Hook to manage chip animation sounds
 * Returns a callback that can be passed to onChipLand
 */
export function useChipSounds() {
  const playChipSound = useCallback(() => {
    // Placeholder for sound effect
    // In production, you would load and play an audio file:
    // const audio = new Audio('/sounds/chip-clack.mp3');
    // audio.volume = 0.3;
    // audio.play().catch(() => {}); // Catch autoplay restrictions

    // For now, just log that the sound would play
    console.log('[ChipSound] Chip landed - would play clack.mp3');
  }, []);

  return { playChipSound };
}

export default PotManager;
