import { useState } from 'react';

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

function BuyInModal({ isOpen, onClose, onBuyIn, maxAmount, minBet, loading }) {
  const [amount, setAmount] = useState(Math.min(1000, maxAmount));
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const minBuyIn = minBet * 10; // Minimum buy-in is 10x the minimum bet
  const maxBuyIn = maxAmount;

  const handleSubmit = async () => {
    if (amount < minBuyIn) {
      setError(`Minimum buy-in is $${minBuyIn}`);
      return;
    }
    if (amount > maxBuyIn) {
      setError(`Maximum buy-in is $${maxBuyIn} (your balance)`);
      return;
    }

    setError(null);
    const success = await onBuyIn(amount);
    if (success) {
      onClose();
    }
  };

  const handlePresetClick = (presetAmount) => {
    const validAmount = Math.min(presetAmount, maxBuyIn);
    setAmount(validAmount);
    setError(null);
  };

  const handleSliderChange = (e) => {
    setAmount(parseInt(e.target.value));
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">Buy In</h2>
        <p className="text-gray-400 text-sm mb-6">
          Transfer chips from your wallet to play at this table.
        </p>

        {/* Wallet Balance Display */}
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Wallet Balance</span>
            <span className="text-white font-bold text-xl">${maxAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Amount Selection */}
        <div className="mb-6">
          <label className="block text-gray-300 text-sm mb-2">Buy-In Amount</label>

          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => handlePresetClick(preset)}
                disabled={preset > maxBuyIn}
                className={`
                  py-2 rounded-lg font-medium transition-colors
                  ${amount === preset
                    ? 'bg-yellow-600 text-white'
                    : preset <= maxBuyIn
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }
                `}
              >
                ${preset.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Slider */}
          <input
            type="range"
            min={minBuyIn}
            max={maxBuyIn}
            step={50}
            value={amount}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />

          {/* Amount Display & Input */}
          <div className="flex items-center justify-center mt-4">
            <span className="text-gray-400 text-xl mr-2">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setAmount(Math.max(minBuyIn, Math.min(maxBuyIn, val)));
                setError(null);
              }}
              className="bg-gray-700 text-white text-3xl font-bold w-32 text-center rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <p className="text-gray-500 text-xs text-center mt-2">
            Min: ${minBuyIn.toLocaleString()} | Max: ${maxBuyIn.toLocaleString()}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || amount < minBuyIn || amount > maxBuyIn}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Processing...' : `Buy In $${amount.toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuyInModal;
