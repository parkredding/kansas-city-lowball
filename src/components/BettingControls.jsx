import { useState, useEffect } from 'react';

function BettingControls({
  onFold,
  onCheck,
  onCall,
  onRaise,
  callAmount,
  minRaise,
  maxRaise, // player's chips
  canCheck,
  currentBet,
  disabled,
}) {
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Update raise amount when minRaise changes
  useEffect(() => {
    setRaiseAmount(minRaise);
  }, [minRaise]);

  const handleRaiseChange = (e) => {
    setRaiseAmount(parseInt(e.target.value));
  };

  const handleRaiseSubmit = () => {
    onRaise(raiseAmount);
    setShowRaiseSlider(false);
  };

  // Quick raise presets (pot-sized bets, etc.)
  const potSizedRaise = Math.min(currentBet * 2 || minRaise, maxRaise);
  const halfPotRaise = Math.min(Math.floor((currentBet || minRaise) * 1.5), maxRaise);

  const presets = [
    { label: 'Min', value: minRaise },
    { label: '2x', value: Math.min(minRaise * 2, maxRaise) },
    { label: '3x', value: Math.min(minRaise * 3, maxRaise) },
    { label: 'All-In', value: maxRaise },
  ].filter((p, i, arr) => {
    // Filter duplicates and invalid values
    if (p.value > maxRaise || p.value < minRaise) return false;
    return arr.findIndex((x) => x.value === p.value) === i;
  });

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 w-full max-w-lg">
      {/* Raise Slider (shown when expanding) */}
      {showRaiseSlider && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Raise to</span>
            <span className="text-yellow-400 font-bold text-lg">${raiseAmount}</span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            step={Math.max(1, Math.floor((maxRaise - minRaise) / 100))}
            value={raiseAmount}
            onChange={handleRaiseChange}
            disabled={disabled}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 mb-3"
          />

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
              disabled={disabled}
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

        {/* Check or Call Button */}
        {canCheck ? (
          <button
            onClick={onCheck}
            disabled={disabled}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            Check
          </button>
        ) : (
          <button
            onClick={onCall}
            disabled={disabled || callAmount > maxRaise}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            <span className="block">Call</span>
            <span className="text-xs opacity-80">${callAmount}</span>
          </button>
        )}

        {/* Raise Button */}
        <button
          onClick={() => setShowRaiseSlider(!showRaiseSlider)}
          disabled={disabled || maxRaise <= minRaise}
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

        {/* All-In Button (quick access) */}
        {maxRaise > minRaise && (
          <button
            onClick={() => onRaise(maxRaise)}
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
