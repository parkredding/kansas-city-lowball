import { useState, useEffect } from 'react';

function BettingControls({
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
  callAmount,
  minRaise,
  maxRaise, // player's chips
  playerCurrentRoundBet = 0, // player's current bet this round
  canCheck,
  currentBet,
  disabled,
  isDesktop = false, // For desktop layout mode
}) {
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Calculate true max bet (player's chips + what they've already bet this round)
  // This is the total amount the player can raise TO
  const trueMaxRaise = Math.floor(maxRaise + playerCurrentRoundBet);

  // Determine if player must go all-in to call (chips < callAmount)
  const mustAllInToCall = callAmount > 0 && maxRaise < callAmount && maxRaise > 0;
  // Check if player can raise (has more chips than needed to call)
  const canRaise = maxRaise > callAmount && trueMaxRaise >= minRaise;

  // Update raise amount when minRaise changes, clamped to valid range
  useEffect(() => {
    const clampedMin = Math.max(minRaise, currentBet + 1);
    const clampedValue = Math.min(Math.max(clampedMin, minRaise), trueMaxRaise);
    setRaiseAmount(clampedValue);
  }, [minRaise, currentBet, trueMaxRaise]);

  const handleRaiseChange = (e) => {
    const value = parseInt(e.target.value) || minRaise;
    setRaiseAmount(Math.min(Math.max(value, minRaise), trueMaxRaise));
  };

  const handleRaiseSubmit = () => {
    onRaise(raiseAmount);
    setShowRaiseSlider(false);
  };

  // Handle direct input
  const handleInputChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setRaiseAmount(value);
  };

  const handleInputBlur = () => {
    // Clamp value on blur
    setRaiseAmount(Math.min(Math.max(raiseAmount, minRaise), trueMaxRaise));
  };

  // Quick raise presets
  const presets = [
    { label: 'Min', value: minRaise },
    { label: '2x', value: Math.min(minRaise * 2, trueMaxRaise) },
    { label: '1/2 Pot', value: Math.min(Math.floor(currentBet * 1.5) || minRaise, trueMaxRaise) },
    { label: 'Max', value: trueMaxRaise },
  ].filter((p, i, arr) => {
    // Filter duplicates and invalid values
    if (p.value > trueMaxRaise || p.value < minRaise) return false;
    return arr.findIndex((x) => x.value === p.value) === i;
  });

  // Desktop vs mobile layout classes
  const containerClass = isDesktop
    ? 'bg-gray-900/95 backdrop-blur-sm rounded-xl p-4 w-full'
    : 'bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 w-full max-w-lg';

  return (
    <div className={containerClass}>
      {/* Raise Slider (shown when expanding) */}
      {showRaiseSlider && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          {/* Amount display with editable input */}
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400 text-sm">Raise to</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                value={raiseAmount}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                min={minRaise}
                max={trueMaxRaise}
                disabled={disabled}
                className="w-24 bg-gray-700 text-yellow-400 font-bold text-lg px-2 py-1 rounded text-right border border-gray-600 focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Slider with Min/Max labels */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setRaiseAmount(minRaise)}
              disabled={disabled}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-700 rounded"
            >
              Min ${minRaise}
            </button>
            <input
              type="range"
              min={minRaise}
              max={trueMaxRaise}
              step={Math.max(1, Math.floor((trueMaxRaise - minRaise) / 100))}
              value={raiseAmount}
              onChange={handleRaiseChange}
              disabled={disabled}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <button
              onClick={() => setRaiseAmount(trueMaxRaise)}
              disabled={disabled}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-700 rounded"
            >
              Max ${trueMaxRaise}
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="flex gap-2 mb-3">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setRaiseAmount(preset.value)}
                disabled={disabled}
                className={`
                  flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors
                  ${raiseAmount === preset.value
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                {preset.label}
                <span className="block text-[10px] opacity-70">${preset.value}</span>
              </button>
            ))}
          </div>

          {/* Confirm / Cancel */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowRaiseSlider(false)}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRaiseSubmit}
              disabled={disabled || raiseAmount < minRaise || raiseAmount > trueMaxRaise}
              className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white rounded-lg text-sm font-bold transition-colors"
            >
              Raise ${raiseAmount}
            </button>
          </div>
        </div>
      )}

      {/* Main Action Buttons */}
      <div className="flex gap-2">
        {/* Fold Button */}
        <button
          onClick={onFold}
          disabled={disabled}
          className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
        >
          Fold
        </button>

        {/* Check, Call, or All-In Button */}
        {canCheck ? (
          <button
            onClick={onCheck}
            disabled={disabled}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            Check
          </button>
        ) : mustAllInToCall ? (
          // Show All-In button when player can't afford to call but has chips
          <button
            onClick={onAllIn || (() => onRaise(maxRaise))}
            disabled={disabled}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors animate-pulse"
          >
            <span className="block">All-In</span>
            <span className="text-xs opacity-80">${maxRaise}</span>
          </button>
        ) : (
          <button
            onClick={onCall}
            disabled={disabled}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            <span className="block">Call</span>
            <span className="text-xs opacity-80">${callAmount}</span>
          </button>
        )}

        {/* Raise Button - only show if player can raise */}
        {canRaise && (
          <button
            onClick={() => setShowRaiseSlider(!showRaiseSlider)}
            disabled={disabled}
            className={`
              flex-1 py-3 font-bold rounded-lg transition-colors
              ${showRaiseSlider
                ? 'bg-yellow-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white'
              }
            `}
          >
            <span className="block">{currentBet > 0 ? 'Raise' : 'Bet'}</span>
            {!showRaiseSlider && (
              <span className="text-xs opacity-80">${minRaise}+</span>
            )}
          </button>
        )}

        {/* All-In Button (quick access) - show if player can afford to raise */}
        {canRaise && maxRaise > minRaise && (
          <button
            onClick={onAllIn || (() => onRaise(maxRaise))}
            disabled={disabled}
            className="py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            <span className="block text-xs">All</span>
            <span className="block text-xs">In</span>
          </button>
        )}
      </div>

      {/* Info Bar */}
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>Current bet: ${currentBet}</span>
        <span>Your chips: ${maxRaise}</span>
      </div>
    </div>
  );
}

export default BettingControls;
