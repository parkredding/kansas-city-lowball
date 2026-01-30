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
    return { left: '50%', top: '85%' };
  }

  // For opponents, distribute them around the top portion of the oval
  // We use positions 1 through (totalPlayers - 1) for opponents
  const numOpponents = totalPlayers - 1;

  // Oval table dimensions (as percentages)
  // Center of oval
  const centerX = 50;
  const centerY = 45;

  // Radii for the oval (horizontal is wider than vertical for poker table shape)
  const radiusX = 42; // Horizontal radius
  const radiusY = 35; // Vertical radius

  // Calculate angle for this opponent
  // Start from left side and go clockwise to right side (covering top arc)
  // The arc goes from about 200 degrees (left) to -20 degrees (right), covering the top
  const startAngle = 200; // Left side (in degrees)
  const endAngle = -20;   // Right side (in degrees)

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

function Card({ card, isSelected, onClick, isSelectable, faceDown = false }) {
  if (faceDown) {
    return (
      <div className="bg-blue-800 rounded-lg shadow-lg w-16 h-24 flex flex-col items-center justify-center border-2 border-blue-900">
        <div className="w-12 h-18 bg-blue-700 rounded border border-blue-600 flex items-center justify-center">
          <span className="text-blue-500 text-2xl">?</span>
        </div>
      </div>
    );
  }

  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isSelectable}
      className={`
        bg-white rounded-lg shadow-lg w-16 h-24 flex flex-col items-center justify-center border-2
        transition-all duration-150
        ${isSelected
          ? 'border-yellow-400 ring-2 ring-yellow-400 -translate-y-2'
          : 'border-gray-300'
        }
        ${isSelectable
          ? 'cursor-pointer hover:border-yellow-300 hover:-translate-y-1'
          : 'cursor-default'
        }
      `}
    >
      <span className={`text-xl font-bold ${suit.color}`}>
        {card.rank}
      </span>
      <span className={`text-2xl ${suit.color}`}>
        {suit.symbol}
      </span>
    </button>
  );
}

function CardBack() {
  return (
    <div className="bg-blue-800 rounded-lg shadow-lg w-12 h-16 flex flex-col items-center justify-center border-2 border-blue-900">
      <div className="w-8 h-10 bg-blue-700 rounded border border-blue-600"></div>
    </div>
  );
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

  let bgColor = 'bg-gray-600';
  if (isBetting) bgColor = 'bg-blue-600';
  if (isDraw) bgColor = 'bg-purple-600';
  if (isShowdown) bgColor = 'bg-yellow-600';
  if (isIdle) bgColor = 'bg-gray-600';

  return (
    <div className={`${bgColor} px-6 py-2 rounded-full shadow-lg`}>
      <span className="text-white font-semibold text-lg">
        {displayName}
      </span>
    </div>
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
    <div className="bg-gradient-to-r from-green-700 to-green-600 px-4 py-2 rounded-lg shadow flex items-center gap-2">
      <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
      </svg>
      <div>
        <span className="text-green-200 text-xs">Wallet</span>
        <span className="text-white font-bold ml-2">
          {loading ? '...' : `$${(balance || 0).toLocaleString()}`}
        </span>
      </div>
    </div>
  );
}

/**
 * Badge component for dealer/blind positions
 */
