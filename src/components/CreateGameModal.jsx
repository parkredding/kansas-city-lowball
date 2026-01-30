import { useState, useEffect } from 'react';

/**
 * Modal for configuring a new poker table
 * Allows players to customize game settings before creating a table
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

    // Validate bot count
    if (botCount < 0 || botCount > 5) {
      setError('Bot count must be between 0 and 5');
      return;
    }

    // Validate bot count doesn't exceed max players
    if (botCount >= maxPlayers) {
      setError('Bot count must be less than max players');
      return;
    }

    // Calculate turn time limit based on game speed
    const turnTimeLimit = gameSpeed === 'turbo' ? 30 : 60;

    // Create config object
    const config = {
      gameType,
      bettingType,
      maxPlayers,
      turnTimeLimit,
      passwordHash: privacy === 'private' ? password.trim() : null, // For MVP, store plain text
      bots: {
        count: botCount,
        difficulty: botDifficulty,
        fillStrategy, // 'fixed' or 'fill_empty'
      },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 cursor-pointer"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-2">Create New Table</h2>
        <p className="text-gray-400 text-sm mb-6">
          Configure your poker table settings
        </p>

        <form onSubmit={handleSubmit}>
          {/* Game Type */}
          <div className="mb-5">
            <label htmlFor="gameType" className="block text-sm font-medium text-gray-300 mb-2">
              Game Type
            </label>
            <select
              id="gameType"
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="lowball_27">Kansas City Lowball</option>
              <option value="holdem" disabled>Texas Hold'em (Coming Soon)</option>
              <option value="plo" disabled>PLO (Coming Soon)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select the poker variant for this table
            </p>
          </div>

          {/* Max Players */}
          <div className="mb-5">
            <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-300 mb-2">
              Max Players: {maxPlayers}
            </label>
            <div className="flex gap-2 mb-2">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setMaxPlayers(num)}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                    maxPlayers === num
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Number of players allowed at this table (2-6)
            </p>
          </div>

          {/* Betting Structure */}
          <div className="mb-5">
            <label htmlFor="bettingType" className="block text-sm font-medium text-gray-300 mb-2">
              Betting Structure
            </label>
            <select
              id="bettingType"
              value={bettingType}
              onChange={(e) => setBettingType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="no_limit">No Limit</option>
              <option value="pot_limit">Pot Limit</option>
              <option value="fixed_limit">Fixed Limit</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose the betting structure for this table
            </p>
          </div>

          {/* Bot Configuration */}
          <div className="mb-5">
            <label htmlFor="botCount" className="block text-sm font-medium text-gray-300 mb-2">
              Bot Players: {botCount}
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
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>5</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Add AI opponents to fill the table
            </p>
          </div>

          {/* Bot Difficulty */}
          {botCount > 0 && (
            <div className="mb-5">
              <label htmlFor="botDifficulty" className="block text-sm font-medium text-gray-300 mb-2">
                Bot Difficulty
              </label>
              <select
                id="botDifficulty"
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="easy">Easy (Tourist)</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard (Pro)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                AI skill level for all bots
              </p>
            </div>
          )}

          {/* Fill Strategy */}
          {botCount > 0 && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bot Fill Strategy
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="fillStrategy"
                    value="fixed"
                    checked={fillStrategy === 'fixed'}
                    onChange={(e) => setFillStrategy(e.target.value)}
                    className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 focus:ring-yellow-500"
                  />
                  <span className="ml-2 text-gray-300">Fixed Count</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="fillStrategy"
                    value="fill_empty"
                    checked={fillStrategy === 'fill_empty'}
                    onChange={(e) => setFillStrategy(e.target.value)}
                    className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 focus:ring-yellow-500"
                  />
                  <span className="ml-2 text-gray-300">Fill Empty Seats</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {fillStrategy === 'fixed'
                  ? 'Add exactly this many bots when table is created'
                  : 'Automatically add bots to fill empty seats up to max players'}
              </p>
            </div>
          )}

          {/* Privacy Settings */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Privacy Settings
            </label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="privacy"
                  value="public"
                  checked={privacy === 'public'}
                  onChange={(e) => {
                    setPrivacy(e.target.value);
                    setPassword('');
                    setError('');
                  }}
                  className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 focus:ring-yellow-500"
                />
                <span className="ml-2 text-gray-300">Public</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="privacy"
                  value="private"
                  checked={privacy === 'private'}
                  onChange={(e) => {
                    setPrivacy(e.target.value);
                    setError('');
                  }}
                  className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 focus:ring-yellow-500"
                />
                <span className="ml-2 text-gray-300">Private</span>
              </label>
            </div>

            {/* Password Input (only shown for private) */}
            {privacy === 'private' && (
              <div className="mt-3">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Players will need this password to join the table
                </p>
              </div>
            )}
          </div>

          {/* Game Speed */}
          <div className="mb-6">
            <label htmlFor="gameSpeed" className="block text-sm font-medium text-gray-300 mb-2">
              Game Speed
            </label>
            <select
              id="gameSpeed"
              value={gameSpeed}
              onChange={(e) => setGameSpeed(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="normal">Normal (1 min per turn)</option>
              <option value="turbo">Turbo (30s per turn)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Turn time limit for each player
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (privacy === 'private' && !password.trim())}
              className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGameModal;
