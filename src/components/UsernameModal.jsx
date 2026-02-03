import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Modal for setting or editing a custom username
 * Used for first-time setup (forced) or later editing (optional)
 */
function UsernameModal({ isOpen, onClose, onSave, currentUsername, isRequired, loading }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername(currentUsername || '');
      setError('');
    }
  }, [isOpen, currentUsername]);

  const validateUsername = (value) => {
    if (!value || value.trim().length < 2) {
      return 'Username must be at least 2 characters';
    }
    if (value.trim().length > 20) {
      return 'Username must be 20 characters or less';
    }
    // Only allow alphanumeric characters, underscores, and spaces
    if (!/^[a-zA-Z0-9_ ]+$/.test(value.trim())) {
      return 'Username can only contain letters, numbers, underscores, and spaces';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await onSave(username.trim());
      if (!isRequired) {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save username');
    }
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 ${isRequired ? '' : 'cursor-pointer'}`}
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
        <h2 className="text-2xl font-bold text-white mb-2">
          {isRequired ? 'Choose Your Username' : 'Edit Username'}
        </h2>

        {isRequired && (
          <p className="text-slate-400 text-sm mb-4">
            Please choose a username to display at the poker table. This helps protect your privacy
            by not showing your Google account name.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="username" className="block text-xs font-medium text-slate-500 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Enter your username"
              maxLength={20}
              autoFocus
              className="w-full text-white px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(100, 120, 150, 0.45)',
              }}
            />
            <p className="text-xs text-slate-500 mt-2">
              2-20 characters. Letters, numbers, underscores, and spaces allowed.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {!isRequired && (
              <motion.button
                type="button"
                onClick={handleClose}
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
            )}
            <motion.button
              type="submit"
              disabled={loading || !username.trim()}
              whileTap={{ y: 4, boxShadow: '0 1px 0 #b45309, 0 3px 10px rgba(180, 83, 9, 0.2)' }}
              className={`${isRequired ? 'w-full' : 'flex-1'} font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
              style={{
                minHeight: '52px',
                background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                color: 'white',
                boxShadow: '0 5px 0 #b45309, 0 7px 18px rgba(180, 83, 9, 0.3)',
              }}
            >
              {loading ? 'Saving...' : 'Save Username'}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsernameModal;
