import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Victory Modal - Displayed when a Sit & Go tournament is completed
 * Shows celebratory animation, payout summary, rematch voting status,
 * and navigation options.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Object} props.tournamentInfo - Tournament information from getTournamentInfo()
 * @param {string} props.currentUserUid - Current user's UID
 * @param {function} props.onVoteRematch - Callback when player votes to play again or leave
 * @param {function} props.onRestartTournament - Callback to trigger tournament restart
 * @param {function} props.onReturnToLobby - Callback when "Return to Lobby" is clicked
 * @param {function} props.onClose - Callback to close the modal (optional dismiss)
 * @param {Array} props.players - Current players array from table data
 */
function VictoryModal({
  isOpen,
  tournamentInfo,
  currentUserUid,
  onVoteRematch,
  onRestartTournament,
  onReturnToLobby,
  onClose,
  players = [],
}) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [restartTriggered, setRestartTriggered] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  // Trigger confetti animation when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      setRestartTriggered(false);
      setHasVoted(false);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Track if current user has already voted (from tournament data)
  useEffect(() => {
    if (!isOpen || !tournamentInfo?.rematchVotes) return;
    const voted = tournamentInfo.rematchVotes.some((v) => v.uid === currentUserUid);
    setHasVoted(voted);
  }, [isOpen, tournamentInfo?.rematchVotes, currentUserUid]);

  // Countdown timer for rematch deadline
  useEffect(() => {
    if (!isOpen || !tournamentInfo?.rematchDeadline) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((tournamentInfo.rematchDeadline - Date.now()) / 1000));
      setCountdown(remaining);

      // When deadline expires, trigger restart with whoever voted yes
      if (remaining <= 0 && !restartTriggered) {
        const yesVotes = (tournamentInfo.rematchVotes || []).filter((v) => v.wantsToPlay);
        if (yesVotes.length >= 2) {
          setRestartTriggered(true);
          onRestartTournament?.();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, tournamentInfo?.rematchDeadline, restartTriggered, onRestartTournament, tournamentInfo?.rematchVotes]);

  // Auto-restart when all players have voted and enough said yes
  useEffect(() => {
    if (!isOpen || !tournamentInfo?.rematchVotes || restartTriggered) return;

    const rematchVotes = tournamentInfo.rematchVotes;
    const registeredPlayers = tournamentInfo.registeredPlayers || [];

    // Count human players only (bots auto-vote)
    const humanPlayers = registeredPlayers.filter((rp) => {
      const playerData = players.find((p) => p.uid === rp.uid);
      return !playerData?.isBot;
    });
    const humanVotes = rematchVotes.filter((v) => {
      const playerData = players.find((p) => p.uid === v.uid);
      return !playerData?.isBot;
    });

    if (humanVotes.length >= humanPlayers.length && humanPlayers.length > 0) {
      const yesVotes = rematchVotes.filter((v) => v.wantsToPlay);
      if (yesVotes.length >= 2) {
        setRestartTriggered(true);
        onRestartTournament?.();
      }
    }
  }, [isOpen, tournamentInfo?.rematchVotes, tournamentInfo?.registeredPlayers, players, restartTriggered, onRestartTournament]);

  const handleVoteYes = useCallback(() => {
    if (hasVoted || restartTriggered) return;
    setHasVoted(true);
    onVoteRematch?.(true);
  }, [hasVoted, restartTriggered, onVoteRematch]);

  const handleVoteNo = useCallback(() => {
    if (hasVoted || restartTriggered) return;
    setHasVoted(true);
    onVoteRematch?.(false);
    onReturnToLobby?.();
  }, [hasVoted, restartTriggered, onVoteRematch, onReturnToLobby]);

  if (!isOpen || !tournamentInfo) return null;

  const { winner, payouts = [], prizePool = 0, gameType, rematchVotes = [], registeredPlayers = [] } = tournamentInfo;
  const isCurrentUserWinner = winner?.uid === currentUserUid;
  const currentUserPayout = payouts.find((p) => p.uid === currentUserUid);
  const currentUserPosition = currentUserPayout?.position;

  // Rematch voting status
  const yesVoters = rematchVotes.filter((v) => v.wantsToPlay);
  const currentUserVote = rematchVotes.find((v) => v.uid === currentUserUid);

  // Build player vote status list (all registered players)
  const playerVoteStatus = registeredPlayers.map((rp) => {
    const vote = rematchVotes.find((v) => v.uid === rp.uid);
    const playerData = players.find((p) => p.uid === rp.uid);
    return {
      uid: rp.uid,
      displayName: rp.displayName,
      isBot: playerData?.isBot || false,
      voted: !!vote,
      wantsToPlay: vote?.wantsToPlay || false,
    };
  });

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
    gameType === 'holdem' ? "Texas Hold'em" :
    gameType === 'single_draw_27' ? '2-7 Single Draw' : 'Kansas City Lowball';

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
              className="rounded-xl p-4 mb-4"
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

            {/* Rematch Voting Status */}
            {hasVoted && !restartTriggered && (
              <motion.div
                className="rounded-xl p-4 mb-4"
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(71, 85, 105, 0.3)',
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Play Again?</h3>
                <div className="space-y-1.5">
                  {playerVoteStatus.filter((p) => !p.isBot).map((p) => (
                    <div
                      key={p.uid}
                      className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-slate-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 text-sm">{p.displayName}</span>
                        {p.uid === currentUserUid && (
                          <span className="text-xs bg-purple-600 px-1.5 py-0.5 rounded text-white">
                            You
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        !p.voted
                          ? 'bg-slate-700 text-slate-400'
                          : p.wantsToPlay
                            ? 'bg-green-900/50 text-green-400 border border-green-500/30'
                            : 'bg-red-900/50 text-red-400 border border-red-500/30'
                      }`}>
                        {!p.voted ? 'Deciding...' : p.wantsToPlay ? 'In' : 'Out'}
                      </span>
                    </div>
                  ))}
                </div>
                {yesVoters.length >= 2 && (
                  <p className="text-green-400 text-xs mt-2 text-center">
                    {yesVoters.length} players ready - waiting for others
                  </p>
                )}
                {yesVoters.length < 2 && currentUserVote?.wantsToPlay && (
                  <p className="text-slate-400 text-xs mt-2 text-center">
                    Need at least 2 players to start
                  </p>
                )}
              </motion.div>
            )}

            {/* Rematch countdown */}
            {countdown !== null && countdown > 0 && hasVoted && !restartTriggered && (
              <motion.div
                className="text-center mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-slate-400 text-sm">
                  {currentUserVote?.wantsToPlay
                    ? 'Starting with ready players in '
                    : 'Leaving in '}
                  <span className="text-purple-300 font-bold text-lg">{countdown}s</span>
                </p>
              </motion.div>
            )}

            {/* Restarting indicator */}
            {restartTriggered && (
              <motion.div
                className="text-center mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-purple-300 font-semibold">Starting new tournament...</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div
              className="flex gap-3"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {!hasVoted && !restartTriggered ? (
                <>
                  <motion.button
                    type="button"
                    onClick={handleVoteNo}
                    whileTap={{ y: 2, boxShadow: '0 0px 0 rgba(51, 65, 85, 0.7), 0 1px 4px rgba(0, 0, 0, 0.15)' }}
                    className="flex-1 text-white font-semibold rounded-2xl flex items-center justify-center"
                    style={{
                      minHeight: '52px',
                      background: 'rgba(51, 65, 85, 0.6)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      boxShadow: '0 3px 0 rgba(51, 65, 85, 0.7), 0 5px 12px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    Leave Table
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleVoteYes}
                    whileTap={{ y: 4, boxShadow: '0 1px 0 #6d28d9, 0 3px 10px rgba(139, 92, 246, 0.2)' }}
                    className="flex-1 font-bold rounded-2xl flex items-center justify-center"
                    style={{
                      minHeight: '52px',
                      background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)',
                      color: 'white',
                      boxShadow: '0 5px 0 #6d28d9, 0 7px 18px rgba(139, 92, 246, 0.35)',
                    }}
                  >
                    Play Again
                  </motion.button>
                </>
              ) : (
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
                  Leave Table
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VictoryModal;
