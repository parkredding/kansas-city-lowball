/**
 * ============================================================================
 * POSITION INDICATOR BUTTONS
 * Professional Dealer, Small Blind, and Big Blind Markers
 * ============================================================================
 *
 * These components render position indicators near player avatars.
 * Updated with high-quality visuals matching professional poker standards.
 *
 * Features:
 * - Enhanced Dealer button with 3D casino-style design
 * - Clear, readable SB/BB indicators
 * - Animated transitions when positions change
 * - Compact variants for tight layouts
 *
 * ============================================================================
 */

import { motion } from 'framer-motion';

/**
 * Enhanced Dealer Button - Professional Casino Style
 * Clear, circular "D" button with 3D effect
 */
export function DealerButton({ className = '', compact = false, animate = true }) {
  const sizeClasses = compact
    ? 'w-6 h-6 text-[10px]'
    : 'w-8 h-8 text-sm';

  const ButtonWrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    transition: { type: 'spring', stiffness: 400, damping: 20 },
    whileHover: { scale: 1.1 },
  } : {};

  return (
    <ButtonWrapper
      className={`
        dealer-button
        ${sizeClasses}
        rounded-full
        flex items-center justify-center
        font-black
        relative
        cursor-default
        ${className}
      `}
      title="Dealer"
      {...animationProps}
      style={{
        // 3D casino chip effect
        background: 'linear-gradient(145deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)',
        boxShadow: `
          0 2px 4px rgba(0,0,0,0.3),
          0 4px 8px rgba(0,0,0,0.2),
          inset 0 1px 2px rgba(255,255,255,0.8),
          inset 0 -1px 2px rgba(0,0,0,0.1)
        `,
        border: '2px solid #1f2937',
      }}
    >
      {/* Inner ring detail */}
      <div
        className="absolute inset-1 rounded-full border border-slate-300/50"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)',
        }}
      />

      {/* Dealer text */}
      <span className="relative text-slate-900 font-black tracking-tight">
        D
      </span>

      {/* Edge notches (like a casino chip) */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation) => (
          <div
            key={rotation}
            className="absolute w-0.5 h-1 bg-slate-400/40"
            style={{
              top: '0',
              left: '50%',
              transformOrigin: `center ${compact ? '12px' : '16px'}`,
              transform: `translateX(-50%) rotate(${rotation}deg)`,
            }}
          />
        ))}
      </div>
    </ButtonWrapper>
  );
}

/**
 * Small Blind Button - Blue "SB" indicator
 */
export function SmallBlindButton({ className = '', compact = false, animate = true }) {
  const sizeClasses = compact
    ? 'w-6 h-6 text-[8px]'
    : 'w-7 h-7 text-[10px]';

  const ButtonWrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { type: 'spring', stiffness: 400, damping: 20, delay: 0.1 },
  } : {};

  return (
    <ButtonWrapper
      className={`
        small-blind-button
        ${sizeClasses}
        rounded-full
        flex items-center justify-center
        font-bold
        text-white
        ${className}
      `}
      title="Small Blind"
      {...animationProps}
      style={{
        background: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
        boxShadow: `
          0 2px 4px rgba(37, 99, 235, 0.4),
          0 4px 8px rgba(0,0,0,0.2),
          inset 0 1px 2px rgba(255,255,255,0.3)
        `,
        border: '2px solid #1e40af',
      }}
    >
      <span className="relative">SB</span>
    </ButtonWrapper>
  );
}

/**
 * Big Blind Button - Gold "BB" indicator
 */
export function BigBlindButton({ className = '', compact = false, animate = true }) {
  const sizeClasses = compact
    ? 'w-6 h-6 text-[8px]'
    : 'w-7 h-7 text-[10px]';

  const ButtonWrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { type: 'spring', stiffness: 400, damping: 20, delay: 0.15 },
  } : {};

  return (
    <ButtonWrapper
      className={`
        big-blind-button
        ${sizeClasses}
        rounded-full
        flex items-center justify-center
        font-bold
        text-slate-900
        ${className}
      `}
      title="Big Blind"
      {...animationProps}
      style={{
        background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
        boxShadow: `
          0 2px 4px rgba(245, 158, 11, 0.4),
          0 4px 8px rgba(0,0,0,0.2),
          inset 0 1px 2px rgba(255,255,255,0.4)
        `,
        border: '2px solid #b45309',
      }}
    >
      <span className="relative">BB</span>
    </ButtonWrapper>
  );
}

/**
 * Ante Button - Green "A" indicator (optional)
 */
export function AnteButton({ className = '', compact = false, animate = true }) {
  const sizeClasses = compact
    ? 'w-5 h-5 text-[8px]'
    : 'w-6 h-6 text-[10px]';

  const ButtonWrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { type: 'spring', stiffness: 400, damping: 20, delay: 0.2 },
  } : {};

  return (
    <ButtonWrapper
      className={`
        ante-button
        ${sizeClasses}
        rounded-full
        flex items-center justify-center
        font-bold
        text-white
        ${className}
      `}
      title="Ante"
      {...animationProps}
      style={{
        background: 'linear-gradient(145deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
        boxShadow: `
          0 2px 4px rgba(22, 163, 74, 0.4),
          0 4px 8px rgba(0,0,0,0.2),
          inset 0 1px 2px rgba(255,255,255,0.3)
        `,
        border: '2px solid #166534',
      }}
    >
      <span className="relative">A</span>
    </ButtonWrapper>
  );
}

/**
 * Combined position indicators component
 * Renders all applicable position buttons for a player
 *
 * Props:
 * @param {boolean} isDealer - Player is the dealer
 * @param {boolean} isSmallBlind - Player posted small blind
 * @param {boolean} isBigBlind - Player posted big blind
 * @param {boolean} compact - Use smaller buttons for tight layouts
 * @param {boolean} animate - Enable/disable animations
 * @param {'horizontal' | 'vertical'} layout - Button arrangement
 */
export function PositionIndicators({
  isDealer,
  isSmallBlind,
  isBigBlind,
  className = '',
  compact = false,
  animate = true,
  layout = 'horizontal',
}) {
  const hasAnyPosition = isDealer || isSmallBlind || isBigBlind;

  if (!hasAnyPosition) return null;

  const layoutClasses = {
    horizontal: 'flex-row gap-1',
    vertical: 'flex-col gap-0.5',
  };

  return (
    <div className={`position-indicators flex ${layoutClasses[layout]} ${className}`}>
      {isDealer && <DealerButton compact={compact} animate={animate} />}
      {isSmallBlind && <SmallBlindButton compact={compact} animate={animate} />}
      {isBigBlind && <BigBlindButton compact={compact} animate={animate} />}
    </div>
  );
}

/**
 * Floating Dealer Button
 * Positions the dealer button near a specific player seat
 * with dynamic positioning based on seat location
 */
export function FloatingDealerButton({
  position = { x: '50%', y: '50%' },
  animate = true,
  className = '',
}) {
  const ButtonWrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { scale: 0, rotate: -180, opacity: 0 },
    animate: { scale: 1, rotate: 0, opacity: 1 },
    exit: { scale: 0, rotate: 180, opacity: 0 },
    transition: { type: 'spring', stiffness: 300, damping: 25 },
    layout: true,
  } : {};

  return (
    <ButtonWrapper
      className={`
        floating-dealer-button
        absolute
        z-20
        ${className}
      `}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
      {...animationProps}
    >
      <DealerButton animate={false} />
    </ButtonWrapper>
  );
}

export default PositionIndicators;
