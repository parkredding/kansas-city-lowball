import { useState, useEffect, useRef, useCallback, Component } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useGame, BetAction } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { PHASE_DISPLAY_NAMES } from '../game/usePokerGame';
import { MAX_PLAYERS } from '../game/constants';
import BuyInModal from '../components/BuyInModal';
import BettingControls from '../components/BettingControls';
import TurnTimer, { CircularTimer } from '../components/TurnTimer';
import UsernameModal from '../components/UsernameModal';
import CreateGameModal from '../components/CreateGameModal';
import JoinTableModal from '../components/JoinTableModal';
import ChatBox from '../components/ChatBox';
import ChipStack, { MiniChipStack, BetChip, PotDisplay } from '../components/ChipStack';
import { PositionIndicators } from '../components/PositionButtons';
import { useBotOrchestrator } from '../game/ai/useBotOrchestrator';
import { useTurnNotification, playNotificationSound } from '../hooks/useTurnNotification';
import { SoundManager } from '../audio/SoundManager';
import { MuckPile, DiscardAnimationOverlay, OpponentDiscardAnimation, useDiscardAnimation } from '../components/AnimatedCard';
import { CommunityCards } from '../components/CommunityCards';

/**
 * Error Boundary component to catch rendering errors and prevent white screens
 */
class GameErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GameTable Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-green-800 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <p className="text-gray-300 mb-4">
              An error occurred while rendering the game. Please try refreshing the page.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-6 rounded-lg"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SUIT_SYMBOLS = {
  h: { symbol: '\u2665', color: 'text-red-500' },
  d: { symbol: '\u2666', color: 'text-red-500' },
  c: { symbol: '\u2663', color: 'text-gray-900' },
  s: { symbol: '\u2660', color: 'text-gray-900' },
};

/**
 * Calculate radial position for a player seat around an oval table
 * Hero (current player) is always at position 0 (bottom center, 6 o'clock)
 * Other players are distributed clockwise around the table
 *
 * @param {number} relativeIndex - Position relative to hero (0 = hero, 1-5 = opponents clockwise)
 * @param {number} totalPlayers - Total number of players at the table
 * @returns {Object} - { left: string, top: string } as CSS percentage values
 */
function getRadialPosition(relativeIndex, totalPlayers) {
  // Hero is always at position 0 (bottom center) - handled separately
  if (relativeIndex === 0) {
    return { left: '50%', top: '88%' };
  }

  // For opponents, distribute them around the top portion of the oval
  const numOpponents = totalPlayers - 1;

  // Oval table dimensions (as percentages) - adjusted for better visibility
  const centerX = 50;
  const centerY = 42;

  // Radii - slightly reduced to keep players away from edges
  const radiusX = 38; // Horizontal radius (reduced from 42)
  const radiusY = 32; // Vertical radius (reduced from 35)

  // Calculate angle for this opponent
  // Start from left side and go clockwise to right side (covering top arc)
  const startAngle = 195; // Left side (in degrees)
  const endAngle = -15;   // Right side (in degrees)

  // Distribute opponents evenly along this arc
  const angleRange = startAngle - endAngle;
  const angleStep = angleRange / (numOpponents + 1);
  const angle = startAngle - (angleStep * relativeIndex);

  // Convert to radians
  const radians = (angle * Math.PI) / 180;

  // Calculate position on the oval
  const left = centerX + radiusX * Math.cos(radians);
  const top = centerY - radiusY * Math.sin(radians);

  return {
    left: `${left}%`,
    top: `${top}%`,
  };
}

/**
 * Get the relative seat index for a player, with hero at position 0
 * @param {number} playerSeatIndex - The player's actual seat index in the players array
 * @param {number} heroSeatIndex - The hero's seat index in the players array
 * @param {number} totalPlayers - Total number of players
 * @returns {number} - Relative index (0 = hero, 1-5 = opponents going clockwise)
 */
function getRelativeSeatIndex(playerSeatIndex, heroSeatIndex, totalPlayers) {
  return (playerSeatIndex - heroSeatIndex + totalPlayers) % totalPlayers;
}

/**
 * Professional card back design with elegant casino pattern
 */