function PositionBadge({ type }) {
  const badges = {
    dealer: { label: 'D', bg: 'bg-white', text: 'text-black', title: 'Dealer' },
    sb: { label: 'SB', bg: 'bg-blue-500', text: 'text-white', title: 'Small Blind' },
    bb: { label: 'BB', bg: 'bg-yellow-500', text: 'text-black', title: 'Big Blind' },
  };

  const badge = badges[type];
  if (!badge) return null;

  return (
    <div
      className={`${badge.bg} ${badge.text} w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 border-gray-800`}
      title={badge.title}
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
  const statusColors = {
    active: 'border-green-500',
    folded: 'border-gray-500 opacity-50',
    'all-in': 'border-yellow-500',
    'sitting_out': 'border-gray-600 opacity-40',
  };

  return (
    <div
      className={`
        relative bg-gray-800 rounded-xl p-4 border-2
        ${isActive ? 'ring-2 ring-yellow-400' : ''}
        ${statusColors[player.status] || 'border-gray-600'}
      `}
    >
      {/* Position badges (Dealer/SB/BB) */}
      <div className="absolute -top-2 -right-2 flex gap-1 z-20">
        {isDealer && <PositionBadge type="dealer" />}
        {isSmallBlind && <PositionBadge type="sb" />}
        {isBigBlind && <PositionBadge type="bb" />}
      </div>

      {/* Circular timer around avatar when active */}
      {isActive && turnDeadline && (
        <div className="absolute -top-1 -left-1">
          <CircularTimer turnDeadline={turnDeadline} size={40} isActive={isActive} />
        </div>
      )}

      {/* Last Action Badge (speech bubble style) */}
      {player.lastAction && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-purple-600 text-white text-xs font-medium px-2 py-1 rounded-full shadow-lg whitespace-nowrap">
            {player.lastAction}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          {player.photoURL ? (
            <img
              src={player.photoURL}
              alt={player.displayName}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-white text-sm">
                {player.displayName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${isCurrentUser ? 'text-yellow-400' : 'text-white'}`}>
            {player.displayName}
            {isCurrentUser && ' (You)'}
          </p>
          <div className="flex items-center gap-2">
            <MiniChipStack amount={player.chips} />
            <p className="text-xs text-gray-400">${player.chips}</p>
          </div>
        </div>
        {isActive && (
          <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded animate-pulse">
            Turn
          </span>
        )}
        {player.status === 'folded' && (
          <span className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
            Folded
          </span>
        )}
        {player.status === 'all-in' && (
          <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
            All-In
          </span>
        )}
      </div>

      {/* Current round bet text indicator (chips shown separately) */}
      {player.currentRoundBet > 0 && (
        <motion.div
          className="mb-2 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-xs bg-yellow-600/80 text-white font-medium px-2 py-1 rounded shadow">
            Bet: ${player.currentRoundBet}
          </span>
        </motion.div>
      )}

      {/* Player's cards */}
      {player.hand && player.hand.length > 0 && (
        <div className="flex gap-1 justify-center">
          {player.hand.map((card, index) => (
            showCards ? (
              <div key={index} className="transform scale-75 -mx-1">
                <Card card={card} isSelectable={false} />
              </div>
            ) : (
              <CardBack key={index} />
            )
          ))}
        </div>
      )}

      {/* Hand result at showdown */}
      {handResult && showCards && (
        <div className="mt-2 text-center">
          <p className="text-xs text-yellow-400">
            {formatHandName(handResult.categoryName)}
          </p>
        </div>
      )}
    </div>
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
    // Only close modal if table was successfully created
    if (tableId) {
      setShowCreateGameModal(false);
    }
    // If tableId is null, error is already set in context, modal will stay open
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

  // Desktop layout component for action controls
  const ActionControlsSidebar = () => (
    <div className="flex flex-col gap-4 p-4 bg-gray-900/50 rounded-xl h-full">
      <h3 className="text-white font-semibold text-center border-b border-gray-700 pb-2">Actions</h3>

      {/* Turn Timer */}
      {tableData?.turnDeadline && (isBettingPhase || isDrawPhase) && (
        <TurnTimer
          turnDeadline={tableData.turnDeadline}
          onTimeout={handleTimeout}
          isMyTurn={myTurn}
        />
      )}

      {/* Chip Displays */}
      <div className="flex flex-col gap-2">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <span className="text-gray-400 text-xs block">Your Chips</span>
          <span className="text-white font-bold text-lg">${currentPlayer?.chips || 0}</span>
        </div>
        <div className="bg-yellow-600/30 rounded-lg p-3 text-center">
          <span className="text-yellow-200 text-xs block">Pot</span>
          <span className="text-yellow-400 font-bold text-lg">${tableData?.pot || 0}</span>
        </div>
        {tableData?.currentBet > 0 && (
          <div className="bg-blue-600/30 rounded-lg p-3 text-center">
            <span className="text-blue-200 text-xs block">To Call</span>
            <span className="text-blue-400 font-bold text-lg">${callAmount}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex-1 flex flex-col justify-center">
        {isIdle && canStartGame && !needsBuyIn && (
          <button
            type="button"
            onClick={handleDeal}
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
          >
            Deal Cards
          </button>
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
          <button
            type="button"
            onClick={handleSubmitDraw}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
          >
            {selectedCardIndices.size > 0
              ? `Discard ${selectedCardIndices.size} Card${selectedCardIndices.size > 1 ? 's' : ''}`
              : 'Stand Pat'
            }
          </button>
        )}

        {isShowdown && (
          <button
            type="button"
            onClick={startNextHand}
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
          >
            Next Hand
          </button>
        )}

        {needsBuyIn && isIdle && (
          <button
            type="button"
            onClick={() => setShowBuyInModal(true)}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-lg font-medium"
          >
            + Buy Chips
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-green-800 overflow-hidden">
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
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-gray-900/50 border-b border-gray-700">
            <button
              type="button"
              onClick={leaveTable}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Leave Table
            </button>
            <div className="flex items-center gap-4">
              <div className="bg-gray-800 px-4 py-2 rounded-lg">
                <span className="text-gray-400 text-sm">Table: </span>
                <span className="text-white font-mono font-bold">{currentTableId}</span>
              </div>
              <PhaseIndicator phase={tableData?.phase} />
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-700 px-3 py-2 rounded-lg flex items-center gap-2">
                <span className="text-yellow-400 font-medium text-sm">{getDisplayName()}</span>
              </div>
              <WalletDisplay balance={userWallet?.balance} loading={walletLoading} />
            </div>
          </div>

          {/* Main Content - 3 Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Chat & Game Log */}
            <div className="w-80 bg-gray-900/30 border-r border-gray-700 flex flex-col">
              <div className="p-3 border-b border-gray-700">
                <h3 className="text-white font-semibold">Chat & Activity</h3>
              </div>
              <div className="flex-1 overflow-hidden">
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
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
              {/* Error display */}
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded text-sm mb-4">
                  {error}
                </div>
              )}

              {/* Poker Table with Radial Player Positioning */}
              <div className="w-full max-w-4xl relative" style={{ minHeight: '350px' }}>
                {/* Oval table background */}
                <div
                  className="absolute inset-0 bg-green-700/30 border-4 border-green-600/50"
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
                    <div
                      key={player.uid}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{
                        left: position.left,
                        top: position.top,
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
                    </div>
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
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <ChipStack amount={tableData.pot} size="lg" showAmount={true} />
                  </div>
                )}
              </div>

              {/* Hero's Hand Area */}
              <div className="mt-4 bg-green-700 rounded-3xl px-12 py-6 border-8 border-yellow-700 shadow-2xl">
                {/* Position indicators for hero */}
                <div className="flex justify-center mb-2">
                  <PositionIndicators
                    isDealer={isDealer(heroSeatIndex)}
                    isSmallBlind={isSmallBlind(heroSeatIndex)}
                    isBigBlind={isBigBlind(heroSeatIndex)}
                  />
                </div>

                {currentPlayer?.hand && currentPlayer.hand.length > 0 ? (
                  <div className="flex flex-col items-center gap-4">
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

                    {isDrawPhase && myTurn && (
                      <p className="text-gray-300 text-sm">
                        Click cards to select for discard ({selectedCardIndices.size} selected)
                      </p>
                    )}

                    {playerHandResult && isShowdown && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-400">
                          {formatHandName(playerHandResult.categoryName)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-white text-xl font-semibold">
                      {needsBuyIn ? 'Buy in to play!' : isIdle ? (canStartGame ? 'Ready to deal!' : 'Waiting for players...') : 'Waiting for cards...'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar: Action Controls */}
            <div className="w-72 bg-gray-900/30 border-l border-gray-700 relative z-50">
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
