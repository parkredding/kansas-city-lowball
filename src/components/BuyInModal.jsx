import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

function BuyInModal({ isOpen, onClose, onBuyIn, maxAmount, minBet, loading }) {
  const [amount, setAmount] = useState(Math.min(1000, maxAmount));
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const minBuyIn = minBet * 10; // Minimum buy-in is 10x the minimum bet
  const maxBuyIn = maxAmount;
  const buyInRange = maxBuyIn - minBuyIn;
  const sliderProgress = buyInRange > 0 ? ((amount - minBuyIn) / buyInRange) * 100 : 0;

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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md mx-4 mb-4 sm:mb-0"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-2xl font-bold text-white">Buy In</h2>
              <p className="text-slate-400 text-sm mt-1">
                Transfer chips from your wallet to play at this table.
              </p>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              {/* Wallet Balance Display */}
              <div
                className="rounded-xl p-4 mb-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <span className="text-slate-400 text-sm font-medium">Wallet Balance</span>
                  </div>
                  <span className="text-green-400 font-bold text-xl">${maxAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Amount Selection */}
              <div className="mb-5">
                <label className="block text-slate-300 text-sm font-medium mb-3">Buy-In Amount</label>

                {/* Preset Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {PRESET_AMOUNTS.map((preset) => (
                    <motion.button
                      type="button"
                      key={preset}
                      onClick={() => handlePresetClick(preset)}
                      disabled={preset > maxBuyIn}
                      whileTap={{ scale: 0.95 }}
                      className={`
                        py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
                        ${amount === preset
                          ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                          : preset <= maxBuyIn
                            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/50'
                            : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-700/30'
                        }
                      `}
                    >
                      ${preset.toLocaleString()}
                    </motion.button>
                  ))}
                </div>

                {/* Slider */}
                <div className="relative mb-5">
                  <input
                    type="range"
                    min={minBuyIn}
                    max={maxBuyIn}
                    step={50}
                    value={amount}
                    onChange={handleSliderChange}
                    className="w-full rounded-full appearance-none cursor-pointer slider-touch"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${sliderProgress}%, rgba(71, 85, 105, 0.5) ${sliderProgress}%, rgba(71, 85, 105, 0.5) 100%)`,
                    }}
                  />
                </div>

                {/* Amount Display & Input */}
                <div
                  className="flex items-center justify-center py-4 rounded-xl"
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                  }}
                >
                  <span className="text-slate-500 text-2xl font-medium mr-1">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setAmount(Math.max(minBuyIn, Math.min(maxBuyIn, val)));
                      setError(null);
                    }}
                    className="bg-transparent text-white text-3xl font-bold w-32 text-center focus:outline-none"
                  />
                </div>

                <p className="text-slate-500 text-xs text-center mt-3">
                  Min: ${minBuyIn.toLocaleString()} | Max: ${maxBuyIn.toLocaleString()}
                </p>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileTap={{ y: 2, boxShadow: '0 0px 0 rgba(51, 65, 85, 0.7), 0 1px 4px rgba(0, 0, 0, 0.15)' }}
                  className="flex-1 text-white font-semibold rounded-2xl flex items-center justify-center"
                  style={{
                    minHeight: '52px',
                    background: 'rgba(51, 65, 85, 0.6)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    boxShadow: '0 3px 0 rgba(51, 65, 85, 0.7), 0 5px 12px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || amount < minBuyIn || amount > maxBuyIn}
                  whileTap={{ y: 4, boxShadow: '0 1px 0 #b45309, 0 3px 10px rgba(180, 83, 9, 0.2)' }}
                  className="flex-1 font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    minHeight: '52px',
                    background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                    color: 'white',
                    boxShadow: '0 5px 0 #b45309, 0 7px 18px rgba(180, 83, 9, 0.3)',
                  }}
                >
                  {loading ? 'Processing...' : `Buy In $${amount.toLocaleString()}`}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BuyInModal;
