import { useMemo } from 'react';

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

      {/* Amount label */}
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
 * Animated bet chip that moves to the pot
 */
export function BetChip({ amount, playerPosition }) {
  if (amount <= 0) return null;

  return (
    <div className="flex flex-col items-center">
      <ChipStack amount={amount} size="sm" showAmount={false} />
      <span className="text-xs font-bold text-yellow-300 mt-0.5">
        ${amount}
      </span>
    </div>
  );
}

/**
 * Pot visualization with stacked chips
 */
export function PotDisplay({ amount, animate = false }) {
  if (amount <= 0) return null;

  return (
    <div className={`flex flex-col items-center ${animate ? 'animate-pulse' : ''}`}>
      <ChipStack amount={amount} size="lg" showAmount={false} />
      <div className="bg-yellow-600/90 px-3 py-1 rounded-lg mt-1 shadow-lg">
        <span className="text-white font-bold">${amount.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default ChipStack;
