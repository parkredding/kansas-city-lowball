import { useState, useEffect } from 'react';

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
      <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-2">
          {isRequired ? 'Choose Your Username' : 'Edit Username'}
        </h2>

        {isRequired && (
          <p className="text-gray-400 text-sm mb-4">
            Please choose a username to display at the poker table. This helps protect your privacy
            by not showing your Google account name.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
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
              className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              2-20 characters. Letters, numbers, underscores, and spaces allowed.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-3 py-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {!isRequired && (
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className={`${isRequired ? 'w-full' : 'flex-1'} bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors`}
            >
              {loading ? 'Saving...' : 'Save Username'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsernameModal;
