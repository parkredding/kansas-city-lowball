import { useState, useEffect } from 'react';

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

    const success = await onJoin(tableId.trim(), password.trim() || null);
    if (success) {
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
      <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">Join Table</h2>
        <p className="text-gray-400 text-sm mb-6">
          Enter the table ID to join
        </p>

        <form onSubmit={handleSubmit}>
          {/* Table ID Input */}
          <div className="mb-5">
            <label htmlFor="tableId" className="block text-sm font-medium text-gray-300 mb-2">
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
              placeholder="Enter Table ID"
              maxLength={6}
              className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-center text-xl tracking-widest uppercase"
              autoFocus
            />
          </div>

          {/* Password Input (shown if needed or if explicitly requested) */}
          {(needsPassword || error.includes('password') || error.includes('Password')) && (
            <div className="mb-5">
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
                autoFocus={needsPassword}
              />
              <p className="text-xs text-gray-500 mt-1">
                This is a private table. Please enter the password.
              </p>
            </div>
          )}

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
              disabled={loading || !tableId?.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Joining...' : 'Join Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default JoinTableModal;
