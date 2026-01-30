import { useMemo } from 'react';

/**
 * Visual chip stack component that renders poker chips based on amount
 * Larger amounts = taller stacks with different colored chips
 */
function ChipStack({ amount, size = 'md', showAmount = true, animate = false }) {
  // Calculate chip breakdown - higher denominations for larger stacks
  const chipBreakdown = useMemo(() => {
    if (amount <= 0) return [];

    const denominations = [
      { value: 1000, color: 'bg-yellow-400', border: 'border-yellow-600' },
      { value: 500, color: 'bg-purple-500', border: 'border-purple-700' },
      { value: 100, color: 'bg-gray-900', border: 'border-gray-700' },
      { value: 50, color: 'bg-green-500', border: 'border-green-700' },
      { value: 25, color: 'bg-blue-500', border: 'border-blue-700' },
      { value: 10, color: 'bg-red-500', border: 'border-red-700' },
      { value: 5, color: 'bg-white', border: 'border-gray-400' },
    ];

    let remaining = amount;
    const chips = [];

    for (const denom of denominations) {
      const count = Math.floor(remaining / denom.value);
      if (count > 0) {
        // Limit visual chips per denomination to keep stacks reasonable
        const visualCount = Math.min(count, 5);
        for (let i = 0; i < visualCount; i++) {
          chips.push({ ...denom });
        }
        remaining = remaining % denom.value;
      }
      // Limit total visual chips
      if (chips.length >= 12) break;
    }

    return chips;
  }, [amount]);

  // Size configurations
  const sizeConfig = {
    sm: { chip: 'w-4 h-1.5', gap: '-mt-0.5', text: 'text-[10px]' },
    md: { chip: 'w-6 h-2', gap: '-mt-1', text: 'text-xs' },
    lg: { chip: 'w-8 h-2.5', gap: '-mt-1', text: 'text-sm' },
  };

  const config = sizeConfig[size] || sizeConfig.md;

  if (amount <= 0) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center ${animate ? 'animate-bounce' : ''}`}>
      {/* Chip stack visualization */}
      <div className="flex flex-col-reverse items-center">
        {chipBreakdown.map((chip, index) => (
          <div
            key={index}
            className={`
              ${config.chip} ${chip.color} ${chip.border}
              rounded-full border-2 shadow-sm
              ${index > 0 ? config.gap : ''}
            `}
            style={{
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.3)',
            }}
          />
        ))}
      </div>

      {/* Amount label */}
      {showAmount && (
        <div className={`${config.text} font-bold text-white mt-1 bg-gray-800/80 px-1.5 rounded`}>
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
