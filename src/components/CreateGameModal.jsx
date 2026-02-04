import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TABLE_MODES,
  DEFAULT_TOURNAMENT_CONFIG,
  getPrizeStructure,
  PAYOUT_STRUCTURE_TYPES,
  getPayoutStructure,
  parseCustomPayouts,
  STANDARD_PAYOUTS,
} from '../game/constants';

/**
 * Modal for configuring a new poker table
 * Allows players to customize game settings before creating a table
 * Supports both Cash Game and Sit & Go tournament modes
 */
function CreateGameModal({ isOpen, onClose, onCreate, loading }) {
  const [gameType, setGameType] = useState('lowball_27');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [bettingType, setBettingType] = useState('no_limit');
  const [privacy, setPrivacy] = useState('public');
  const [password, setPassword] = useState('');
  const [gameSpeed, setGameSpeed] = useState('normal');
  const [botCount, setBotCount] = useState(0);
  const [botDifficulty, setBotDifficulty] = useState('medium');
  const [fillStrategy, setFillStrategy] = useState('fixed');
  const [error, setError] = useState('');

  // Sit & Go tournament settings
  const [tableMode, setTableMode] = useState(TABLE_MODES.CASH_GAME);
  const [sngBuyIn, setSngBuyIn] = useState(DEFAULT_TOURNAMENT_CONFIG.buyIn);
  const [sngTotalSeats, setSngTotalSeats] = useState(DEFAULT_TOURNAMENT_CONFIG.totalSeats);

  // Payout structure settings
  const [payoutStructureType, setPayoutStructureType] = useState(PAYOUT_STRUCTURE_TYPES.WINNER_TAKE_ALL);
  const [customPayoutInput, setCustomPayoutInput] = useState('');
  const [customPayoutError, setCustomPayoutError] = useState('');

  const isSitAndGo = tableMode === TABLE_MODES.SIT_AND_GO;

  // Get current payout structure based on selection
  const getCurrentPayoutStructure = () => {
    if (payoutStructureType === PAYOUT_STRUCTURE_TYPES.CUSTOM) {
      const parsed = parseCustomPayouts(customPayoutInput);
      if (parsed.valid) {
        return parsed.payouts;
      }
      return [1.0]; // Fallback
    }
    return getPayoutStructure(payoutStructureType, sngTotalSeats);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGameType('lowball_27');
      setMaxPlayers(6);
      setBettingType('no_limit');
      setPrivacy('public');
      setPassword('');
      setGameSpeed('normal');
      setBotCount(0);
      setBotDifficulty('medium');
      setFillStrategy('fixed');
      setError('');
      // Reset SNG settings
      setTableMode(TABLE_MODES.CASH_GAME);
      setSngBuyIn(DEFAULT_TOURNAMENT_CONFIG.buyIn);
      setSngTotalSeats(DEFAULT_TOURNAMENT_CONFIG.totalSeats);
      // Reset payout structure settings
      setPayoutStructureType(PAYOUT_STRUCTURE_TYPES.WINNER_TAKE_ALL);
      setCustomPayoutInput('');
      setCustomPayoutError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate password if private
    if (privacy === 'private' && !password.trim()) {
      setError('Please enter a room password for private tables');
      return;
    }

    // For Sit & Go mode, bots are not allowed
    if (isSitAndGo && botCount > 0) {
      setError('Bots are not allowed in Sit & Go tournaments');
      return;
    }

    // Validate bot count (only for cash games)
    if (!isSitAndGo) {
      if (botCount < 0 || botCount > 5) {
        setError('Bot count must be between 0 and 5');
        return;
      }

      // Validate bot count doesn't exceed max players
      if (botCount >= maxPlayers) {
        setError('Bot count must be less than max players');
        return;
      }
    }

    // Validate SNG settings
    if (isSitAndGo) {
      if (sngBuyIn < 100 || sngBuyIn > 100000) {
        setError('Buy-in must be between $100 and $100,000');
        return;
      }
      if (sngTotalSeats < 2 || sngTotalSeats > 6) {
        setError('Total seats must be between 2 and 6');
        return;
      }
      // Validate custom payouts if selected
      if (payoutStructureType === PAYOUT_STRUCTURE_TYPES.CUSTOM) {
        const parsed = parseCustomPayouts(customPayoutInput);
        if (!parsed.valid) {
          setError(parsed.error);
          return;
        }
      }
    }

    // Calculate turn time limit based on game speed
    const turnTimeLimit = gameSpeed === 'turbo' ? 30 : 60;

    // Create config object
    const config = {
      gameType,
      bettingType,
      maxPlayers: isSitAndGo ? sngTotalSeats : maxPlayers, // SNG uses totalSeats as maxPlayers
      turnTimeLimit,
      passwordHash: privacy === 'private' ? password.trim() : null, // For MVP, store plain text
      bots: isSitAndGo ? { count: 0, difficulty: 'medium', fillStrategy: 'fixed' } : {
        count: botCount,
        difficulty: botDifficulty,
        fillStrategy, // 'fixed' or 'fill_empty'
      },
      // Table mode (cash game vs sit & go)
      tableMode,
      // Sit & Go tournament config (only included if SNG mode)
      // Starting chips equals buy-in amount for SnG tournaments
      ...(isSitAndGo && {
        tournament: {
          buyIn: sngBuyIn,
          totalSeats: sngTotalSeats,
          startingChips: sngBuyIn, // Starting chips = buy-in amount
          prizeStructure: getCurrentPayoutStructure(),
          payoutStructureType: payoutStructureType, // Store the type for reference
          state: 'REGISTERING', // Initial tournament state
          registeredPlayers: [], // Track registered players for payout
          eliminationOrder: [], // Track order of elimination (last eliminated = 2nd place, etc.)
        },
      }),
    };

    try {
      const result = await onCreate(config);
      // Close modal if table was successfully created (result is truthy)
      if (result) {
        onClose();
      }
      // If result is null/undefined, error is already set in context, modal will stay open
    } catch (err) {
      setError(err.message || 'Failed to create table');
      // Don't close modal on error
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Common style objects for glass morphism
  const glassModalStyle = {
    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(148, 163, 184, 0.1)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
  };

  const inputStyle = {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(71, 85, 105, 0.4)',
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
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 max-h-[90vh] overflow-hidden"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="rounded-2xl overflow-hidden" style={glassModalStyle}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
              <h2 className="text-2xl font-bold text-white">Create New Table</h2>
              <p className="text-slate-400 text-sm mt-1">
                Configure your poker table settings
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-5">

        <form onSubmit={handleSubmit}>
          {/* Table Mode Toggle */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 mb-2">
              Table Mode
            </label>
            <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
              <motion.button
                type="button"
                onClick={() => {
                  setTableMode(TABLE_MODES.CASH_GAME);
                  setBotCount(0);
                }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  tableMode === TABLE_MODES.CASH_GAME
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                style={tableMode === TABLE_MODES.CASH_GAME ? {
                  background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                } : {}}
              >
                Cash Game
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  setTableMode(TABLE_MODES.SIT_AND_GO);
                  setBotCount(0); // No bots in SNG
                }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  tableMode === TABLE_MODES.SIT_AND_GO
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                style={tableMode === TABLE_MODES.SIT_AND_GO ? {
                  background: 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                } : {}}
              >
                Sit & Go
              </motion.button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {tableMode === TABLE_MODES.SIT_AND_GO
                ? 'Tournament mode: Fixed buy-in, winner-takes-format, no re-entries'
                : 'Standard cash game: Buy-in anytime, leave anytime'}
            </p>
          </div>

          {/* Game Type */}
          <div className="mb-6">
            <label htmlFor="gameType" className="block text-xs font-medium text-slate-500 mb-2">
              Game Type
            </label>
            <div className="relative">
              <select
                id="gameType"
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full text-white px-4 pr-10 py-3 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                style={inputStyle}
              >
                <option value="lowball_27">Kansas City Lowball (2-7 Triple Draw)</option>
                <option value="single_draw_27">2-7 Single Draw (No Limit)</option>
                <option value="holdem">Texas Hold'em</option>
                <option value="plo" disabled>PLO (Coming Soon)</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select the poker variant for this table
            </p>
          </div>

          {/* Sit & Go Tournament Settings */}
          {isSitAndGo && (
            <div
              className="mb-6 p-4 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Tournament Settings
              </h3>

              {/* Buy-in Amount */}
              <div className="mb-4">
                <label htmlFor="sngBuyIn" className="block text-xs font-medium text-slate-500 mb-2">
                  Buy-in Amount: <span className="text-purple-300">${sngBuyIn.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  id="sngBuyIn"
                  min="100"
                  max="10000"
                  step="100"
                  value={sngBuyIn}
                  onChange={(e) => setSngBuyIn(parseInt(e.target.value))}
                  className="w-full rounded-full appearance-none cursor-pointer slider-touch"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((sngBuyIn - 100) / (10000 - 100)) * 100}%, rgba(71, 85, 105, 0.5) ${((sngBuyIn - 100) / (10000 - 100)) * 100}%, rgba(71, 85, 105, 0.5) 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>$100</span>
                  <span>$10,000</span>
                </div>
              </div>

              {/* Total Seats */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Total Seats: <span className="text-slate-300">{sngTotalSeats}</span>
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <motion.button
                      key={num}
                      type="button"
                      onClick={() => setSngTotalSeats(num)}
                      whileTap={{ scale: 0.95 }}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                        sngTotalSeats === num
                          ? 'text-white'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                      style={sngTotalSeats === num ? {
                        background: 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                      } : {
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(71, 85, 105, 0.3)',
                      }}
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Admin can start with 2+ players. Max {sngTotalSeats} seats.
                </p>
              </div>

              {/* Payout Structure */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Payout Structure
                </label>
                <div className="relative">
                  <select
                    value={payoutStructureType}
                    onChange={(e) => {
                      setPayoutStructureType(e.target.value);
                      setCustomPayoutError('');
                    }}
                    className="w-full text-white px-4 pr-10 py-2.5 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    style={inputStyle}
                  >
                    <option value={PAYOUT_STRUCTURE_TYPES.WINNER_TAKE_ALL}>
                      Winner Take All (1st: 100%)
                    </option>
                    <option value={PAYOUT_STRUCTURE_TYPES.STANDARD}>
                      Standard (Top {STANDARD_PAYOUTS[sngTotalSeats]?.length || 1} Paid)
                    </option>
                    <option value={PAYOUT_STRUCTURE_TYPES.CUSTOM}>
                      Custom
                    </option>
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {payoutStructureType === PAYOUT_STRUCTURE_TYPES.WINNER_TAKE_ALL && 'First place takes the entire prize pool'}
                  {payoutStructureType === PAYOUT_STRUCTURE_TYPES.STANDARD && `Standard payout: ${STANDARD_PAYOUTS[sngTotalSeats]?.map(p => `${(p * 100).toFixed(0)}%`).join(' / ') || '100%'}`}
                  {payoutStructureType === PAYOUT_STRUCTURE_TYPES.CUSTOM && 'Enter custom payout percentages below'}
                </p>
              </div>

              {/* Custom Payout Input */}
              {payoutStructureType === PAYOUT_STRUCTURE_TYPES.CUSTOM && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Custom Percentages (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={customPayoutInput}
                    onChange={(e) => {
                      setCustomPayoutInput(e.target.value);
                      const parsed = parseCustomPayouts(e.target.value);
                      setCustomPayoutError(parsed.valid ? '' : parsed.error);
                    }}
                    placeholder="e.g., 50, 30, 20"
                    className={`w-full text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      customPayoutError
                        ? 'focus:ring-red-500/50'
                        : 'focus:ring-purple-500/50'
                    }`}
                    style={{
                      ...inputStyle,
                      borderColor: customPayoutError ? 'rgba(239, 68, 68, 0.5)' : inputStyle.border,
                    }}
                  />
                  {customPayoutError && (
                    <p className="text-xs text-red-400 mt-1">{customPayoutError}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Enter percentages for each place (must add up to 100%)
                  </p>
                </div>
              )}

              {/* Prize Pool Preview */}
              <div
                className="rounded-xl p-3"
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(71, 85, 105, 0.3)',
                }}
              >
                <p className="text-xs text-slate-400 mb-2">Prize Pool Preview:</p>
                <p className="text-lg font-bold text-purple-300">
                  ${(sngBuyIn * sngTotalSeats).toLocaleString()} Total
                </p>
                <div className="mt-2 space-y-1">
                  {getCurrentPayoutStructure().map((pct, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-slate-400">
                        {idx + 1}{idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Place:
                      </span>
                      <span className="text-green-400">
                        ${Math.floor(sngBuyIn * sngTotalSeats * pct).toLocaleString()} ({(pct * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Max Players (Cash Game only) */}
          {!isSitAndGo && (
            <div className="mb-6">
              <label htmlFor="maxPlayers" className="block text-xs font-medium text-slate-500 mb-2">
                Max Players: <span className="text-slate-300">{maxPlayers}</span>
              </label>
              <div className="flex gap-2 mb-2">
                {[2, 3, 4, 5, 6].map((num) => (
                  <motion.button
                    key={num}
                    type="button"
                    onClick={() => setMaxPlayers(num)}
                    whileTap={{ scale: 0.95 }}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                      maxPlayers === num
                        ? 'text-white'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                    style={maxPlayers === num ? {
                      background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    } : {
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                    }}
                  >
                    {num}
                  </motion.button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Number of players allowed at this table (2-6)
              </p>
            </div>
          )}

          {/* Betting Structure */}
          <div className="mb-6">
            <label htmlFor="bettingType" className="block text-xs font-medium text-slate-500 mb-2">
              Betting Structure
            </label>
            <div className="relative">
              <select
                id="bettingType"
                value={bettingType}
                onChange={(e) => setBettingType(e.target.value)}
                className="w-full text-white px-4 pr-10 py-3 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                style={inputStyle}
              >
                <option value="no_limit">No Limit</option>
                <option value="pot_limit">Pot Limit</option>
                <option value="fixed_limit">Fixed Limit</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Choose the betting structure for this table
            </p>
          </div>

          {/* Bot Configuration (Cash Game only) */}
          {!isSitAndGo && (
            <>
              <div className="mb-6">
                <label htmlFor="botCount" className="block text-xs font-medium text-slate-500 mb-2">
                  Bot Players: <span className="text-slate-300">{botCount}</span>
                </label>
                <input
                  type="range"
                  id="botCount"
                  min="0"
                  max="5"
                  value={botCount}
                  onChange={(e) => {
                    const newCount = parseInt(e.target.value);
                    setBotCount(newCount);
                    // Ensure bot count doesn't exceed max players
                    if (newCount >= maxPlayers) {
                      setMaxPlayers(Math.min(6, newCount + 1));
                    }
                  }}
                  className="w-full rounded-full appearance-none cursor-pointer slider-touch"
                  style={{
                    background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(botCount / 5) * 100}%, rgba(71, 85, 105, 0.5) ${(botCount / 5) * 100}%, rgba(71, 85, 105, 0.5) 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0</span>
                  <span>5</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Add AI opponents to fill the table
                </p>
              </div>

              {/* Bot Difficulty */}
              {botCount > 0 && (
                <div className="mb-6">
                  <label htmlFor="botDifficulty" className="block text-xs font-medium text-slate-500 mb-2">
                    Bot Difficulty
                  </label>
                  <div className="relative">
                    <select
                      id="botDifficulty"
                      value={botDifficulty}
                      onChange={(e) => setBotDifficulty(e.target.value)}
                      className="w-full text-white px-4 pr-10 py-3 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                      style={inputStyle}
                    >
                      <option value="easy">Easy (Tourist)</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard (Pro)</option>
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    AI skill level for all bots
                  </p>
                </div>
              )}

              {/* Fill Strategy */}
              {botCount > 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Bot Fill Strategy
                  </label>
                  <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                    <motion.button
                      type="button"
                      onClick={() => setFillStrategy('fixed')}
                      whileTap={{ scale: 0.98 }}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        fillStrategy === 'fixed'
                          ? 'text-white shadow-lg'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                      style={fillStrategy === 'fixed' ? {
                        background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                      } : {}}
                    >
                      Fixed Count
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setFillStrategy('fill_empty')}
                      whileTap={{ scale: 0.98 }}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        fillStrategy === 'fill_empty'
                          ? 'text-white shadow-lg'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                      style={fillStrategy === 'fill_empty' ? {
                        background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                      } : {}}
                    >
                      Fill Empty
                    </motion.button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {fillStrategy === 'fixed'
                      ? 'Add exactly this many bots when table is created'
                      : 'Automatically add bots to fill empty seats up to max players'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Privacy Settings */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 mb-2">
              Privacy Settings
            </label>
            <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
              <motion.button
                type="button"
                onClick={() => {
                  setPrivacy('public');
                  setPassword('');
                  setError('');
                }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  privacy === 'public'
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                style={privacy === 'public' ? {
                  background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                } : {}}
              >
                Public
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  setPrivacy('private');
                  setError('');
                }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  privacy === 'private'
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                style={privacy === 'private' ? {
                  background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                } : {}}
              >
                Private
              </motion.button>
            </div>

            {/* Password Input (only shown for private) */}
            <AnimatePresence>
              {privacy === 'private' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <label htmlFor="password" className="block text-xs font-medium text-slate-500 mb-2">
                    Room Password
                  </label>
                  <input
                    type="text"
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter room password"
                    className="w-full text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                    style={inputStyle}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Players will need this password to join the table
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Game Speed */}
          <div className="mb-6">
            <label htmlFor="gameSpeed" className="block text-xs font-medium text-slate-500 mb-2">
              Game Speed
            </label>
            <div className="relative">
              <select
                id="gameSpeed"
                value={gameSpeed}
                onChange={(e) => setGameSpeed(e.target.value)}
                className="w-full text-white px-4 pr-10 py-3 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                style={inputStyle}
              >
                <option value="normal">Normal (1 min per turn)</option>
                <option value="turbo">Turbo (30s per turn)</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Turn time limit for each player
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
        </form>
            </div>

            {/* Footer with Action Buttons */}
            <div className="px-6 py-5 border-t border-slate-700/50">
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  whileTap={{ y: 2, boxShadow: '0 0px 0 rgba(51, 65, 85, 0.7), 0 1px 4px rgba(0, 0, 0, 0.15)' }}
                  className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl flex items-center justify-center"
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
                  disabled={loading || (privacy === 'private' && !password.trim())}
                  whileTap={{ y: 4, boxShadow: '0 1px 0 #b45309, 0 3px 10px rgba(180, 83, 9, 0.2)' }}
                  className="flex-1 font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    minHeight: '52px',
                    background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                    color: 'white',
                    boxShadow: '0 5px 0 #b45309, 0 7px 18px rgba(180, 83, 9, 0.3)',
                  }}
                >
                  {loading ? 'Creating...' : 'Create Table'}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CreateGameModal;