function ProfessionalCardBack({ size = 'normal', index = 0, isDealing = false }) {
  const sizeClasses = size === 'small' 
    ? 'w-10 h-14' 
    : size === 'mini' 
    ? 'w-8 h-11' 
    : 'w-14 h-20';
  
  return (
    <motion.div
      className={`${sizeClasses} relative rounded-lg overflow-hidden`}
      initial={{ y: -80, opacity: 0, scale: 0.6, rotateY: 180 }}
      animate={{ 
        y: 0, 
        opacity: 1, 
        scale: 1, 
        rotateY: 0,
        transition: {
          type: 'spring',
          stiffness: 350,
          damping: 28,
          delay: isDealing ? index * 0.08 : 0,
        }
      }}
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f33 50%, #1e3a5f 100%)',
      }}
    >
      {/* Card border */}
      <div className="absolute inset-0.5 rounded-md border border-amber-600/30" />
      
      {/* Diamond pattern overlay */}
      <div 
        className="absolute inset-1 rounded opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(45deg, transparent 40%, rgba(212,175,55,0.15) 40%, rgba(212,175,55,0.15) 60%, transparent 60%),
            linear-gradient(-45deg, transparent 40%, rgba(212,175,55,0.15) 40%, rgba(212,175,55,0.15) 60%, transparent 60%)
          `,
          backgroundSize: '8px 8px',
        }}
      />
      
      {/* Center emblem */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="w-3/5 h-3/5 rounded-full border border-amber-500/40 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
          }}
        >
          <div className="text-amber-500/50 text-xs font-serif">♠</div>
        </div>
      </div>
      
      {/* Glossy highlight */}
      <div 
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
        }}
      />
    </motion.div>
  );
}

function Card({ card, isSelected, onClick, isSelectable, faceDown = false, index = 0, isDealing = false, size = 'normal' }) {
  if (faceDown) {
    return <ProfessionalCardBack size={size} index={index} isDealing={isDealing} />;
  }

  // Safety check for invalid card data - prevents white screen crashes
  if (!card || !card.suit || !card.rank) {
    return <ProfessionalCardBack size={size} index={index} isDealing={isDealing} />;
  }

  const suit = SUIT_SYMBOLS[card.suit];
  const sizeClasses = size === 'small' 
    ? 'w-10 h-14 text-sm' 
    : size === 'mini' 
    ? 'w-8 h-11 text-xs' 
    : 'w-14 h-20';
  const rankSize = size === 'small' ? 'text-base' : size === 'mini' ? 'text-xs' : 'text-xl';
  const suitSize = size === 'small' ? 'text-lg' : size === 'mini' ? 'text-sm' : 'text-2xl';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!isSelectable}
      className={`
        ${sizeClasses} rounded-lg flex flex-col items-center justify-center relative overflow-hidden
        ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-green-800' : ''}
        ${isSelectable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
      `}
      initial={{ y: -80, opacity: 0, scale: 0.6, rotateY: 180 }}
      animate={{ 
        y: isSelected ? -6 : 0, 
        opacity: 1, 
        scale: 1, 
        rotateY: 0,
        transition: {
          type: 'spring',
          stiffness: 350,
          damping: 28,
          delay: isDealing ? index * 0.08 : 0,
        }
      }}
      whileHover={isSelectable ? { 
        y: isSelected ? -8 : -3, 
        scale: 1.03,
        transition: { duration: 0.15 }
      } : {}}
      whileTap={isSelectable ? { scale: 0.97 } : {}}
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)',
        boxShadow: isSelected
          ? '0 8px 20px rgba(217,164,6,0.4), 0 4px 8px rgba(0,0,0,0.25)'
          : '0 3px 10px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
      }}
    >
      {/* Card content */}
      <motion.span 
        className={`${rankSize} font-bold ${suit.color} leading-none`}
        animate={isSelected ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.25 }}
      >
        {card.rank}
      </motion.span>
      <motion.span 
        className={`${suitSize} ${suit.color} leading-none -mt-0.5`}
        animate={isSelected ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        {suit.symbol}
      </motion.span>
      
      {/* Subtle inner border */}
      <div className="absolute inset-0.5 rounded-md border border-gray-200/50 pointer-events-none" />
    </motion.button>
  );
}

function CardBack({ size = 'small' }) {
  return <ProfessionalCardBack size={size} />;
}

function formatHandName(categoryName) {
  if (!categoryName) return '';
  return categoryName
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Enhanced Pot Display with proper staging area handling
 *
 * FIX: Chips now only appear in ONE place:
 * - During betting rounds: currentRoundBet chips appear ONLY near players (staging)
 * - The central pot displays only GATHERED chips (total pot - all currentRoundBets)
 * - This prevents the visual "duplication" bug
 *
 * Props:
 * - totalPot: The total pot amount in the game
 * - players: Array of players to calculate staged amounts
 * - isBettingPhase: Whether we're in a betting round (affects display)
 * - isGathering: Trigger gather animation when true
 */
function PotDisplayWithContribution({ totalPot, players = [], isBettingPhase = false, playerContribution = 0, size = 'lg' }) {
  // Calculate how much is currently "staged" (in front of players, not yet gathered)
  const stagedAmount = players.reduce((sum, p) => sum + (p?.currentRoundBet || 0), 0);

  // The "gathered" pot is what's already been collected from previous rounds
  // During betting, subtract the staged amount to avoid visual duplication
  const gatheredPot = isBettingPhase ? Math.max(0, totalPot - stagedAmount) : totalPot;

  // Don't show anything if gathered pot is 0
  if (gatheredPot <= 0) return null;

  const othersContribution = Math.max(0, gatheredPot - playerContribution);

  return (
    <motion.div
      className="flex flex-col items-center"
      layout
    >
      <ChipStack amount={gatheredPot} size={size} showAmount={false} animate={true} />
      <motion.div
        className="bg-amber-900/95 px-4 py-2 rounded-lg shadow-lg mt-2 border border-amber-700/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-100 font-bold text-lg">
            ${gatheredPot.toLocaleString()}
          </span>
          {stagedAmount > 0 && isBettingPhase && (
            <span className="text-amber-300/60 text-xs">
              (+${stagedAmount.toLocaleString()} staged)
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Show/Muck Buttons Component
 * Handles the "Show Bluff" button for uncontested wins and "Show Hand" for losers
 */
function ShowMuckButtons({
  showdownResult,
  currentUserUid,
  currentPlayer,
  onRevealHand,
  isDesktop
}) {
  const [showBluffTimer, setShowBluffTimer] = useState(5);
  const [showBluffExpired, setShowBluffExpired] = useState(false);

  // Check if current user is the winner
  const isWinner = showdownResult?.winners?.some(w => w.uid === currentUserUid);
  const isUncontested = showdownResult?.isContested === false;
  const isLoser = !isWinner && showdownResult?.losers?.some(l => l.uid === currentUserUid);

  // Check if hand is already revealed
  const handRevealed = currentPlayer?.handRevealed || false;

  // Timer for "Show Bluff" button (5 seconds for uncontested wins)
  useEffect(() => {
    if (isWinner && isUncontested && !handRevealed && !showBluffExpired) {
      const interval = setInterval(() => {
        setShowBluffTimer(prev => {
          if (prev <= 1) {
            setShowBluffExpired(true);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWinner, isUncontested, handRevealed, showBluffExpired]);

  // Reset timer when showdown result changes
  useEffect(() => {
    setShowBluffTimer(5);
    setShowBluffExpired(false);
  }, [showdownResult]);

  // Don't show anything if hand is already revealed or not applicable
  if (handRevealed) return null;

  // Scenario A: Uncontested win - show "Show Bluff" button
  if (isWinner && isUncontested && !showBluffExpired) {
    return (
      <motion.button
        type="button"
        onClick={onRevealHand}
        className={`
          bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500
          text-white font-bold rounded-xl shadow-lg transition-all
          ${isDesktop ? 'py-3 px-6 text-base' : 'py-4 px-8 text-lg min-h-[56px]'}
        `}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2 justify-center">
          <span>Show Bluff</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
            {showBluffTimer}s
          </span>
        </div>
      </motion.button>
    );
  }

  // Scenario B: Loser at contested showdown - show "Show Hand" button
  if (isLoser && showdownResult?.isContested) {
    return (
      <motion.button
        type="button"
        onClick={onRevealHand}
        className={`
          bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600
          text-white font-bold rounded-xl shadow-lg transition-all
          ${isDesktop ? 'py-3 px-6 text-base' : 'py-4 px-8 text-lg min-h-[56px]'}
        `}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Show Hand
      </motion.button>
    );
  }

  return null;
}

/**
 * Showdown Result Display - Shows the winner announcement prominently
 * Shows total pot won and actual gain (pot minus their own contribution)
 * Winners at contested showdowns have cards auto-revealed
 */
function ShowdownResultDisplay({ showdownResult, isDesktop, currentUserUid, players }) {
  if (!showdownResult || !showdownResult.winners || showdownResult.winners.length === 0) {
    return null;
  }

  const winner = showdownResult.winners[0];
  const isSplit = showdownResult.winners.length > 1;
  const isContested = showdownResult.isContested;

  // Calculate the winner's contribution to the pot
  const winnerPlayer = players?.find(p => p.uid === winner.uid);
  const winnerContribution = winnerPlayer?.totalContribution || 0;
  const actualGain = winner.amount - winnerContribution;

  // Check if current user is the winner
  const isCurrentUserWinner = showdownResult.winners.some(w => w.uid === currentUserUid);

  return (
    <motion.div
      className={`
        bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600
        rounded-xl shadow-2xl border-2 border-yellow-300
        ${isDesktop ? 'px-6 py-4' : 'px-4 py-3'}
      `}
      initial={{ scale: 0, opacity: 0, y: -20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        boxShadow: '0 0 40px rgba(251,191,36,0.5), 0 8px 30px rgba(0,0,0,0.4)',
      }}
    >
      {/* Winner crown icon */}
      <div className="flex justify-center mb-2">
        <span className="text-3xl">👑</span>
      </div>

      {/* Winner name */}
      <div className="text-center">
        <p className={`font-bold text-gray-900 ${isDesktop ? 'text-xl' : 'text-lg'}`}>
          {isSplit
            ? showdownResult.winners.map(w => w.displayName).join(' & ')
            : winner.displayName}
        </p>
        <p className={`text-gray-800 ${isDesktop ? 'text-sm' : 'text-xs'} mt-1`}>
          {isContested ? (isSplit ? 'split the pot' : 'wins') : 'wins (uncontested)'}
        </p>
      </div>

      {/* Winning hand description - only show for contested showdowns */}
      {isContested && winner.handDescription && (
        <div className="text-center mt-2">
          <span className="inline-block bg-gray-900/20 px-3 py-1 rounded-full">
            <span className={`font-semibold text-gray-900 ${isDesktop ? 'text-base' : 'text-sm'}`}>
              {winner.handDescription || formatHandName(winner.handResult?.categoryName)}
            </span>
          </span>
        </div>
      )}

      {/* Amount won - show pot total and actual gain */}
      <div className="text-center mt-3">
        <span className={`font-bold text-gray-900 ${isDesktop ? 'text-2xl' : 'text-xl'}`}>
          ${winner.amount.toLocaleString()}
        </span>
        {/* Show actual gain for the winner (pot - their contribution) */}
        {actualGain !== winner.amount && (
          <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-gray-800 mt-1`}>
            {actualGain > 0 ? (
              <span className="bg-green-800/30 px-2 py-0.5 rounded-full">
                +${actualGain.toLocaleString()} profit
              </span>
            ) : actualGain === 0 ? (
              <span className="bg-gray-800/20 px-2 py-0.5 rounded-full">
                Break even
              </span>
            ) : (
              <span className="bg-gray-800/20 px-2 py-0.5 rounded-full">
                ${Math.abs(actualGain).toLocaleString()} returned
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PhaseIndicator({ phase }) {
  const displayName = PHASE_DISPLAY_NAMES[phase] || phase;

  const isBetting = phase?.startsWith('BETTING_');
  const isDraw = phase?.startsWith('DRAW_');
  const isShowdown = phase === 'SHOWDOWN';
  const isIdle = phase === 'IDLE';
  const isCutForDealer = phase === 'CUT_FOR_DEALER';

  let bgColors = { from: 'from-slate-600', to: 'to-slate-700', border: 'border-slate-500/50' };
  if (isBetting) bgColors = { from: 'from-blue-600', to: 'to-blue-700', border: 'border-blue-400/50' };
  if (isDraw) bgColors = { from: 'from-violet-600', to: 'to-violet-700', border: 'border-violet-400/50' };
  if (isShowdown) bgColors = { from: 'from-amber-500', to: 'to-amber-600', border: 'border-amber-400/50' };
  if (isCutForDealer) bgColors = { from: 'from-emerald-600', to: 'to-emerald-700', border: 'border-emerald-400/50' };

  return (
    <motion.div
      className={`bg-gradient-to-r ${bgColors.from} ${bgColors.to} px-4 py-1.5 rounded-full shadow-lg border ${bgColors.border}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
    >
      <span className="text-white font-semibold text-xs tracking-wide">
        {displayName}
      </span>
    </motion.div>
  );
}

/**
 * Cut for Dealer Display - Shows cut cards for each player
 * Highlights the winning card with the highest rank (Ace high)
 * Tie-breaker: Spades > Hearts > Diamonds > Clubs
 */
function CutForDealerDisplay({ players, winnerIndex, onResolve, isResolved }) {
  const SUIT_PRIORITY = { s: 4, h: 3, d: 2, c: 1 };
  const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };

  // Find the winning card
  let highestIndex = -1;
  let highestRank = 0;
  let highestSuit = 0;

  players.forEach((player, index) => {
    if (player.cutCard) {
      const rank = RANK_VALUES[player.cutCard.rank] || 0;
      const suit = SUIT_PRIORITY[player.cutCard.suit] || 0;

      if (rank > highestRank || (rank === highestRank && suit > highestSuit)) {
        highestRank = rank;
        highestSuit = suit;
        highestIndex = index;
      }
    }
  });

  return (
    <motion.div
      className="bg-gradient-to-r from-emerald-900/95 to-emerald-950/95 rounded-2xl p-6 shadow-2xl border-2 border-emerald-500/50"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        boxShadow: '0 0 60px rgba(16,185,129,0.3), 0 8px 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-emerald-100">Cut for Dealer</h2>
        <p className="text-emerald-300/70 text-sm">Highest card wins the button</p>
      </div>

      {/* Cut Cards Grid */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {players.map((player, index) => {
          if (!player.cutCard) return null;
          const isWinner = index === highestIndex;
          const suit = SUIT_SYMBOLS[player.cutCard.suit];

          return (
            <motion.div
              key={player.uid}
              className={`flex flex-col items-center gap-2 ${isWinner ? '' : 'opacity-70'}`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: isWinner ? 1 : 0.7 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Player name */}
              <span className={`text-xs font-medium ${isWinner ? 'text-yellow-400' : 'text-slate-300'}`}>
                {player.displayName}
              </span>

              {/* Cut Card */}
              <motion.div
                className={`
                  w-16 h-22 rounded-lg flex flex-col items-center justify-center relative overflow-hidden
                  ${isWinner ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-emerald-900' : ''}
                `}
                animate={isWinner ? {
                  boxShadow: [
                    '0 0 20px rgba(250,204,21,0.5)',
                    '0 0 40px rgba(250,204,21,0.7)',
                    '0 0 20px rgba(250,204,21,0.5)',
                  ],
                } : {}}
                transition={isWinner ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
                style={{
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)',
                  boxShadow: isWinner
                    ? '0 8px 25px rgba(250,204,21,0.4)'
                    : '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <span className={`text-2xl font-bold ${suit.color} leading-none`}>
                  {player.cutCard.rank}
                </span>
                <span className={`text-3xl ${suit.color} leading-none -mt-1`}>
                  {suit.symbol}
                </span>
              </motion.div>

              {/* Winner badge */}
              {isWinner && (
                <motion.span
                  className="text-xs bg-yellow-500 text-gray-900 px-2 py-0.5 rounded-full font-bold"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                >
                  DEALER
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Continue Button */}
      {!isResolved && (
        <motion.button
          type="button"
          onClick={onResolve}
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-900 font-bold py-3 px-6 rounded-xl shadow-lg transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          Start Game
        </motion.button>
      )}
    </motion.div>
  );
}

function ChipDisplay({ label, amount, variant = 'default' }) {
  const bgColor = variant === 'pot' ? 'bg-yellow-600' : 'bg-gray-700';

  return (
    <div className={`${bgColor} px-4 py-2 rounded-lg shadow`}>
      <span className="text-gray-300 text-sm">{label}: </span>
      <span className="text-white font-bold">${amount}</span>
    </div>
  );
}

function WalletDisplay({ balance, loading }) {
  return (
    <div className="bg-emerald-800/60 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 border border-emerald-600/40">
      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
      </svg>
      <span className="text-emerald-100 font-bold text-sm">
        {loading ? '...' : `$${(balance || 0).toLocaleString()}`}
      </span>
    </div>
  );
}

/**
 * Badge component for dealer/blind positions - Refined casino style
 */
function PositionBadge({ type }) {
  const badges = {
    dealer: { label: 'D', bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-300', title: 'Dealer' },
    sb: { label: 'SB', bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-300', title: 'Small Blind' },
    bb: { label: 'BB', bg: 'bg-amber-500', text: 'text-slate-900', border: 'border-amber-300', title: 'Big Blind' },
  };

  const badge = badges[type];
  if (!badge) return null;

  return (
    <div
      className={`${badge.bg} ${badge.text} w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md border ${badge.border}`}
      title={badge.title}
      style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
    >
      {badge.label}
    </div>
  );
}

/**
 * Calculate bet chip position between player and center
 * Returns { x, y } as percentage offsets from center
 */
function getBetChipPosition(relativeIndex, totalPlayers) {
  if (relativeIndex === 0) {
    // Hero's bet - slightly above center
    return { x: '50%', y: '70%' };
  }

  // Get player position and calculate midpoint to center
  const playerPos = getRadialPosition(relativeIndex, totalPlayers);
  const centerX = 50;
  const centerY = 45;

  const playerX = parseFloat(playerPos.left);
  const playerY = parseFloat(playerPos.top);

  // Position bets 40% of the way from player to center
  const betX = playerX + (centerX - playerX) * 0.45;
  const betY = playerY + (centerY - playerY) * 0.45;

  return { x: `${betX}%`, y: `${betY}%` };
}

function PlayerSlot({ player, isCurrentUser, isActive, showCards, handResult, turnDeadline, isDealer, isSmallBlind, isBigBlind, isViewerRailbird = false, canKick = false, onKick, showdownResult = null, isMobile = false }) {
  // Determine if this player's cards should actually be shown at showdown
  const isWinner = showdownResult?.winners?.some(w => w.uid === player.uid);
  const isContested = showdownResult?.isContested;

  // Cards are visible if:
  // 1. General showCards is true (showdown phase)
  // 2. AND either:
  //    a. Winner at contested showdown (auto-reveal)
  //    b. Player manually revealed their hand (handRevealed)
  const shouldRevealCards = showCards && (
    (isWinner && isContested) || // Winner at contested showdown
    player.handRevealed // Player chose to show
  );

  const statusConfig = {
    active: { border: 'border-emerald-500/70', bg: 'from-slate-800/95 to-slate-900/95' },
    folded: { border: 'border-slate-600/50', bg: 'from-slate-800/50 to-slate-900/50', opacity: 'opacity-60' },
    'all-in': { border: 'border-amber-500/70', bg: 'from-slate-800/95 to-slate-900/95' },
    'sitting_out': { border: 'border-slate-700/40', bg: 'from-slate-800/40 to-slate-900/40', opacity: 'opacity-40' },
  };

  const config = statusConfig[player.status] || statusConfig.active;

  // Enhanced Active Turn highlight: Dim inactive players
  const inactiveOpacity = !isActive && player.status === 'active' ? 'opacity-80' : '';

  return (
    <motion.div
      className={`
        relative rounded-xl p-2.5 border backdrop-blur-sm
        ${isMobile ? 'min-w-[115px] max-w-[150px]' : 'min-w-[140px] max-w-[180px]'}
        ${isActive ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-green-900' : ''}
        ${config.border} ${config.opacity || ''} ${inactiveOpacity}
        transition-opacity duration-300
      `}
      animate={isActive ? {
        boxShadow: [
          '0 0 20px rgba(250,204,21,0.4), 0 0 40px rgba(250,204,21,0.2)',
          '0 0 30px rgba(250,204,21,0.5), 0 0 60px rgba(250,204,21,0.3)',
          '0 0 20px rgba(250,204,21,0.4), 0 0 40px rgba(250,204,21,0.2)',
        ],
      } : {
        boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
      }}
      transition={isActive ? {
        boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
      } : { duration: 0.25 }}
      style={{
        background: `linear-gradient(135deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.95) 100%)`,
      }}
    >
      {/* Position badges (Dealer/SB/BB) - repositioned */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1 z-20">
        {isDealer && <PositionBadge type="dealer" />}
        {isSmallBlind && <PositionBadge type="sb" />}
        {isBigBlind && <PositionBadge type="bb" />}
      </div>

      {/* Circular timer when active */}
      {isActive && turnDeadline && (
        <div className="absolute -top-1 -right-1 z-30">
          <CircularTimer turnDeadline={turnDeadline} size={32} isActive={isActive} />
        </div>
      )}

      {/* Player info row - compact */}
      <div className="flex items-center gap-2 mb-2">
        {/* Avatar with enhanced active glow */}
        <div className="relative flex-shrink-0">
          {player.photoURL ? (
            <motion.img
              src={player.photoURL}
              alt={player.displayName}
              className={`w-7 h-7 rounded-full ${isActive ? 'ring-2 ring-yellow-400' : 'border border-slate-600'}`}
              animate={isActive ? {
                boxShadow: [
                  '0 0 0px rgba(250,204,21,0.6)',
                  '0 0 12px rgba(250,204,21,0.8)',
                  '0 0 0px rgba(250,204,21,0.6)',
                ],
              } : {}}
              transition={isActive ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
            />
          ) : (
            <motion.div
              className={`w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center ${isActive ? 'ring-2 ring-yellow-400' : 'border border-slate-500'}`}
              animate={isActive ? {
                boxShadow: [
                  '0 0 0px rgba(250,204,21,0.6)',
                  '0 0 12px rgba(250,204,21,0.8)',
                  '0 0 0px rgba(250,204,21,0.6)',
                ],
              } : {}}
              transition={isActive ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
            >
              <span className="text-white text-xs font-medium">
                {player.displayName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </motion.div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* Player name with pulse animation when active */}
          <motion.p
            className={`text-xs font-semibold truncate ${isCurrentUser ? 'text-amber-400' : 'text-slate-100'}`}
            animate={isActive ? {
              textShadow: [
                '0 0 0px rgba(250,204,21,0)',
                '0 0 8px rgba(250,204,21,0.8)',
                '0 0 0px rgba(250,204,21,0)',
              ],
            } : {}}
            transition={isActive ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            {player.displayName}
          </motion.p>
          <p className="text-xs text-emerald-400 font-medium whitespace-nowrap overflow-visible">${player.chips.toLocaleString()}</p>
        </div>
      </div>

      {/* Status badges row */}
      <div className="flex items-center justify-center gap-1 mb-2 min-h-[20px]">
        {player.lastAction && (
          <span className="text-[10px] bg-violet-600/90 text-white font-medium px-1.5 py-0.5 rounded-full">
            {player.lastAction}
          </span>
        )}
        {player.currentRoundBet > 0 && (
          <span className="text-[10px] bg-amber-600/90 text-white font-medium px-1.5 py-0.5 rounded-full">
            ${player.currentRoundBet}
          </span>
        )}
        {player.status === 'folded' && (
          <span className="text-[10px] bg-slate-600/90 text-slate-300 px-1.5 py-0.5 rounded-full">
            Folded
          </span>
        )}
        {player.status === 'all-in' && (
          <span className="text-[10px] bg-violet-600/90 text-white px-1.5 py-0.5 rounded-full animate-pulse">
            All-In
          </span>
        )}
      </div>

      {/* Player's cards - clean display with safety checks */}
      {/* Cards shown based on showdown rules: winners at contested showdown auto-reveal, others must choose to show */}
      {/* Railbirds can see revealed cards at showdown */}
      {player.hand && Array.isArray(player.hand) && player.hand.length > 0 && (
        <div className={`flex gap-0.5 justify-center ${isMobile ? 'scale-90' : ''}`}>
          {player.hand.map((card, index) => (
            shouldRevealCards && card && card.rank && card.suit ? (
              <Card key={`${index}-${card.rank}-${card.suit}`} card={card} isSelectable={false} size="mini" />
            ) : (
              <ProfessionalCardBack key={index} size="mini" index={index} />
            )
          ))}
        </div>
      )}

      {/* Kick bot button (only for table creator when game is IDLE) */}
      {canKick && player.isBot && (
        <motion.button
          type="button"
          onClick={(e) => onKick?.(player.uid, e)}
          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg z-30"
          title="Remove bot"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          ×
        </motion.button>
      )}

      {/* Hand result at showdown - only show if cards are revealed */}
      {handResult && shouldRevealCards && (
        <div className="mt-1.5 text-center">
          <p className="text-[10px] text-amber-400 font-medium bg-amber-950/50 rounded px-1 py-0.5">
            {formatHandName(handResult.categoryName)}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function LobbyView() {
  const { createTable, joinTable, loading, error, setError, userWallet, walletLoading, needsUsername, updateUsername } = useGame();
  const { logout } = useAuth();
  const [tableIdInput, setTableIdInput] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showCreateGameModal, setShowCreateGameModal] = useState(false);
  const [showJoinTableModal, setShowJoinTableModal] = useState(false);

  // Show username modal if user needs to set username
  useEffect(() => {
    if (needsUsername && !walletLoading) {
      setShowUsernameModal(true);
    }
  }, [needsUsername, walletLoading]);

  // Run stale table cleanup on lobby load (rate-limited to once per 5 minutes)
  useEffect(() => {
    const runCleanup = async () => {
      // Import dynamically to avoid circular dependencies
      const { GameService } = await import('../game/GameService');

      if (GameService.shouldRunCleanup()) {
        console.log('[Lobby] Running stale table cleanup...');
        const result = await GameService.cleanupStaleTables();
        GameService.markCleanupRun();

        if (result.cleaned > 0) {
          console.log(`[Lobby] Cleaned up ${result.cleaned} stale tables`);
        }
        if (result.errors.length > 0) {
          console.warn('[Lobby] Cleanup errors:', result.errors);
        }
      }
    };

    runCleanup();
  }, []);

  const handleCreateTable = () => {
    setShowCreateGameModal(true);
  };

  const handleCreateTableWithConfig = async (config) => {
    const tableId = await createTable(config);
    // Return tableId so modal can check if creation was successful
    return tableId;
  };

  const handleJoinTable = () => {
    if (!tableIdInput.trim()) {
      setError('Please enter a table ID');
      return;
    }
    setShowJoinTableModal(true);
  };

  const handleJoinTableWithPassword = async (tableId, password) => {
    const result = await joinTable(tableId, password);
    if (result) {
      setShowJoinTableModal(false);
      setTableIdInput('');
    }
    return result;
  };

  const handleSaveUsername = async (username) => {
    await updateUsername(username);
    setShowUsernameModal(false);
  };

  return (
    <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center gap-6 p-4">
      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal || needsUsername}
        onClose={() => setShowUsernameModal(false)}
        onSave={handleSaveUsername}
        currentUsername={userWallet?.username}
        isRequired={needsUsername}
        loading={loading}
      />

      {/* Create Game Modal */}
      <CreateGameModal
        isOpen={showCreateGameModal}
        onClose={() => setShowCreateGameModal(false)}
        onCreate={handleCreateTableWithConfig}
        loading={loading}
      />

      {/* Join Table Modal */}
      <JoinTableModal
        isOpen={showJoinTableModal}
        onClose={() => {
          setShowJoinTableModal(false);
          setError('');
        }}
        onJoin={handleJoinTableWithPassword}
        tableId={tableIdInput}
        loading={loading}
        error={error}
      />

      <h1 className="text-4xl font-bold text-white">Kansas City Lowball</h1>
      <p className="text-gray-300">2-7 Triple Draw Poker</p>

      {/* User Display with Edit Button */}
      <div className="flex items-center gap-3">
        <WalletDisplay balance={userWallet?.balance} loading={walletLoading} />
        {userWallet?.username && (
          <div className="bg-gray-700 px-3 py-2 rounded-lg flex items-center gap-2">
            <span className="text-gray-300 text-sm">Playing as:</span>
            <span className="text-yellow-400 font-medium">{userWallet.username}</span>
            <button
              type="button"
              onClick={() => setShowUsernameModal(true)}
              className="text-gray-400 hover:text-white ml-1"
              title="Edit username"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-semibold text-white mb-6 text-center">
          Join or Create a Table
        </h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Create Table */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleCreateTable}
            disabled={loading || needsUsername}
            className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Create New Table'}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">or</span>
          </div>
        </div>

        {/* Join Table */}
        <div className="space-y-3">
          <input
            type="text"
            value={tableIdInput}
            onChange={(e) => setTableIdInput(e.target.value.toUpperCase())}
            placeholder="Enter Table ID"
            maxLength={6}
            className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-center text-xl tracking-widest uppercase"
          />
          <button
            type="button"
            onClick={handleJoinTable}
            disabled={loading || !tableIdInput.trim() || needsUsername}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
          >
            {loading ? 'Joining...' : 'Join Table'}
          </button>
        </div>

        {needsUsername && (
          <p className="text-yellow-400 text-sm text-center mt-4">
            Please set your username to continue
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={logout}
        className="text-gray-400 hover:text-white text-sm underline"
      >
        Sign Out
      </button>
    </div>
  );
}

function GameView() {
  const { currentUser } = useAuth();
  const {
    currentTableId,
    tableData,
    loading,
    error,
    isBettingPhase,
    isDrawPhase,
    isShowdown,
    isIdle,
    isCutForDealer,
    userWallet,
    walletLoading,
    needsUsername,
    leaveTable,
    dealCards,
    buyIn,
    performBetAction,
    submitDraw,
    startNextHand,
    handleTimeout,
    sendChatMessage,
    updateUsername,
    getCurrentPlayer,
    isMyTurn,
    getActivePlayer,
    evaluateHand,
    getCallAmount,
    getMinRaise,
    canCheck,
    getDisplayName,
    BetAction,
    // Railbird-related
    isRailbird,
    canBecomePlayer,
    joinAsPlayer,
    isTableCreator,
    kickBot,
    addBot,
    // Sit out
    requestSitOut,
    cancelSitOut,
    hasPendingSitOut,
    // Cut for dealer
    resolveCutForDealer,
    // Show/Muck
    revealHand,
    // Hold'em specific
    isHoldem,
    gameType,
  } = useGame();

  const [selectedCardIndices, setSelectedCardIndices] = useState(new Set());
  const [showBuyInModal, setShowBuyInModal] = useState(false);
  const [hasDismissedBuyIn, setHasDismissedBuyIn] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Helper to show toast notification
  const showToast = (message, type = 'error') => {
    setToast({ message, type });
  };

  const currentPlayer = getCurrentPlayer();
  const activePlayer = getActivePlayer();
  const myTurn = isMyTurn();
  const callAmount = getCallAmount();
  const minRaise = getMinRaise();
  const playerCanCheck = canCheck();
  
  // Railbird status
  const userIsRailbird = isRailbird();
  const userCanBecomePlayer = canBecomePlayer();
  const userIsTableCreator = isTableCreator();
  const railbirds = tableData?.railbirds || [];

  // Sit out status
  const playerHasPendingSitOut = hasPendingSitOut();

  // Turn notification - plays audio cue when it becomes player's turn
  useTurnNotification(myTurn, tableData?.phase);

  // Track previous phase for detecting phase transitions
  const prevPhaseRef = useRef(tableData?.phase);

  // Deal sound - plays when cards are dealt (phase transitions to BETTING_1)
  useEffect(() => {
    const currentPhase = tableData?.phase;
    const prevPhase = prevPhaseRef.current;

    // Detect deal: transitioning from IDLE to BETTING_1
    if (prevPhase === 'IDLE' && currentPhase === 'BETTING_1') {
      playNotificationSound('deal');
    }

    // Detect showdown: play win/loss sound based on result
    if (currentPhase === 'SHOWDOWN' && prevPhase !== 'SHOWDOWN') {
      // Small delay to let the UI update first
      setTimeout(() => {
        const showdownResult = tableData?.showdownResult;
        if (showdownResult?.winners && currentUser) {
          const isWinner = showdownResult.winners.some(w => w.uid === currentUser.uid);
          const currentPlayerFolded = currentPlayer?.status === 'folded';
          
          if (isWinner) {
            playNotificationSound('win');
          } else if (!currentPlayerFolded) {
            // Only play lose sound if player didn't fold (they saw it through)
            playNotificationSound('lose');
          }
        }
      }, 300);
    }

    prevPhaseRef.current = currentPhase;
  }, [tableData?.phase, tableData?.showdownResult, currentUser, currentPlayer?.status]);

  // Bot orchestrator - runs in table creator's browser
  useBotOrchestrator(
    tableData,
    currentTableId,
    currentUser?.uid,
    tableData?.createdBy
  );

  // Get hero's seat index and total players for radial positioning
  const heroSeatIndex = tableData?.players?.findIndex((p) => p.uid === currentUser?.uid) ?? 0;
  const totalPlayers = tableData?.players?.length || 1;

  // Get opponents with their relative seat positions for radial layout
  const opponentsWithPositions = (tableData?.players || [])
    .map((player, seatIndex) => ({
      ...player,
      seatIndex,
      relativeIndex: getRelativeSeatIndex(seatIndex, heroSeatIndex, totalPlayers),
    }))
    .filter((p) => p.uid !== currentUser?.uid)
    .sort((a, b) => a.relativeIndex - b.relativeIndex);

  // Use actual seat indices stored in table data for dealer/blinds
  const dealerSeatIndex = tableData?.dealerSeatIndex;
  const smallBlindSeatIndex = tableData?.smallBlindSeatIndex;
  const bigBlindSeatIndex = tableData?.bigBlindSeatIndex;

  // Helper to check if a player is at a specific position
  // Note: All position badges are shown to ALL players (including the hero)
  // In heads-up (2 players), dealer is also SB so we only show D (not both D and SB)
  const isDealer = (seatIndex) => dealerSeatIndex !== null && dealerSeatIndex !== undefined && seatIndex === dealerSeatIndex;
  const isSmallBlind = (seatIndex) => {
    if (smallBlindSeatIndex === null || smallBlindSeatIndex === undefined) return false;
    if (seatIndex !== smallBlindSeatIndex) return false;
    // In heads-up, dealer is also SB - only show D button (not both)
    if (totalPlayers <= 2) return false;
    return true;
  };
  const isBigBlind = (seatIndex) => bigBlindSeatIndex !== null && bigBlindSeatIndex !== undefined && seatIndex === bigBlindSeatIndex;

  // Detect desktop mode
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Check if player needs to buy in
  const needsBuyIn = currentPlayer?.chips === 0;

  // Reset the dismissed flag when player has chips (successful buy-in was processed)
  useEffect(() => {
    if (!needsBuyIn && hasDismissedBuyIn) {
      setHasDismissedBuyIn(false);
    }
  }, [needsBuyIn, hasDismissedBuyIn]);

  // Auto-show buy-in modal when joining with no chips (only if not already dismissed)
  useEffect(() => {
    if (needsBuyIn && isIdle && !showBuyInModal && !hasDismissedBuyIn) {
      setShowBuyInModal(true);
    }
  }, [needsBuyIn, isIdle, showBuyInModal, hasDismissedBuyIn]);

  const toggleCardSelection = (index) => {
    if (!isDrawPhase || !myTurn) return;

    setSelectedCardIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSubmitDraw = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const indices = Array.from(selectedCardIndices);

    // Play whoosh sound for discard
    if (indices.length > 0) {
      SoundManager.playWhoosh();
    }

    await submitDraw(indices);
    setSelectedCardIndices(new Set());
  };

  const handleDeal = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Play deal sound (cut for dealer plays a different sound)
    if (!tableData?.hasHadFirstDeal) {
      SoundManager.playCutForDealer();
    } else {
      SoundManager.playDeal(5);
    }
    await dealCards();
  };

  // Handler to resolve cut for dealer and start the actual game
  const handleResolveCutForDealer = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    // Resolve the cut and determine dealer
    await resolveCutForDealer();
    // Small delay then deal the actual hand
    setTimeout(async () => {
      SoundManager.playDeal(5);
      await dealCards();
    }, 500);
  };

  const handleBuyIn = async (amount) => {
    const success = await buyIn(amount);
    if (success) {
      setHasDismissedBuyIn(true);
      // Play chip sound on successful buy-in
      SoundManager.playChipClack();
    }
    return success;
  };

  const handleCloseBuyInModal = () => {
    setShowBuyInModal(false);
    setHasDismissedBuyIn(true);
  };

  const handleSaveUsername = async (username) => {
    await updateUsername(username);
    setShowUsernameModal(false);
  };

  // Betting action handlers with toast feedback on error AND sound effects
  const handleFold = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.FOLD);
    if (result.success) {
      SoundManager.playFold();
    } else {
      showToast(result.error);
    }
  };

  const handleCheck = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.CHECK);
    if (result.success) {
      SoundManager.playCheck();
    } else {
      showToast(result.error);
    }
  };

  const handleCall = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.CALL);
    if (result.success) {
      SoundManager.playChipClack();
    } else {
      showToast(result.error);
    }
  };

  const handleRaise = async (amount, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.RAISE, amount);
    if (result.success) {
      SoundManager.playChipClack();
    } else {
      showToast(result.error);
    }
  };

  const handleAllIn = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.ALL_IN);
    if (result.success) {
      // Multiple chip clacks for dramatic all-in
      SoundManager.playChipClack();
      setTimeout(() => SoundManager.playChipClack(), 100);
      setTimeout(() => SoundManager.playChipClack(), 200);
    } else {
      showToast(result.error);
    }
  };

  // Handler for railbird to join as player
  const handleJoinAsPlayer = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const success = await joinAsPlayer();
    if (success) {
      showToast('You are now a player!', 'success');
    }
  };

  // Handler for player to sit out
  const handleSitOut = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await requestSitOut();
    if (result.success) {
      if (result.immediate) {
        showToast('You are now watching as a spectator', 'success');
      } else {
        showToast('You will sit out after this hand ends', 'success');
      }
    }
  };

  // Handler to cancel pending sit out
  const handleCancelSitOut = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const success = await cancelSitOut();
    if (success) {
      showToast('Sit out cancelled - you will stay in the game', 'success');
    }
  };

  // Handler to kick a bot
  const handleKickBot = async (botUid, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const success = await kickBot(botUid);
    if (success) {
      showToast('Bot removed from table', 'success');
    }
  };

  // Handler to add a bot player
  const handleAddBot = async (difficulty = 'hard') => {
    const bot = await addBot(difficulty);
    if (bot) {
      const isWaiting = bot.waitingForNextHand;
      showToast(
        isWaiting
          ? `${bot.displayName} will join next hand`
          : `${bot.displayName} joined the table`,
        'success'
      );
    }
  };

  // Handler to reveal hand at showdown (show instead of muck)
  const handleRevealHand = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const success = await revealHand();
    if (success) {
      SoundManager.playCardFlip && SoundManager.playCardFlip();
    }
  };

  // Evaluate hands at showdown
  const playerHandResult = isShowdown && currentPlayer?.hand
    ? evaluateHand(currentPlayer.hand)
    : null;

  // Check if we have enough players with chips to start
  const playersWithChips = tableData?.players?.filter((p) => p.chips > 0)?.length || 0;
  const canStartGame = playersWithChips >= 2;

  // Desktop layout component for action controls - Enhanced styling
  const ActionControlsSidebar = () => (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto min-h-0">
      <h3 className="text-slate-200 font-semibold text-center border-b border-slate-700/50 pb-2 flex-shrink-0 text-sm">Actions</h3>

      {/* Railbird Status Banner */}
      {userIsRailbird && (
        <motion.div
          className="bg-violet-900/50 border border-violet-600/50 rounded-lg p-3 flex-shrink-0"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-violet-400 text-lg">👁️</span>
            <span className="text-violet-200 font-medium text-sm">Watching as Railbird</span>
          </div>
          <p className="text-violet-300/70 text-xs mb-2">
            You can chat but cannot see card values to prevent collusion.
          </p>
          {userCanBecomePlayer && (
            <motion.button
              type="button"
              onClick={handleJoinAsPlayer}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Join as Player
            </motion.button>
          )}
          {!userCanBecomePlayer && !isIdle && (
            <p className="text-violet-300/60 text-xs italic">
              Wait for the current hand to finish to join as a player.
            </p>
          )}
          {!userCanBecomePlayer && isIdle && tableData?.players?.length >= 6 && (
            <p className="text-violet-300/60 text-xs italic">
              Table is full. A seat must open for you to join.
            </p>
          )}
        </motion.div>
      )}

      {/* Turn Timer - Passive Timer System
          Any player can claim timeout after grace period (anti-hang protection) */}
      {tableData?.turnDeadline && (isBettingPhase || isDrawPhase) && !userIsRailbird && (
        <div className="flex-shrink-0">
          <TurnTimer
            turnDeadline={tableData.turnDeadline}
            onTimeout={handleTimeout}
            isMyTurn={myTurn}
            canTriggerTimeout={tableData?.createdBy === currentUser?.uid && activePlayer?.isBot}
            isAtTable={true}
          />
        </div>
      )}

      {/* Chip Displays - More compact grid (only for players) */}
      {!userIsRailbird && (
        <div className="grid grid-cols-1 gap-2 flex-shrink-0">
          <div className="bg-slate-800/80 rounded-lg p-2.5 text-center border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Your Chips</span>
            <span className="text-emerald-400 font-bold text-xl">${(currentPlayer?.chips || 0).toLocaleString()}</span>
          </div>
          <div className="bg-amber-900/40 rounded-lg p-2.5 text-center border border-amber-700/30">
            <span className="text-amber-300/80 text-[10px] block uppercase tracking-wider">Pot</span>
            <div className="flex items-center justify-center gap-1">
              <span className="text-amber-400 font-bold text-xl">${(tableData?.pot || 0).toLocaleString()}</span>
              {tableData?.pot > 0 && (currentPlayer?.totalContribution || 0) < tableData?.pot && (
                <span className="text-amber-300/60 text-sm">
                  (+${Math.max(0, (tableData?.pot || 0) - (currentPlayer?.totalContribution || 0)).toLocaleString()})
                </span>
              )}
            </div>
          </div>
          {tableData?.currentBet > 0 && (
            <div className="bg-blue-900/40 rounded-lg p-2.5 text-center border border-blue-700/30">
              <span className="text-blue-300/80 text-[10px] block uppercase tracking-wider">To Call</span>
              <span className="text-blue-400 font-bold text-xl">${callAmount.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Pot display for railbirds (simplified) */}
      {userIsRailbird && tableData?.pot > 0 && (
        <div className="bg-amber-900/40 rounded-lg p-2.5 text-center border border-amber-700/30 flex-shrink-0">
          <span className="text-amber-300/80 text-[10px] block uppercase tracking-wider">Pot</span>
          <span className="text-amber-400 font-bold text-xl">${(tableData?.pot || 0).toLocaleString()}</span>
        </div>
      )}

      {/* Waiting indicator when not player's turn (only for players) */}
      {!userIsRailbird && !myTurn && !isIdle && !isShowdown && (
        <div className="text-center py-2 text-slate-400 text-sm flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-slate-500 rounded-full animate-pulse"></span>
          Waiting...
        </div>
      )}

      {/* Action Buttons - flex-1 to take available space (only for players) */}
      {!userIsRailbird && (
        <div className="flex flex-col gap-2.5 flex-1 justify-end">
          {isIdle && canStartGame && !needsBuyIn && (
            <motion.button
              type="button"
              onClick={handleDeal}
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-amber-900 disabled:to-amber-950 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Deal Cards
            </motion.button>
          )}

          {/* Add Bot button - visible to table creator when seats available */}
          {userIsTableCreator && (tableData?.players?.length || 0) < 6 && (
            <motion.button
              type="button"
              onClick={() => handleAddBot('hard')}
              disabled={loading}
              className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:from-slate-800 disabled:to-slate-900 text-white font-medium py-2 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-lg">🤖</span>
              <span>Add Bot</span>
              {!isIdle && <span className="text-xs opacity-70">(joins next hand)</span>}
            </motion.button>
          )}

          {isBettingPhase && myTurn && currentPlayer?.status === 'active' && (
            <BettingControls
              onFold={handleFold}
              onCheck={handleCheck}
              onCall={handleCall}
              onRaise={handleRaise}
              onAllIn={handleAllIn}
              callAmount={callAmount}
              minRaise={minRaise}
              maxRaise={currentPlayer?.chips || 0}
              playerCurrentRoundBet={currentPlayer?.currentRoundBet || 0}
              canCheck={playerCanCheck}
              currentBet={tableData?.currentBet || 0}
              pot={tableData?.pot || 0}
              disabled={loading}
              isDesktop={true}
            />
          )}

          {isDrawPhase && myTurn && (
            <motion.button
              type="button"
              onClick={handleSubmitDraw}
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:from-violet-900 disabled:to-violet-950 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {selectedCardIndices.size > 0
                ? `Discard ${selectedCardIndices.size} Card${selectedCardIndices.size > 1 ? 's' : ''}`
                : 'Stand Pat'
              }
            </motion.button>
          )}

          {isShowdown && (
            <div className="flex flex-col gap-2">
              {/* Show/Muck buttons for showdown */}
              <ShowMuckButtons
                showdownResult={tableData?.showdownResult}
                currentUserUid={currentUser?.uid}
                currentPlayer={currentPlayer}
                onRevealHand={handleRevealHand}
                isDesktop={true}
              />
              <motion.button
                type="button"
                onClick={startNextHand}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-amber-900 disabled:to-amber-950 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next Hand
              </motion.button>
            </div>
          )}

          {needsBuyIn && isIdle && (
            <motion.button
              type="button"
              onClick={() => setShowBuyInModal(true)}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-3 px-4 rounded-xl font-bold shadow-lg transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              + Buy Chips
            </motion.button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f1f14 0%, #14532d 30%, #166534 60%, #14532d 100%)' }}>
      {/* Buy-In Modal */}
      <BuyInModal
        isOpen={showBuyInModal}
        onClose={handleCloseBuyInModal}
        onBuyIn={handleBuyIn}
        maxAmount={userWallet?.balance || 0}
        minBet={tableData?.minBet || 50}
        loading={loading}
      />

      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        onSave={handleSaveUsername}
        currentUsername={userWallet?.username}
        isRequired={false}
        loading={loading}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg animate-pulse ${
            toast.type === 'error'
              ? 'bg-red-600 text-white border border-red-400'
              : toast.type === 'success'
              ? 'bg-green-600 text-white border border-green-400'
              : 'bg-yellow-600 text-white border border-yellow-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP LAYOUT (min-width: 1024px) */}
      {isDesktop ? (
        <div className="h-screen flex flex-col">
          {/* Header - Refined dark theme */}
          <motion.div 
            className="flex items-center justify-between px-4 py-2 border-b border-slate-700/40 flex-shrink-0 backdrop-blur-md"
            style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.9) 100%)' }}
            initial={{ y: -15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={leaveTable}
                className="bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-slate-600/50"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Leave Table
              </motion.button>
              {/* Sit Out Toggle - Only show for players (not railbirds) */}
              {!userIsRailbird && currentPlayer && (
                playerHasPendingSitOut ? (
                  <motion.button
                    type="button"
                    onClick={handleCancelSitOut}
                    disabled={loading}
                    className="bg-amber-600/80 hover:bg-amber-500/80 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-amber-500/50"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    title="Cancel pending sit out"
                  >
                    Cancel Sit Out
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={handleSitOut}
                    disabled={loading}
                    className="bg-slate-700/80 hover:bg-orange-600/80 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-slate-600/50 hover:border-orange-500/50"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    title={isIdle ? "Sit out immediately" : "Sit out after this hand"}
                  >
                    Sit Out
                  </motion.button>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <span className="text-slate-400 text-xs">Table: </span>
                <span className="text-slate-100 font-mono font-bold text-sm">{currentTableId}</span>
              </div>
              <PhaseIndicator phase={tableData?.phase} />
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700/50">
                <span className="text-amber-400 font-medium text-sm">{getDisplayName()}</span>
              </div>
              <WalletDisplay balance={userWallet?.balance} loading={walletLoading} />
            </div>
          </motion.div>

          {/* Main Content - 3 Column Layout */}
          <div className="flex-1 flex overflow-visible min-h-0">
            {/* Left Sidebar: Chat & Game Log - NARROWER */}
            <div className="w-64 bg-slate-900/50 border-r border-slate-700/50 flex flex-col flex-shrink-0">
              <div className="p-2 border-b border-slate-700/50 flex-shrink-0">
                <h3 className="text-slate-200 font-medium text-sm">Chat & Activity</h3>
              </div>
              
              {/* Railbirds list */}
              {railbirds.length > 0 && (
                <div className="p-2 border-b border-slate-700/50 flex-shrink-0">
                  <p className="text-slate-400 text-xs mb-1">Watching ({railbirds.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {railbirds.map((rb) => (
                      <span key={rb.uid} className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                        {rb.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex-1 overflow-hidden min-h-0">
                <ChatBox
                  messages={tableData?.chatLog || []}
                  onSendMessage={sendChatMessage}
                  currentUsername={getDisplayName()}
                  disabled={needsUsername}
                  expanded={true}
                />
              </div>
            </div>

            {/* Center: Poker Table */}
            <div className="flex-1 flex flex-col items-center justify-between min-h-0 overflow-visible py-2">
              {/* Error display */}
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded text-sm mb-2 flex-shrink-0">
                  {error}
                </div>
              )}

              {/* Poker Table with Radial Player Positioning */}
              <div className="w-full max-w-5xl relative flex-1 flex-shrink-0 overflow-visible px-6" style={{ minHeight: '0', height: '100%' }}>
                {/* Premium oval table background */}
                <motion.div
                  className="absolute"
                  style={{
                    left: '3%',
                    right: '3%',
                    top: '2%',
                    bottom: '12%',
                    borderRadius: '50%',
                    background: `
                      radial-gradient(ellipse at 50% 40%, rgba(34,197,94,0.25) 0%, transparent 60%),
                      linear-gradient(180deg, 
                        rgba(21,128,61,0.6) 0%, 
                        rgba(22,101,52,0.7) 30%, 
                        rgba(20,83,45,0.8) 70%, 
                        rgba(21,128,61,0.6) 100%
                      )
                    `,
                    boxShadow: `
                      inset 0 0 60px rgba(0,0,0,0.4),
                      inset 0 0 20px rgba(0,0,0,0.2),
                      0 0 60px rgba(34,197,94,0.15),
                      0 8px 32px rgba(0,0,0,0.4)
                    `,
                    border: '3px solid',
                    borderColor: 'rgba(74,222,128,0.4)',
                  }}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  {/* Inner felt texture line */}
                  <div
                    className="absolute rounded-[50%]"
                    style={{
                      left: '3%',
                      right: '3%',
                      top: '5%',
                      bottom: '5%',
                      border: '2px solid rgba(74,222,128,0.2)',
                    }}
                  />
                  {/* Table felt tagline */}
                  <div
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none"
                    style={{
                      color: 'rgba(74,222,128,0.15)',
                      fontSize: '14px',
                      fontStyle: 'italic',
                      fontWeight: '500',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    From the degenerates that brought you HoldingServe
                  </div>
                </motion.div>

                {/* Opponents positioned radially around the table */}
                {opponentsWithPositions.map((player) => {
                  const position = getRadialPosition(player.relativeIndex, totalPlayers);
                  return (
                    <motion.div
                      key={player.uid}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                      style={{
                        left: position.left,
                        top: position.top,
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                        delay: player.relativeIndex * 0.1,
                      }}
                    >
                      <PlayerSlot
                        player={player}
                        isCurrentUser={false}
                        isActive={player.uid === activePlayer?.uid}
                        showCards={isShowdown}
                        handResult={isShowdown ? evaluateHand(player.hand) : null}
                        turnDeadline={tableData?.turnDeadline}
                        isDealer={isDealer(player.seatIndex)}
                        isSmallBlind={isSmallBlind(player.seatIndex)}
                        isBigBlind={isBigBlind(player.seatIndex)}
                        isViewerRailbird={userIsRailbird}
                        canKick={userIsTableCreator && isIdle && player.isBot}
                        onKick={handleKickBot}
                        showdownResult={tableData?.showdownResult}
                        isMobile={false}
                      />
                    </motion.div>
                  );
                })}

                {/* Empty table message when no opponents */}
                {opponentsWithPositions.length === 0 && isIdle && (
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-xl p-8 text-center">
                      <p className="text-gray-400">Waiting for players to join...</p>
                      <p className="text-gray-500 text-sm mt-2">
                        Share table code: <span className="font-mono font-bold text-white">{currentTableId}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Opponent bet chips positioned between players and center (during betting) */}
                <AnimatePresence>
                  {opponentsWithPositions.map((player) => {
                    if (player.currentRoundBet <= 0) return null;
                    const betPos = getBetChipPosition(player.relativeIndex, totalPlayers);
                    return (
                      <motion.div
                        key={`bet-${player.uid}`}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                        style={{ left: betPos.x, top: betPos.y }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        <BetChip amount={player.currentRoundBet} playerId={player.uid} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Hero's bet chips (desktop) */}
                <AnimatePresence>
                  {currentPlayer?.currentRoundBet > 0 && (
                    <motion.div
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                      style={{ left: '50%', top: '72%' }}
                      initial={{ scale: 0, opacity: 0, y: 30 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0, opacity: 0, y: -20 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <BetChip amount={currentPlayer.currentRoundBet} playerId={currentPlayer.uid} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pot display or Showdown Result in center */}
                {/* Cut for Dealer Phase Display */}
                {isCutForDealer && tableData?.players?.some(p => p.cutCard) ? (
                  <motion.div
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <CutForDealerDisplay
                      players={tableData.players}
                      winnerIndex={tableData.cutForDealerWinner}
                      onResolve={handleResolveCutForDealer}
                      isResolved={tableData.cutForDealerComplete}
                    />
                  </motion.div>
                ) : isShowdown && tableData?.showdownResult ? (
                  <motion.div
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <ShowdownResultDisplay showdownResult={tableData.showdownResult} isDesktop={true} currentUserUid={currentUser?.uid} players={tableData?.players} />
                  </motion.div>
                ) : tableData?.pot > 0 ? (
                  <motion.div
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {/* Community Cards for Hold'em */}
                      {isHoldem && tableData?.communityCards?.length > 0 && (
                        <CommunityCards
                          cards={tableData.communityCards}
                          phase={tableData.phase}
                        />
                      )}
                      <PotDisplayWithContribution
                        totalPot={tableData.pot}
                        players={tableData?.players || []}
                        isBettingPhase={isBettingPhase}
                        playerContribution={currentPlayer?.totalContribution || 0}
                        size="lg"
                      />
                    </div>
                  </motion.div>
                ) : isHoldem && tableData?.communityCards?.length > 0 ? (
                  <motion.div
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <CommunityCards
                      cards={tableData.communityCards}
                      phase={tableData.phase}
                    />
                  </motion.div>
                ) : null}
              </div>

              {/* Hero's Hand Area - Premium styling */}
              <motion.div 
                className="rounded-2xl px-6 py-3 flex-shrink-0 w-full max-w-3xl mx-4 mt-1 relative overflow-hidden"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  background: userIsRailbird 
                    ? `linear-gradient(180deg, rgba(88,28,135,0.9) 0%, rgba(76,29,149,0.85) 50%, rgba(88,28,135,0.9) 100%)`
                    : `linear-gradient(180deg, rgba(22,101,52,0.95) 0%, rgba(21,128,61,0.9) 50%, rgba(22,101,52,0.95) 100%)`,
                  boxShadow: '0 -4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.4)',
                  border: userIsRailbird ? '2px solid rgba(167,139,250,0.6)' : '2px solid rgba(251,191,36,0.6)',
                  borderRadius: '16px',
                }}
              >
                {/* Subtle pattern overlay */}
                <div 
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '16px 16px',
                  }}
                />
                
                {/* Railbird View */}
                {userIsRailbird ? (
                  <motion.div 
                    className="flex flex-col items-center gap-3 py-4 relative z-10"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">👁️</span>
                      <span className="text-violet-200 font-semibold text-lg">Watching the Game</span>
                    </div>
                    <p className="text-violet-300/70 text-sm text-center max-w-md">
                      You're observing as a railbird. Card values are hidden to prevent collusion.
                    </p>
                    {userCanBecomePlayer && (
                      <motion.button
                        type="button"
                        onClick={handleJoinAsPlayer}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-2 px-6 rounded-lg transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Join as Player
                      </motion.button>
                    )}
                    {!userCanBecomePlayer && !isIdle && (
                      <p className="text-violet-300/60 text-xs italic">
                        Wait for the hand to end to join as a player
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {/* Position indicators for hero */}
                    <div className="flex justify-center mb-1 relative z-10">
                      <PositionIndicators
                        isDealer={isDealer(heroSeatIndex)}
                        isSmallBlind={isSmallBlind(heroSeatIndex)}
                        isBigBlind={isBigBlind(heroSeatIndex)}
                      />
                    </div>

                    {currentPlayer?.hand && Array.isArray(currentPlayer.hand) && currentPlayer.hand.length > 0 ? (
                      <motion.div 
                        className="flex flex-col items-center gap-2 relative z-10"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        <div className="flex gap-2">
                          <AnimatePresence mode="popLayout">
                            {currentPlayer.hand.map((card, index) => (
                              <motion.div
                                key={`${index}-${card?.rank || 'unknown'}-${card?.suit || 'unknown'}`}
                                layout
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.85, y: -40 }}
                                transition={{ 
                                  type: 'spring',
                                  stiffness: 350,
                                  damping: 28,
                                  delay: index * 0.04
                                }}
                              >
                                <Card
                                  card={card}
                                  isSelected={selectedCardIndices.has(index)}
                                  isSelectable={isDrawPhase && myTurn}
                                  onClick={() => toggleCardSelection(index)}
                                  index={index}
                                  isDealing={isIdle && currentPlayer.hand.length === 5}
                                />
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>

                        {isDrawPhase && myTurn && (
                          <p className="text-emerald-200/80 text-xs">
                            Click cards to discard ({selectedCardIndices.size} selected)
                          </p>
                        )}

                        {playerHandResult && isShowdown && (
                          <div className="text-center bg-amber-500/20 rounded-lg px-4 py-1">
                            <p className="text-xl font-bold text-amber-400">
                              {formatHandName(playerHandResult.categoryName)}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        className="text-center py-3 relative z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="text-white text-lg font-medium">
                          {needsBuyIn ? 'Buy in to play!' : isIdle ? (canStartGame ? 'Ready to deal!' : 'Waiting for players...') : 'Waiting for cards...'}
                        </p>
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            </div>

            {/* Right Sidebar: Action Controls - WIDER */}
            <div className="w-80 bg-slate-900/50 border-l border-slate-700/50 flex flex-col flex-shrink-0">
              <ActionControlsSidebar />
            </div>
          </div>
        </div>
      ) : (
        /* MOBILE LAYOUT - Restructured with fixed bottom action bar */
        <div className="h-screen flex flex-col overflow-hidden">
          {/* Mobile Header - Compact */}
          <div className="flex-shrink-0 px-3 py-2 bg-slate-900/90 border-b border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={leaveTable}
                  className="bg-slate-700/80 hover:bg-slate-600/80 text-white px-2 py-1.5 rounded-lg text-xs font-medium"
                >
                  Leave
                </button>
                {/* Sit Out Toggle for Mobile - Only show for players */}
                {!userIsRailbird && currentPlayer && (
                  playerHasPendingSitOut ? (
                    <button
                      type="button"
                      onClick={handleCancelSitOut}
                      disabled={loading}
                      className="bg-amber-600/80 text-white px-2 py-1.5 rounded-lg text-xs font-medium"
                    >
                      Stay
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSitOut}
                      disabled={loading}
                      className="bg-slate-700/80 text-slate-200 px-2 py-1.5 rounded-lg text-xs font-medium"
                    >
                      Sit Out
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-800/80 px-2 py-1 rounded-lg">
                  <span className="text-white font-mono font-bold text-sm">{currentTableId}</span>
                </div>
                <PhaseIndicator phase={tableData?.phase} />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-amber-400 font-medium text-xs truncate max-w-[80px]">{getDisplayName()}</span>
                <WalletDisplay balance={userWallet?.balance} loading={walletLoading} />
              </div>
            </div>
          </div>

          {/* Add Bot button - at the top, visible to table leader when seats available */}
          {userIsTableCreator && (tableData?.players?.length || 0) < 6 && (
            <div className="flex-shrink-0 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/30">
              <motion.button
                type="button"
                onClick={() => handleAddBot('hard')}
                disabled={loading}
                className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-medium py-1.5 px-3 rounded-lg shadow flex items-center justify-center gap-2 text-sm"
                whileTap={{ scale: 0.98 }}
              >
                <span>🤖</span>
                <span>Add Bot</span>
                {!isIdle && <span className="text-xs opacity-70">(next hand)</span>}
              </motion.button>
            </div>
          )}

          {/* Scrollable Main Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
            {/* Error display */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-3 py-2 rounded text-xs mb-2 text-center">
                {error}
              </div>
            )}

            {/* Turn Timer (for betting/draw phases) - compact
                Passive Timer System: any player can claim after grace period */}
            {tableData?.turnDeadline && (isBettingPhase || isDrawPhase) && !userIsRailbird && (
              <div className="mb-2">
                <TurnTimer
                  turnDeadline={tableData.turnDeadline}
                  onTimeout={handleTimeout}
                  isMyTurn={myTurn}
                  canTriggerTimeout={tableData?.createdBy === currentUser?.uid && activePlayer?.isBot}
                  isAtTable={true}
                />
              </div>
            )}

            {/* Pot and Call info - shown above table */}
            {!userIsRailbird && (
              <div className="flex gap-1.5 flex-wrap justify-center items-center mb-2 px-1">
                {/* Pot Display */}
                {tableData?.pot > 0 && (
                  <div className="bg-amber-900/40 rounded-lg px-2 py-1 text-center border border-amber-700/30 flex-shrink-0">
                    <span className="text-amber-300/80 text-[9px] uppercase tracking-wider mr-1">Pot:</span>
                    <span className="text-amber-400 font-bold text-sm whitespace-nowrap">${(tableData?.pot || 0).toLocaleString()}</span>
                  </div>
                )}

                {/* To Call */}
                {tableData?.currentBet > 0 && (
                  <div className="bg-blue-900/40 rounded-lg px-2 py-1 text-center border border-blue-700/30 flex-shrink-0">
                    <span className="text-blue-300/80 text-[9px] uppercase tracking-wider mr-1">Call:</span>
                    <span className="text-blue-400 font-bold text-sm whitespace-nowrap">${callAmount.toLocaleString()}</span>
                  </div>
                )}

                {/* Buy Chips Button */}
                {needsBuyIn && isIdle && (
                  <motion.button
                    type="button"
                    onClick={() => setShowBuyInModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium text-sm"
                    whileTap={{ scale: 0.95 }}
                  >
                    + Buy
                  </motion.button>
                )}
              </div>
            )}

            {/* Poker Table with Radial Player Positioning - scaled for mobile */}
            <div className="w-full relative" style={{ minHeight: '220px', maxHeight: '280px' }}>
        {/* Premium oval table background - Harmonized with desktop */}
        <motion.div
          className="absolute"
          style={{
            left: '8%',
            right: '8%',
            top: '5%',
            bottom: '15%',
            borderRadius: '50%',
            background: `
              radial-gradient(ellipse at 50% 40%, rgba(34,197,94,0.25) 0%, transparent 60%),
              linear-gradient(180deg, 
                rgba(21,128,61,0.6) 0%, 
                rgba(22,101,52,0.7) 30%, 
                rgba(20,83,45,0.8) 70%, 
                rgba(21,128,61,0.6) 100%
              )
            `,
            boxShadow: `
              inset 0 0 40px rgba(0,0,0,0.4),
              inset 0 0 15px rgba(0,0,0,0.2),
              0 0 40px rgba(34,197,94,0.15),
              0 6px 24px rgba(0,0,0,0.4)
            `,
            border: '3px solid rgba(74,222,128,0.4)',
          }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Inner felt texture line */}
          <div 
            className="absolute rounded-[50%]"
            style={{
              left: '4%',
              right: '4%',
              top: '6%',
              bottom: '6%',
              border: '2px solid rgba(74,222,128,0.2)',
            }}
          />
        </motion.div>

        {/* Opponents positioned radially around the table */}
        {opponentsWithPositions.map((player) => {
          const position = getRadialPosition(player.relativeIndex, totalPlayers);
          return (
            <motion.div
              key={player.uid}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
              style={{
                left: position.left,
                top: position.top,
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <PlayerSlot
                player={player}
                isCurrentUser={false}
                isActive={player.uid === activePlayer?.uid}
                showCards={isShowdown}
                handResult={isShowdown ? evaluateHand(player.hand) : null}
                turnDeadline={tableData?.turnDeadline}
                isDealer={isDealer(player.seatIndex)}
                isSmallBlind={isSmallBlind(player.seatIndex)}
                isBigBlind={isBigBlind(player.seatIndex)}
                isViewerRailbird={userIsRailbird}
                canKick={userIsTableCreator && isIdle && player.isBot}
                onKick={handleKickBot}
                showdownResult={tableData?.showdownResult}
                isMobile={true}
              />
            </motion.div>
          );
        })}

        {/* Opponent bet chips positioned between players and center */}
        <AnimatePresence>
          {opponentsWithPositions.map((player) => {
            if (player.currentRoundBet <= 0) return null;
            const betPos = getBetChipPosition(player.relativeIndex, totalPlayers);
            return (
              <motion.div
                key={`bet-${player.uid}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: betPos.x, top: betPos.y }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <BetChip amount={player.currentRoundBet} playerId={player.uid} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Hero's bet chips */}
        <AnimatePresence>
          {currentPlayer?.currentRoundBet > 0 && (
            <motion.div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: '50%', top: '72%' }}
              initial={{ scale: 0, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <BetChip amount={currentPlayer.currentRoundBet} playerId={currentPlayer.uid} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty table message when no opponents */}
        {opponentsWithPositions.length === 0 && isIdle && (
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-xl p-8 text-center">
              <p className="text-gray-400">Waiting for players to join...</p>
              <p className="text-gray-500 text-sm mt-2">
                Share table code: <span className="font-mono font-bold text-white">{currentTableId}</span>
              </p>
            </div>
          </div>
        )}

        {/* Cut for Dealer, Pot display, or Showdown Result in center of table */}
        {isCutForDealer && tableData?.players?.some(p => p.cutCard) ? (
          <motion.div
            className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <CutForDealerDisplay
              players={tableData.players}
              winnerIndex={tableData.cutForDealerWinner}
              onResolve={handleResolveCutForDealer}
              isResolved={tableData.cutForDealerComplete}
            />
          </motion.div>
        ) : isShowdown && tableData?.showdownResult ? (
          <motion.div
            className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <ShowdownResultDisplay showdownResult={tableData.showdownResult} isDesktop={false} currentUserUid={currentUser?.uid} players={tableData?.players} />
          </motion.div>
        ) : tableData?.pot > 0 ? (
          <motion.div
            className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <PotDisplayWithContribution
              totalPot={tableData.pot}
              players={tableData?.players || []}
              isBettingPhase={isBettingPhase}
              playerContribution={currentPlayer?.totalContribution || 0}
              size="md"
            />
          </motion.div>
        ) : null}
      </div>

      {/* Game Table - Current Player's Hand - Harmonized with desktop styling */}
      <motion.div 
        className="rounded-2xl px-6 py-4 w-full max-w-lg mx-auto relative overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: userIsRailbird 
            ? `linear-gradient(180deg, rgba(88,28,135,0.9) 0%, rgba(76,29,149,0.85) 50%, rgba(88,28,135,0.9) 100%)`
            : `linear-gradient(180deg, rgba(22,101,52,0.95) 0%, rgba(21,128,61,0.9) 50%, rgba(22,101,52,0.95) 100%)`,
          boxShadow: '0 -4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.4)',
          border: userIsRailbird ? '2px solid rgba(167,139,250,0.6)' : '2px solid rgba(251,191,36,0.6)',
          borderRadius: '16px',
        }}
      >
        {/* Subtle pattern overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '16px 16px',
          }}
        />

        {/* Railbird View for Mobile */}
        {userIsRailbird ? (
          <motion.div 
            className="flex flex-col items-center gap-3 py-3 relative z-10"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">👁️</span>
              <span className="text-violet-200 font-semibold">Watching as Railbird</span>
            </div>
            <p className="text-violet-300/70 text-xs text-center">
              Card values are hidden to prevent collusion.
            </p>
            {userCanBecomePlayer && (
              <motion.button
                type="button"
                onClick={handleJoinAsPlayer}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Join as Player
              </motion.button>
            )}
            {!userCanBecomePlayer && !isIdle && (
              <p className="text-violet-300/60 text-xs italic">
                Wait for hand to end to join
              </p>
            )}
          </motion.div>
        ) : (
          <>
            {/* Position indicators for hero */}
            <div className="flex justify-center mb-1 relative z-10">
              <PositionIndicators
                isDealer={isDealer(heroSeatIndex)}
                isSmallBlind={isSmallBlind(heroSeatIndex)}
                isBigBlind={isBigBlind(heroSeatIndex)}
              />
            </div>

            {currentPlayer?.hand && Array.isArray(currentPlayer.hand) && currentPlayer.hand.length > 0 ? (
              <motion.div 
                className="flex flex-col items-center gap-3 relative z-10"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* Cards - with AnimatePresence matching desktop */}
                <div className="flex gap-2">
                  <AnimatePresence mode="popLayout">
                    {currentPlayer.hand.map((card, index) => (
                      <motion.div
                        key={`${index}-${card?.rank || 'unknown'}-${card?.suit || 'unknown'}`}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85, y: -40 }}
                        transition={{ 
                          type: 'spring',
                          stiffness: 350,
                          damping: 28,
                          delay: index * 0.04
                        }}
                      >
                        <Card
                          card={card}
                          isSelected={selectedCardIndices.has(index)}
                          isSelectable={isDrawPhase && myTurn}
                          onClick={() => toggleCardSelection(index)}
                          index={index}
                          isDealing={isIdle && currentPlayer.hand.length === 5}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Draw phase hint */}
                {isDrawPhase && myTurn && (
                  <p className="text-emerald-200/80 text-xs">
                    Click cards to discard ({selectedCardIndices.size} selected)
                  </p>
                )}

                {/* Turn indicator */}
                {!isIdle && !isShowdown && (
                  <p className={`text-sm ${myTurn ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                    {myTurn ? "It's your turn!" : `Waiting for ${activePlayer?.displayName || 'opponent'}...`}
                  </p>
                )}

                {/* Hand Result (shown at showdown) */}
                {playerHandResult && isShowdown && (
                  <div className="text-center bg-amber-500/20 rounded-lg px-4 py-1">
                    <p className="text-xl font-bold text-amber-400">
                      {formatHandName(playerHandResult.categoryName)}
                    </p>
                  </div>
                )}

                {/* Hero Stack & Wager Display - Below cards for visibility */}
                <div className="flex gap-2 flex-wrap justify-center items-center mt-2">
                  {/* Your Chips */}
                  <div className="bg-slate-800/80 rounded-lg px-2 py-1 text-center border border-slate-700/50">
                    <span className="text-slate-400 text-[9px] uppercase tracking-wider mr-1">Stack:</span>
                    <span className="text-emerald-400 font-bold text-sm">${(currentPlayer?.chips || 0).toLocaleString()}</span>
                  </div>
                  {/* Current Wager */}
                  {currentPlayer?.currentRoundBet > 0 && (
                    <div className="bg-amber-900/40 rounded-lg px-2 py-1 text-center border border-amber-700/30">
                      <span className="text-amber-300/80 text-[9px] uppercase tracking-wider mr-1">Wager:</span>
                      <span className="text-amber-400 font-bold text-sm">${currentPlayer.currentRoundBet.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                className="text-center py-3 relative z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-white text-lg font-medium">
                  {needsBuyIn ? 'Buy in to play!' : isIdle ? (canStartGame ? 'Ready to deal!' : 'Waiting for players...') : 'Waiting for cards...'}
                </p>
                <p className="text-slate-300 text-xs mt-1">
                  {tableData?.players?.length || 0} player(s) at table
                  {canStartGame ? '' : ` (${playersWithChips} with chips)`}
                </p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

            {/* Railbirds info for mobile */}
            {railbirds.length > 0 && (
              <div className="text-center text-xs text-gray-400 mt-2">
                <span>Watching: </span>
                <span className="text-violet-400">{railbirds.map(r => r.displayName).join(', ')}</span>
              </div>
            )}
          </div>{/* End of scrollable content area */}

          {/* FIXED BOTTOM ACTION BAR - No scrolling required */}
          <div className="flex-shrink-0 bg-slate-900/95 border-t border-slate-700/50 backdrop-blur-sm px-3 py-3 safe-area-pb">
            {/* Action Buttons / Betting Controls */}
            {!userIsRailbird ? (
              <div className="w-full">
                {/* IDLE: Show Deal button */}
                {isIdle && canStartGame && !needsBuyIn && (
                  <motion.button
                    type="button"
                    onClick={handleDeal}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg text-lg min-h-[56px]"
                    whileTap={{ scale: 0.98 }}
                  >
                    Deal Cards
                  </motion.button>
                )}

                {/* BETTING phases: Show Betting Controls */}
                {isBettingPhase && myTurn && currentPlayer?.status === 'active' && (
                  <BettingControls
                    onFold={handleFold}
                    onCheck={handleCheck}
                    onCall={handleCall}
                    onRaise={handleRaise}
                    onAllIn={handleAllIn}
                    callAmount={callAmount}
                    minRaise={minRaise}
                    maxRaise={currentPlayer?.chips || 0}
                    playerCurrentRoundBet={currentPlayer?.currentRoundBet || 0}
                    canCheck={playerCanCheck}
                    currentBet={tableData?.currentBet || 0}
                    pot={tableData?.pot || 0}
                    disabled={loading}
                    isDesktop={false}
                  />
                )}

                {/* DRAW phases: Show Discard button */}
                {isDrawPhase && myTurn && (
                  <motion.button
                    type="button"
                    onClick={handleSubmitDraw}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg text-lg min-h-[56px]"
                    whileTap={{ scale: 0.98 }}
                  >
                    {selectedCardIndices.size > 0
                      ? `Discard ${selectedCardIndices.size} Card${selectedCardIndices.size > 1 ? 's' : ''}`
                      : 'Stand Pat'
                    }
                  </motion.button>
                )}

                {/* SHOWDOWN: Show/Muck buttons and Next Hand */}
                {isShowdown && (
                  <div className="flex flex-col gap-2">
                    {/* Show/Muck buttons - touch-friendly */}
                    <ShowMuckButtons
                      showdownResult={tableData?.showdownResult}
                      currentUserUid={currentUser?.uid}
                      currentPlayer={currentPlayer}
                      onRevealHand={handleRevealHand}
                      isDesktop={false}
                    />
                    <motion.button
                      type="button"
                      onClick={startNextHand}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg text-lg min-h-[56px]"
                      whileTap={{ scale: 0.98 }}
                    >
                      Next Hand
                    </motion.button>
                  </div>
                )}

                {/* Waiting indicator when not player's turn */}
                {!myTurn && !isIdle && !isShowdown && (
                  <div className="text-center py-3 text-slate-400 text-sm flex items-center justify-center gap-2">
                    <span className="inline-block w-2 h-2 bg-slate-500 rounded-full animate-pulse"></span>
                    Waiting for {activePlayer?.displayName || 'opponent'}...
                  </div>
                )}
              </div>
            ) : (
              /* Railbird View */
              <div className="text-center py-2">
                <div className="flex items-center justify-center gap-2 text-violet-300">
                  <span className="text-lg">👁️</span>
                  <span className="text-sm">Watching as Railbird</span>
                </div>
                {userCanBecomePlayer && (
                  <motion.button
                    type="button"
                    onClick={handleJoinAsPlayer}
                    disabled={loading}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl text-sm"
                    whileTap={{ scale: 0.98 }}
                  >
                    Join as Player
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {/* Chat Box - Non-intrusive floating overlay */}
          <div className="fixed bottom-20 left-2 z-40">
            <ChatBox
              messages={tableData?.chatLog || []}
              onSendMessage={sendChatMessage}
              currentUsername={getDisplayName()}
              disabled={needsUsername}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GameTable() {
  const { currentTableId, loading } = useGame();

  if (loading && !currentTableId) {
    return (
      <div className="min-h-screen bg-green-800 flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  // Show lobby if no table selected, otherwise show game
  // Wrap GameView in error boundary to catch rendering errors
  return currentTableId ? (
    <GameErrorBoundary>
      <GameView />
    </GameErrorBoundary>
  ) : (
    <LobbyView />
  );
}

export default GameTable;
