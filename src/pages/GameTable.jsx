import { useState, useEffect, useRef, useCallback } from 'react';
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
import ChipStack, { MiniChipStack } from '../components/ChipStack';
import { PositionIndicators } from '../components/PositionButtons';
import { useBotOrchestrator } from '../game/ai/useBotOrchestrator';

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

function PhaseIndicator({ phase }) {
  const displayName = PHASE_DISPLAY_NAMES[phase] || phase;

  const isBetting = phase?.startsWith('BETTING_');
  const isDraw = phase?.startsWith('DRAW_');
  const isShowdown = phase === 'SHOWDOWN';
  const isIdle = phase === 'IDLE';

  let bgColors = { from: 'from-slate-600', to: 'to-slate-700', border: 'border-slate-500/50' };
  if (isBetting) bgColors = { from: 'from-blue-600', to: 'to-blue-700', border: 'border-blue-400/50' };
  if (isDraw) bgColors = { from: 'from-violet-600', to: 'to-violet-700', border: 'border-violet-400/50' };
  if (isShowdown) bgColors = { from: 'from-amber-500', to: 'to-amber-600', border: 'border-amber-400/50' };

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

function PlayerSlot({ player, isCurrentUser, isActive, showCards, handResult, turnDeadline, isDealer, isSmallBlind, isBigBlind }) {
  const statusConfig = {
    active: { border: 'border-emerald-500/70', bg: 'from-slate-800/95 to-slate-900/95' },
    folded: { border: 'border-slate-600/50', bg: 'from-slate-800/50 to-slate-900/50', opacity: 'opacity-60' },
    'all-in': { border: 'border-amber-500/70', bg: 'from-slate-800/95 to-slate-900/95' },
    'sitting_out': { border: 'border-slate-700/40', bg: 'from-slate-800/40 to-slate-900/40', opacity: 'opacity-40' },
  };
  
  const config = statusConfig[player.status] || statusConfig.active;

  return (
    <motion.div
      className={`
        relative rounded-xl p-2.5 border backdrop-blur-sm min-w-[140px] max-w-[180px]
        ${isActive ? 'ring-2 ring-amber-400/80 ring-offset-1 ring-offset-green-900' : ''}
        ${config.border} ${config.opacity || ''}
      `}
      animate={isActive ? {
        boxShadow: '0 0 24px rgba(251,191,36,0.35)',
      } : {}}
      transition={{ duration: 0.25 }}
      style={{
        background: `linear-gradient(135deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.95) 100%)`,
        boxShadow: isActive 
          ? '0 6px 20px rgba(251,191,36,0.3), 0 2px 8px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
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
        <div className="relative flex-shrink-0">
          {player.photoURL ? (
            <img
              src={player.photoURL}
              alt={player.displayName}
              className="w-7 h-7 rounded-full border border-slate-600"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center border border-slate-500">
              <span className="text-white text-xs font-medium">
                {player.displayName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate ${isCurrentUser ? 'text-amber-400' : 'text-slate-100'}`}>
            {player.displayName}
          </p>
          <p className="text-xs text-emerald-400 font-medium">${player.chips.toLocaleString()}</p>
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

      {/* Player's cards - clean display */}
      {player.hand && player.hand.length > 0 && (
        <div className="flex gap-0.5 justify-center">
          {player.hand.map((card, index) => (
            showCards ? (
              <Card key={index} card={card} isSelectable={false} size="mini" />
            ) : (
              <ProfessionalCardBack key={index} size="mini" index={index} />
            )
          ))}
        </div>
      )}

      {/* Hand result at showdown */}
      {handResult && showCards && (
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
    const success = await joinTable(tableId, password);
    if (success) {
      setShowJoinTableModal(false);
      setTableIdInput('');
    }
    return success;
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

  // Calculate dealer, small blind, and big blind positions
  const dealerIndex = tableData?.dealerIndex ?? 0;
  const smallBlindIndex = (dealerIndex + 1) % totalPlayers;
  const bigBlindIndex = (dealerIndex + 2) % totalPlayers;

  // Helper to check if a player is at a specific position
  const isDealer = (seatIndex) => seatIndex === dealerIndex;
  const isSmallBlind = (seatIndex) => seatIndex === smallBlindIndex && totalPlayers > 2;
  const isBigBlind = (seatIndex) => seatIndex === bigBlindIndex || (totalPlayers === 2 && seatIndex === smallBlindIndex);

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
    await submitDraw(indices);
    setSelectedCardIndices(new Set());
  };

  const handleDeal = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await dealCards();
  };

  const handleBuyIn = async (amount) => {
    const success = await buyIn(amount);
    if (success) {
      setHasDismissedBuyIn(true);
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

  // Betting action handlers with toast feedback on error
  const handleFold = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.FOLD);
    if (!result.success) {
      showToast(result.error);
    }
  };

  const handleCheck = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.CHECK);
    if (!result.success) {
      showToast(result.error);
    }
  };

  const handleCall = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.CALL);
    if (!result.success) {
      showToast(result.error);
    }
  };

  const handleRaise = async (amount, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.RAISE, amount);
    if (!result.success) {
      showToast(result.error);
    }
  };

  const handleAllIn = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const result = await performBetAction(BetAction.ALL_IN);
    if (!result.success) {
      showToast(result.error);
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

      {/* Turn Timer */}
      {tableData?.turnDeadline && (isBettingPhase || isDrawPhase) && (
        <div className="flex-shrink-0">
          <TurnTimer
            turnDeadline={tableData.turnDeadline}
            onTimeout={handleTimeout}
            isMyTurn={myTurn}
          />
        </div>
      )}

      {/* Chip Displays - More compact grid */}
      <div className="grid grid-cols-1 gap-2 flex-shrink-0">
        <div className="bg-slate-800/80 rounded-lg p-2.5 text-center border border-slate-700/50">
          <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Your Chips</span>
          <span className="text-emerald-400 font-bold text-xl">${(currentPlayer?.chips || 0).toLocaleString()}</span>
        </div>
        <div className="bg-amber-900/40 rounded-lg p-2.5 text-center border border-amber-700/30">
          <span className="text-amber-300/80 text-[10px] block uppercase tracking-wider">Pot</span>
          <span className="text-amber-400 font-bold text-xl">${(tableData?.pot || 0).toLocaleString()}</span>
        </div>
        {tableData?.currentBet > 0 && (
          <div className="bg-blue-900/40 rounded-lg p-2.5 text-center border border-blue-700/30">
            <span className="text-blue-300/80 text-[10px] block uppercase tracking-wider">To Call</span>
            <span className="text-blue-400 font-bold text-xl">${callAmount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Waiting indicator when not player's turn */}
      {!myTurn && !isIdle && !isShowdown && (
        <div className="text-center py-2 text-slate-400 text-sm flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-slate-500 rounded-full animate-pulse"></span>
          Waiting...
        </div>
      )}

      {/* Action Buttons - flex-1 to take available space */}
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
            <motion.button
              type="button"
              onClick={leaveTable}
              className="bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-slate-600/50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Leave Table
            </motion.button>
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

                {/* Pot display in center with enhanced ChipStack */}
                {tableData?.pot > 0 && (
                  <motion.div 
                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <ChipStack amount={tableData.pot} size="lg" showAmount={true} />
                  </motion.div>
                )}
              </div>

              {/* Hero's Hand Area - Premium styling */}
              <motion.div 
                className="rounded-2xl px-6 py-3 flex-shrink-0 w-full max-w-3xl mx-4 mt-1 relative overflow-hidden"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  background: `
                    linear-gradient(180deg, 
                      rgba(22,101,52,0.95) 0%, 
                      rgba(21,128,61,0.9) 50%, 
                      rgba(22,101,52,0.95) 100%
                    )
                  `,
                  boxShadow: '0 -4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.4)',
                  border: '2px solid rgba(251,191,36,0.6)',
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
                
                {/* Position indicators for hero */}
                <div className="flex justify-center mb-1 relative z-10">
                  <PositionIndicators
                    isDealer={isDealer(heroSeatIndex)}
                    isSmallBlind={isSmallBlind(heroSeatIndex)}
                    isBigBlind={isBigBlind(heroSeatIndex)}
                  />
                </div>

                {currentPlayer?.hand && currentPlayer.hand.length > 0 ? (
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
                            key={`${index}-${card.rank}-${card.suit}`}
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
              </motion.div>
            </div>

            {/* Right Sidebar: Action Controls - WIDER */}
            <div className="w-80 bg-slate-900/50 border-l border-slate-700/50 flex flex-col flex-shrink-0">
              <ActionControlsSidebar />
            </div>
          </div>
        </div>
      ) : (
        /* MOBILE LAYOUT */
        <div className="flex flex-col items-center gap-4 p-4">
          {/* Header */}
          <div className="w-full max-w-4xl flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={leaveTable}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          Leave Table
        </button>

        <div className="bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2">
          <span className="text-gray-400 text-sm">Table: </span>
          <span className="text-white font-mono font-bold">{currentTableId}</span>
        </div>

        {/* Username Display with Edit */}
        <div className="bg-gray-700 px-3 py-2 rounded-lg flex items-center gap-2">
          <span className="text-yellow-400 font-medium text-sm">{getDisplayName()}</span>
          <button
            type="button"
            onClick={() => setShowUsernameModal(true)}
            className="text-gray-400 hover:text-white"
            title="Edit username"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        <WalletDisplay balance={userWallet?.balance} loading={walletLoading} />

        <PhaseIndicator phase={tableData?.phase} />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded text-sm max-w-md">
          {error}
        </div>
      )}

      {/* Turn Timer (for betting/draw phases) */}
      {tableData?.turnDeadline && (isBettingPhase || isDrawPhase) && (
        <div className="w-full max-w-md">
          <TurnTimer
            turnDeadline={tableData.turnDeadline}
            onTimeout={handleTimeout}
            isMyTurn={myTurn}
          />
        </div>
      )}

      {/* Hero Chip Stack Display */}
      <div className="flex gap-6 flex-wrap justify-center items-end">
        {/* Your Chips with 3D stack */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className="text-gray-400 text-xs mb-1">Your Stack</span>
          <div className="bg-gray-800/80 rounded-xl p-3 border border-gray-700">
            <MiniChipStack amount={currentPlayer?.chips || 0} showAmount />
          </div>
        </motion.div>

        {/* Current Bet Info */}
        {tableData?.currentBet > 0 && (
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="text-gray-400 text-xs mb-1">To Call</span>
            <div className="bg-red-600/80 px-4 py-2 rounded-lg">
              <span className="text-white font-bold text-lg">${callAmount}</span>
            </div>
          </motion.div>
        )}

        {/* Buy More Chips Button */}
        {needsBuyIn && isIdle && (
          <motion.button
            type="button"
            onClick={() => setShowBuyInModal(true)}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            + Buy Chips
          </motion.button>
        )}
      </div>

      {/* Poker Table with Radial Player Positioning */}
      <div className="w-full max-w-4xl relative" style={{ minHeight: '280px' }}>
        {/* Oval table background */}
        <div
          className="absolute inset-0 bg-green-700/30 border-4 border-green-600/50 rounded-full"
          style={{
            left: '10%',
            right: '10%',
            top: '5%',
            bottom: '15%',
            borderRadius: '50%',
          }}
        />

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

        {/* Pot display in center of table with 3D chip stack */}
        {tableData?.pot > 0 && (
          <motion.div
            className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <PotDisplay amount={tableData.pot} isWinning={isShowdown} />
          </motion.div>
        )}
      </div>

      {/* Game Table - Current Player's Hand */}
      <div className="bg-green-700 rounded-3xl px-12 py-8 border-8 border-yellow-700 shadow-2xl">
        {currentPlayer?.hand && currentPlayer.hand.length > 0 ? (
          <div className="flex flex-col items-center gap-6">
            {/* Cards */}
            <div className="flex gap-3">
              {currentPlayer.hand.map((card, index) => (
                <Card
                  key={`${index}-${card.rank}-${card.suit}`}
                  card={card}
                  isSelected={selectedCardIndices.has(index)}
                  isSelectable={isDrawPhase && myTurn}
                  onClick={() => toggleCardSelection(index)}
                />
              ))}
            </div>

            {/* Draw phase hint */}
            {isDrawPhase && myTurn && (
              <p className="text-gray-300 text-sm">
                Click cards to select them for discard ({selectedCardIndices.size} selected)
              </p>
            )}

            {/* Turn indicator */}
            {!isIdle && !isShowdown && (
              <p className={`text-sm ${myTurn ? 'text-yellow-400 font-bold' : 'text-gray-400'}`}>
                {myTurn ? "It's your turn!" : `Waiting for ${activePlayer?.displayName || 'opponent'}...`}
              </p>
            )}

            {/* Hand Result (shown at showdown) */}
            {playerHandResult && isShowdown && (
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {formatHandName(playerHandResult.categoryName)}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  {playerHandResult.display}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-white text-xl font-semibold px-8 py-4">
              {needsBuyIn
                ? 'Buy in to play!'
                : isIdle
                  ? canStartGame
                    ? 'Ready to deal!'
                    : 'Waiting for more players with chips...'
                  : 'Waiting for cards...'
              }
            </p>
            <p className="text-gray-400 text-sm">
              {tableData?.players?.length || 0} player(s) at table
              {canStartGame ? '' : ` (${playersWithChips} with chips)`}
            </p>
          </div>
        )}
      </div>

      {/* Current Player Info */}
      <div className="text-center">
        <p className="text-gray-300 text-sm">
          Playing as <span className="text-yellow-400 font-medium">{currentPlayer?.displayName}</span>
        </p>
        {currentPlayer?.currentRoundBet > 0 && (
          <p className="text-gray-400 text-xs">
            Your bet this round: ${currentPlayer.currentRoundBet}
          </p>
        )}
        {/* Show your last draw action */}
        {currentPlayer?.lastAction && (
          <span className="inline-block mt-1 bg-purple-600 text-white text-xs font-medium px-2 py-1 rounded-full">
            {currentPlayer.lastAction}
          </span>
        )}
      </div>

      {/* Action Buttons / Betting Controls */}
      <div className="w-full max-w-lg relative z-50">
        {/* IDLE: Show Deal button */}
        {isIdle && canStartGame && !needsBuyIn && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleDeal}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
            >
              Deal Cards
            </button>
          </div>
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
            disabled={loading}
            isDesktop={isDesktop}
          />
        )}

        {/* DRAW phases: Show Discard button */}
        {isDrawPhase && myTurn && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSubmitDraw}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
            >
              {selectedCardIndices.size > 0
                ? `Discard ${selectedCardIndices.size} Card${selectedCardIndices.size > 1 ? 's' : ''}`
                : 'Stand Pat'
              }
            </button>
          </div>
        )}

        {/* Mobile: Show action buttons inline */}
        {!isDesktop && (
          <>
            {/* SHOWDOWN: Show Next Hand button */}
            {isShowdown && (
              <div className="flex justify-center">
                <motion.button
                  type="button"
                  onClick={startNextHand}
                  disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white font-bold py-3 px-8 rounded-lg shadow-lg text-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Next Hand
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>

          {/* Chat Box */}
          <ChatBox
            messages={tableData?.chatLog || []}
            onSendMessage={sendChatMessage}
            currentUsername={getDisplayName()}
            disabled={needsUsername}
          />
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
  return currentTableId ? <GameView /> : <LobbyView />;
}

export default GameTable;
