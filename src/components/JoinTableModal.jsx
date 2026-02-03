import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Modal for joining a table with optional password entry
 */
function JoinTableModal({ isOpen, onClose, onJoin, tableId: initialTableId, loading, error: parentError }) {
  const [tableId, setTableId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  // Initialize tableId from prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setTableId(initialTableId || '');
      setNeedsPassword(false);
      setPassword('');
      setError('');
    }
  }, [isOpen, initialTableId]);

  // Update error from parent and show password field if needed
  useEffect(() => {
    if (parentError) {
      setError(parentError);
      if (parentError.toLowerCase().includes('password') || parentError.toLowerCase().includes('incorrect')) {
        setNeedsPassword(true);
      }
    }
  }, [parentError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!tableId?.trim()) {
      setError('Please enter a table ID');
      return;
    }

    const result = await onJoin(tableId.trim(), password.trim() || null);
    if (result) {
      // Check if joined as railbird and show a brief notification
      if (result.joinedAs === 'railbird') {
        // Could show a toast here, but the GameTable will display railbird status
      }
      onClose();
    } else {
      // If join failed, check if it's a password error
      // The error will be set by the parent component via error prop
      // We'll check it in useEffect
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPassword('');
      setError('');
      setNeedsPassword(false);
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
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        }}
      >
        <h2 className="text-2xl font-bold text-white mb-2">Join Table</h2>
        <p className="text-slate-400 text-sm mb-4">
          Enter the table ID to join
        </p>
        <p className="text-violet-400/80 text-xs mb-4 bg-violet-900/30 rounded-xl p-3 border border-violet-600/30">
          💡 If a game is in progress, you'll join as a railbird (observer) and can become a player when the hand ends.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Table ID Input */}
          <div className="mb-5">
            <label htmlFor="tableId" className="block text-xs font-medium text-slate-500 mb-2">
              Table ID
            </label>
            <input
              type="text"
              id="tableId"
              value={tableId}
              onChange={(e) => {
                setTableId(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="ABC123"
              maxLength={6}
              className="w-full text-white px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center text-xl tracking-widest uppercase font-mono transition-colors"
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(100, 120, 150, 0.45)',
              }}
              autoFocus
            />
          </div>

          {/* Password Input (shown if needed or if explicitly requested) */}
          {(needsPassword || error.includes('password') || error.includes('Password')) && (
            <div className="mb-5">
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
                className="w-full text-white px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
                style={{
                  background: 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid rgba(100, 120, 150, 0.45)',
                }}
                autoFocus={needsPassword}
              />
              <p className="text-xs text-slate-500 mt-1">
                This is a private table. Please enter the password.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-2">
            <motion.button
              type="button"
              onClick={handleClose}
              disabled={loading}
              whileTap={{ y: 2, boxShadow: '0 0px 0 rgba(51, 65, 85, 0.7), 0 1px 4px rgba(0, 0, 0, 0.15)' }}
              className="flex-1 text-white font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
              type="submit"
              disabled={loading || !tableId?.trim()}
              whileTap={{ y: 4, boxShadow: '0 1px 0 #1d4ed8, 0 3px 10px rgba(37, 99, 235, 0.2)' }}
              className="flex-1 font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              style={{
                minHeight: '52px',
                background: 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
                color: 'white',
                boxShadow: '0 5px 0 #1d4ed8, 0 7px 18px rgba(37, 99, 235, 0.35)',
              }}
            >
              {loading ? 'Joining...' : 'Join Table'}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default JoinTableModal;
