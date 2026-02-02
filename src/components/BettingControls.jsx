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
  pot = 0, // total pot for half-pot calculations
  bigBlind = 0, // big blind amount for min-bet calculation
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

  // Min-bet is the minimum legal raise (typically = minRaise, but at least bigBlind)
  // If no prior bet, min-bet = big blind; if there's a bet, min-bet = minRaise
  const minBetAmount = currentBet > 0 ? minRaise : Math.max(bigBlind, minRaise);
  // Can only min-bet if player has enough chips and can raise
  const canMinBet = canRaise && maxRaise >= minBetAmount;
  // If min-bet would be all-in, treat it as all-in
  const minBetIsAllIn = canMinBet && maxRaise <= minBetAmount;

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

  const handleRaiseSubmit = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    onRaise(raiseAmount);
    setShowRaiseSlider(false);
  };

  // Handle min-bet quick action
  const handleMinBet = () => {
    if (minBetIsAllIn) {
      // If min-bet would be all-in, use all-in handler
      (onAllIn || (() => onRaise(maxRaise)))();
    } else {
      onRaise(minBetAmount);
    }
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

  // Format number for display (truncate if too long)
  const formatAmount = (amount) => {
    if (amount >= 10000) return `${Math.floor(amount / 1000)}k`;
    return amount.toLocaleString();
  };

  // Quick raise presets
  // Half-pot bet = (pot + call amount) / 2 + current bet to match
  // This is the standard poker formula for a half-pot sized bet
  const halfPotBet = Math.max(
    minRaise,
    Math.floor((pot + callAmount) / 2) + currentBet
  );

  const presets = [
    { label: 'Min', value: minRaise },
    { label: '2x', value: Math.min(minRaise * 2, trueMaxRaise) },
    { label: '½ Pot', value: Math.min(halfPotBet, trueMaxRaise) },
    { label: 'Max', value: trueMaxRaise },
  ].filter((p, i, arr) => {
    // Filter duplicates and invalid values
    if (p.value > trueMaxRaise || p.value < minRaise) return false;
    return arr.findIndex((x) => x.value === p.value) === i;
  });

  // Desktop vs mobile layout classes
  const containerClass = isDesktop
    ? 'bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 w-full border border-slate-700/50'
    : 'bg-slate-900/95 backdrop-blur-sm rounded-xl p-3 w-full max-w-lg border border-slate-700/50';

  return (
    <div className={containerClass}>
      {/* Raise Slider (shown when expanding) */}
      {showRaiseSlider && (
        <div className="mb-3 p-2.5 bg-slate-900/80 rounded-lg border border-slate-700/50">
          {/* Amount display with editable input */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-xs">Raise to</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm">$</span>
              <input
                type="number"
                value={raiseAmount}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                min={minRaise}
                max={trueMaxRaise}
                disabled={disabled}
                className="w-20 bg-slate-800 text-amber-400 font-bold text-sm px-2 py-1 rounded text-right border border-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Slider */}
          <div className="mb-2">
            <input
              type="range"
              min={minRaise}
              max={trueMaxRaise}
              step={10}
              value={raiseAmount}
              onChange={handleRaiseChange}
              disabled={disabled}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>${formatAmount(minRaise)}</span>
              <span>${formatAmount(trueMaxRaise)}</span>
            </div>
          </div>

          {/* Preset Buttons - compact */}
          <div className="grid grid-cols-4 gap-1 mb-2">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.label}
                onClick={() => setRaiseAmount(preset.value)}
                disabled={disabled}
                className={`
                  py-1.5 px-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap
                  ${raiseAmount === preset.value
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }
                `}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Confirm / Cancel */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowRaiseSlider(false)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRaiseSubmit}
              disabled={disabled || raiseAmount < minRaise || raiseAmount > trueMaxRaise}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Raise ${formatAmount(raiseAmount)}
            </button>
          </div>
        </div>
      )}

      {/* Main Action Buttons - Fixed 5-column grid for consistent layout */}
      <div className="grid grid-cols-5 gap-1">
        {/* Zone 1: Fold */}
        <button
          type="button"
          onClick={onFold}
          disabled={disabled}
          className="py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center"
        >
          <span className="block text-[10px]">Fold</span>
        </button>

        {/* Zone 2: Check / Call / All-In to Call */}
        {canCheck ? (
          <button
            type="button"
            onClick={onCheck}
            disabled={disabled}
            className="py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center"
          >
            <span className="block text-[10px]">Check</span>
          </button>
        ) : mustAllInToCall ? (
          <button
            type="button"
            onClick={onAllIn || (() => onRaise(maxRaise))}
            disabled={disabled}
            className="py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center"
          >
            <span className="block text-[10px]">All-In</span>
            <span className="block text-[8px] opacity-80">${formatAmount(maxRaise)}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCall}
            disabled={disabled}
            className="py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center"
          >
            <span className="block text-[10px]">Call</span>
            <span className="block text-[8px] opacity-80">${formatAmount(callAmount)}</span>
          </button>
        )}

        {/* Zone 3: Min Bet (placeholder if not available) */}
        {canMinBet ? (
          <button
            type="button"
            onClick={handleMinBet}
            disabled={disabled}
            className={`py-2 font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center
              ${minBetIsAllIn
                ? 'bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/50'
                : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50'
              } disabled:cursor-not-allowed text-white`}
          >
            <span className="block text-[10px]">{minBetIsAllIn ? 'All-In' : 'Min'}</span>
            <span className="block text-[8px] opacity-80">
              ${formatAmount(minBetIsAllIn ? maxRaise : minBetAmount)}
            </span>
          </button>
        ) : (
          <div className="min-h-[44px]" />
        )}

        {/* Zone 4: Raise/Bet (placeholder if not available) */}
        {canRaise ? (
          <button
            type="button"
            onClick={() => setShowRaiseSlider(!showRaiseSlider)}
            disabled={disabled}
            className={`py-2 font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center
              ${showRaiseSlider
                ? 'bg-amber-700 text-white'
                : 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900/50 disabled:cursor-not-allowed text-white'
              }`}
          >
            <span className="block text-[10px]">{currentBet > 0 ? 'Raise' : 'Bet'}</span>
            {!showRaiseSlider && (
              <span className="block text-[8px] opacity-80">${formatAmount(minRaise)}+</span>
            )}
          </button>
        ) : (
          <div className="min-h-[44px]" />
        )}

        {/* Zone 5: All-In (placeholder if not available) */}
        {canRaise && maxRaise > minRaise ? (
          <button
            type="button"
            onClick={onAllIn || (() => onRaise(maxRaise))}
            disabled={disabled}
            className="py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-xs min-h-[44px] flex flex-col items-center justify-center"
          >
            <span className="block text-[10px]">All-In</span>
            <span className="block text-[8px] opacity-80">${formatAmount(maxRaise)}</span>
          </button>
        ) : (
          <div className="min-h-[44px]" />
        )}
      </div>

      {/* Info Bar - minimal, only show current bet if relevant */}
      {currentBet > 0 && (
        <div className="mt-1.5 text-center text-[10px] text-slate-500">
          <span>Current bet: ${formatAmount(currentBet)}</span>
        </div>
      )}
    </div>
  );
}

export default BettingControls;
