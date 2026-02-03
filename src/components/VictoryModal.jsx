import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Victory Modal - Displayed when a Sit & Go tournament is completed
 * Shows celebratory animation, payout summary, and navigation options
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Object} props.tournamentInfo - Tournament information from getTournamentInfo()
 * @param {string} props.currentUserUid - Current user's UID
 * @param {function} props.onCreateNewTable - Callback when "Create New Table" is clicked
 * @param {function} props.onReturnToLobby - Callback when "Return to Lobby" is clicked
 * @param {function} props.onClose - Callback to close the modal (optional dismiss)
 */
function VictoryModal({
  isOpen,
  tournamentInfo,
  currentUserUid,
  onCreateNewTable,
  onReturnToLobby,
  onClose,
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  // Trigger confetti animation when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Reset confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !tournamentInfo) return null;

  const { winner, payouts = [], prizePool = 0, gameType } = tournamentInfo;
  const isCurrentUserWinner = winner?.uid === currentUserUid;
  const currentUserPayout = payouts.find((p) => p.uid === currentUserUid);
  const currentUserPosition = currentUserPayout?.position;

  // Get ordinal suffix for position
  const getOrdinal = (n) => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  // Get position color
  const getPositionColor = (position) => {
    switch (position) {
      case 1:
        return 'text-yellow-400';
      case 2:
        return 'text-gray-300';
      case 3:
        return 'text-amber-600';
      default:
        return 'text-gray-400';
    }
  };

  // Get trophy emoji for position
  const getTrophyEmoji = (position) => {
    switch (position) {
      case 1:
        return '🏆';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  };

  // Game type display name
  const gameTypeDisplay =
    gameType === 'holdem' ? "Texas Hold'em" : 'Kansas City Lowball';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Confetti Animation */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: [
                      '#FFD700',
                      '#FF6B6B',
                      '#4ECDC4',
                      '#A855F7',
                      '#F97316',
                    ][Math.floor(Math.random() * 5)],
                    borderRadius: Math.random() > 0.5 ? '50%' : '0%',
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{
                    y: window.innerHeight + 20,
                    opacity: [1, 1, 0],
                    rotate: Math.random() * 720 - 360,
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
          )}

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-md mx-4 rounded-2xl p-6"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            }}
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            {/* Trophy/Victory Header */}
            <div className="text-center mb-6">
              <motion.div
                className="text-6xl mb-2"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
              >
                {isCurrentUserWinner ? '🏆' : getTrophyEmoji(currentUserPosition) || '🎮'}
              </motion.div>
              <motion.h2
                className={`text-2xl font-bold ${
                  isCurrentUserWinner ? 'text-yellow-400' : 'text-purple-300'
                }`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {isCurrentUserWinner ? 'Victory!' : 'Tournament Complete!'}
              </motion.h2>
              <motion.p
                className="text-slate-400 text-sm mt-1"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {gameTypeDisplay} Sit & Go
              </motion.p>
            </div>

            {/* Winner Announcement */}
            {winner && (
              <motion.div
                className="bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4 text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-sm text-slate-400 mb-1">Winner</p>
                <p className="text-xl font-bold text-yellow-400">{winner.displayName}</p>
              </motion.div>
            )}

            {/* Current User Result */}
            {currentUserPayout && (
              <motion.div
                className={`rounded-xl p-4 mb-4 text-center ${
                  isCurrentUserWinner
                    ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30'
                    : 'bg-slate-800/50 border border-slate-700/50'
                }`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <p className="text-sm text-slate-400 mb-1">Your Result</p>
                <p className={`text-lg font-bold ${getPositionColor(currentUserPosition)}`}>
                  {getTrophyEmoji(currentUserPosition)} {getOrdinal(currentUserPosition)} Place
                </p>
                {currentUserPayout.amount > 0 && (
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    +${currentUserPayout.amount.toLocaleString()}
                  </p>
                )}
              </motion.div>
            )}

            {/* Payout Summary */}
            <motion.div
              className="rounded-xl p-4 mb-6"
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
              }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Payout Summary</h3>
                <span className="text-xs text-purple-400">
                  ${prizePool.toLocaleString()} Pool
                </span>
              </div>
              <div className="space-y-2">
                {payouts.map((payout, idx) => (
                  <motion.div
                    key={payout.uid}
                    className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                      payout.uid === currentUserUid
                        ? 'bg-purple-900/30 border border-purple-500/30'
                        : 'bg-slate-800/50'
                    }`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.8 + idx * 0.1 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${getPositionColor(payout.position)}`}>
                        {getTrophyEmoji(payout.position)}
                      </span>
                      <span className="text-slate-300">{payout.displayName}</span>
                      {payout.uid === currentUserUid && (
                        <span className="text-xs bg-purple-600 px-1.5 py-0.5 rounded text-white">
                          You
                        </span>
                      )}
                    </div>
                    <span className={`font-bold ${payout.amount > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                      {payout.amount > 0 ? `$${payout.amount.toLocaleString()}` : '$0'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              className="flex gap-3"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <motion.button
                type="button"
                onClick={onReturnToLobby}
                whileTap={{ y: 2, boxShadow: '0 0px 0 rgba(51, 65, 85, 0.7), 0 1px 4px rgba(0, 0, 0, 0.15)' }}
                className="flex-1 text-white font-semibold rounded-2xl flex items-center justify-center"
                style={{
                  minHeight: '52px',
                  background: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.3)',
                  boxShadow: '0 3px 0 rgba(51, 65, 85, 0.7), 0 5px 12px rgba(0, 0, 0, 0.2)',
                }}
              >
                Return to Lobby
              </motion.button>
              <motion.button
                type="button"
                onClick={onCreateNewTable}
                whileTap={{ y: 4, boxShadow: '0 1px 0 #6d28d9, 0 3px 10px rgba(139, 92, 246, 0.2)' }}
                className="flex-1 font-bold rounded-2xl flex items-center justify-center"
                style={{
                  minHeight: '52px',
                  background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)',
                  color: 'white',
                  boxShadow: '0 5px 0 #6d28d9, 0 7px 18px rgba(139, 92, 246, 0.35)',
                }}
              >
                Create New Table
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VictoryModal;
