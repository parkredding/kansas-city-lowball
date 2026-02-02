/**
 * ============================================================================
 * PORTRAIT GAME LAYOUT
 * "Me-Centric" Vertical Topology - PWA Gaming Design System
 * ============================================================================
 *
 * This component implements the ergonomic zone structure optimized for
 * one-handed, portrait-mode play on mobile devices.
 *
 * ZONE ARCHITECTURE (Top to Bottom):
 * ┌─────────────────────────────────┐
 * │     HEADER ZONE (8-10%)        │  Status, Menu, Connection
 * ├─────────────────────────────────┤
 * │                                 │
 * │   HORSESHOE ZONE (20-25%)      │  Opponent Avatars (Arc)
 * │         ╭───────╮              │
 * │       ╭─┤  opp  ├─╮            │
 * │      ╭┤ ╰───────╯ ├╮           │
 * │     opp           opp          │
 * ├─────────────────────────────────┤
 * │                                 │
 * │    COMMUNITY ZONE (15-20%)     │  Board Cards, Pot Display
 * │       [  ] [  ] [  ]           │
 * │          POT: $XXX             │
 * ├─────────────────────────────────┤
 * │                                 │
 * │      HERO ZONE (40-45%)        │  Player's Cards (LARGE)
 * │                                 │  Action Bar at bottom
 * │         [    ] [    ]          │
 * │                                 │
 * │  ┌──────┐ ┌──────┐ ┌──────┐   │
 * │  │ FOLD │ │ CALL │ │ RAISE│   │  ← Thumb-reachable
 * │  └──────┘ └──────┘ └──────┘   │
 * └─────────────────────────────────┘
 *     ← Safe Area (Home Bar) →
 *
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Hook to detect orientation and enforce portrait mode
 */
export function useOrientationLock() {
  const [isLandscape, setIsLandscape] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Check orientation
    const checkOrientation = () => {
      const isLand = window.innerWidth > window.innerHeight &&
                     window.innerHeight < 500; // Only trigger for phones
      setIsLandscape(isLand);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return { isLandscape, isStandalone };
}

/**
 * Landscape Warning Overlay
 * Displayed when device is rotated to landscape
 */
export function LandscapeWarning() {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-6xl mb-6"
        animate={{ rotate: [0, -90, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        📱
      </motion.div>
      <h2 className="text-xl font-bold text-white mb-3">
        Please Rotate Your Device
      </h2>
      <p className="text-slate-400 max-w-xs">
        This poker experience is optimized for portrait mode.
        Rotate your device for the best one-handed play.
      </p>
    </motion.div>
  );
}

/**
 * Main Portrait Game Layout Component
 *
 * ZONE ARCHITECTURE (App-Like Fixed Layout):
 * ┌─────────────────────────────────────┐
 * │     HEADER ZONE (10%)               │  Fixed Top
 * ├─────────────────────────────────────┤
 * │                                     │
 * │     TABLE ZONE (65%)                │  Scaled Container
 * │     - Opponents (Horseshoe)         │
 * │     - Community Cards               │
 * │     - Pot (Centered)                │
 * │     - Hero Cards                    │
 * │                                     │
 * ├─────────────────────────────────────┤
 * │     INTERACTION ZONE (25%)          │  Clamped Bottom
 * │     - Status Overlay                │
 * │     - Pre-Action / Action Bar       │
 * └─────────────────────────────────────┘
 */
export function PortraitGameLayout({
  children,
  headerContent,
  opponentsContent,
  communityContent,
  heroCardsContent,
  actionBarContent,
  statusOverlayContent,
  showLandscapeWarning = true,
}) {
  const { isLandscape } = useOrientationLock();

  return (
    <>
      {/* Landscape Warning Overlay */}
      <AnimatePresence>
        {showLandscapeWarning && isLandscape && <LandscapeWarning />}
      </AnimatePresence>

      {/* Main Game Layout - Fixed Height Container (No Scrolling) */}
      <div
        className={`
          game-layout-fixed
          fixed inset-0
          flex flex-col
          overflow-hidden
          transition-all duration-300
          ${isLandscape ? 'blur-sm pointer-events-none' : ''}
        `}
        style={{
          /* Use dynamic viewport height for mobile browser toolbar handling */
          height: '100dvh',
          /* Fallback for browsers without dvh support */
          minHeight: '-webkit-fill-available',
        }}
      >
        {/* ============================================
            HEADER ZONE (10% of viewport)
            Status bar, menu button, connection indicator
            Z-INDEX: 200 (sticky level)
            ============================================ */}
        <header
          className="zone-header-fixed flex-shrink-0"
          style={{
            flex: '0 0 10%',
            maxHeight: '64px',
            minHeight: '48px',
            zIndex: 200,
          }}
        >
          {headerContent}
        </header>

        {/* ============================================
            TABLE ZONE (65% of viewport)
            Contains: Opponents, Community Cards, Pot, Hero Cards
            Scales to fit between header and interaction zone
            Z-INDEX: 0-50 (base through elevated)
            ============================================ */}
        <section
          className="zone-table-container flex-1 relative overflow-hidden"
          style={{
            flex: '1 1 65%',
            minHeight: 0, /* Allow flex shrinking */
          }}
        >
          {/* Table Felt Background */}
          <div
            className="absolute inset-0 table-felt-background"
            style={{
              background: 'radial-gradient(ellipse 100% 80% at 50% 40%, #166534 0%, #14532d 60%, #0f172a 100%)',
              zIndex: 0,
            }}
          />

          {/* Opponents Zone - Top portion of table */}
          <div
            className="zone-opponents-inner absolute top-0 left-0 right-0"
            style={{
              height: '35%',
              zIndex: 10,
            }}
          >
            {opponentsContent}
          </div>

          {/* Community Zone - Center of table (pot underneath cards) */}
          <div
            className="zone-community-inner absolute left-0 right-0 flex flex-col items-center justify-center"
            style={{
              top: '30%',
              height: '35%',
              zIndex: 20,
            }}
          >
            {/* Pot Display - Centered, underneath community cards */}
            <div
              className="pot-center absolute"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 15, /* Below cards, above felt */
              }}
            >
              {/* Pot is passed through communityContent */}
            </div>

            {/* Community Cards - On top of pot */}
            <div style={{ zIndex: 25 }}>
              {communityContent}
            </div>
          </div>

          {/* Hero Cards Zone - Bottom portion of table */}
          <div
            className="zone-hero-cards-inner absolute bottom-0 left-0 right-0 flex items-center justify-center"
            style={{
              height: '35%',
              zIndex: 30,
            }}
          >
            {heroCardsContent}
          </div>
        </section>

        {/* ============================================
            INTERACTION ZONE (25% of viewport)
            Status overlay + Pre-Action/Action Bar
            Clamped to bottom, never scrolls
            Z-INDEX: 100-150 (dropdown/overlay level)
            ============================================ */}
        <section
          className="zone-interaction-fixed flex-shrink-0 flex flex-col"
          style={{
            flex: '0 0 25%',
            maxHeight: '200px',
            minHeight: '120px',
            zIndex: 100,
            background: 'linear-gradient(0deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.85) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(148, 163, 184, 0.1)',
          }}
        >
          {/* Status Overlay - Call amount, current bet indicators */}
          {statusOverlayContent && (
            <div
              className="status-overlay-container px-3 pt-2"
              style={{ zIndex: 110 }}
            >
              {statusOverlayContent}
            </div>
          )}

          {/* Action Bar Container - Pre-actions or Live actions */}
          <div
            className="action-bar-container flex-1 flex flex-col justify-end"
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              zIndex: 120,
            }}
          >
            {actionBarContent}
          </div>
        </section>

        {/* Additional content (modals, overlays) - Highest z-index */}
        <div style={{ zIndex: 500 }}>
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Header Component for Portrait Layout
 */
export function PortraitHeader({
  tableName,
  blinds,
  phase,
  playerCount,
  isConnected = true,
  onMenuClick,
  onSettingsClick,
}) {
  return (
    <div className="flex items-center justify-between w-full px-2">
      {/* Left: Menu Button */}
      <button
        type="button"
        onClick={onMenuClick}
        className="touch-target p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Center: Table Info */}
      <div className="flex-1 text-center">
        <div className="text-sm font-semibold text-white truncate">
          {tableName || 'Poker Table'}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          {blinds && <span>{blinds}</span>}
          {phase && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-medium">{phase}</span>
            </>
          )}
          {playerCount && (
            <>
              <span className="text-slate-600">•</span>
              <span>{playerCount} players</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Status & Settings */}
      <div className="flex items-center gap-1">
        {/* Connection Status */}
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />

        {/* Settings Button */}
        <button
          type="button"
          onClick={onSettingsClick}
          className="touch-target p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Opponent Horseshoe Layout Component
 * Positions opponents in an arc at the top of the table
 */
export function OpponentHorseshoe({ opponents = [], maxVisibleOpponents = 5 }) {
  // Calculate positions for arc layout
  const visibleOpponents = opponents.slice(0, maxVisibleOpponents);
  const opponentCount = visibleOpponents.length;

  // Generate arc positions (centered, spreading outward)
  const getArcPosition = (index, total) => {
    if (total === 1) return { x: 50, y: 0, scale: 1 };

    const spreadAngle = Math.min(140, 30 + total * 20); // Degrees of arc spread
    const startAngle = -spreadAngle / 2;
    const angleStep = spreadAngle / (total - 1);
    const angle = startAngle + (index * angleStep);

    // Convert to position (arc centered at bottom)
    const radians = (angle * Math.PI) / 180;
    const radius = 0.4; // Relative radius

    return {
      x: 50 + Math.sin(radians) * 45, // Percentage from center
      y: (1 - Math.cos(radians)) * 15, // Slight vertical curve
      scale: 1 - Math.abs(angle) / 300, // Slight scale reduction at edges
    };
  };

  return (
    <div className="opponent-horseshoe relative w-full h-full max-w-md mx-auto">
      {visibleOpponents.map((opponent, index) => {
        const pos = getArcPosition(index, opponentCount);

        return (
          <motion.div
            key={opponent.id || index}
            className="opponent-slot absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translate(-50%, 0) scale(${pos.scale})`,
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {/* Opponent Avatar */}
            <div className="flex flex-col items-center gap-1">
              {/* Cards (face down) */}
              <div className="opponent-cards flex -space-x-2">
                {Array.from({ length: opponent.cardCount || 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="opponent-card w-7 h-10 rounded bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 shadow-md"
                    style={{ transform: `rotate(${(i - 0.5) * 6}deg)` }}
                  />
                ))}
              </div>

              {/* Player Info */}
              <div className="text-center">
                <div className="text-xs font-medium text-white truncate max-w-[60px]">
                  {opponent.name || 'Player'}
                </div>
                <div className="text-[10px] text-amber-400">
                  ${opponent.chips?.toLocaleString() || '0'}
                </div>
              </div>

              {/* Action/Status Indicator */}
              {opponent.lastAction && (
                <div className="px-2 py-0.5 rounded bg-slate-700/80 text-[9px] font-medium text-slate-300">
                  {opponent.lastAction}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Hero Cards Display Component
 * Displays player's cards at LARGER size than opponents
 */
export function HeroCards({
  cards = [],
  selectedIndices = new Set(),
  onCardClick,
  isSelectable = false,
}) {
  return (
    <div className="hero-cards-container flex justify-center gap-4">
      {cards.map((card, index) => (
        <motion.button
          key={`hero-${card?.rank || 'x'}-${card?.suit || 'x'}-${index}`}
          type="button"
          onClick={() => isSelectable && onCardClick?.(index)}
          disabled={!isSelectable}
          className={`
            hero-card
            w-[72px] h-[104px]
            rounded-xl
            flex flex-col items-center justify-center
            relative overflow-hidden
            transition-all duration-150
            ${selectedIndices.has(index)
              ? 'ring-3 ring-amber-400 ring-offset-2 ring-offset-green-800 -translate-y-4 scale-105'
              : ''
            }
            ${isSelectable ? 'cursor-pointer active:scale-95' : 'cursor-default'}
          `}
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)',
            boxShadow: selectedIndices.has(index)
              ? '0 12px 28px rgba(245, 158, 11, 0.4), 0 6px 12px rgba(0,0,0,0.3)'
              : '0 6px 16px rgba(0,0,0,0.35), 0 3px 6px rgba(0,0,0,0.2)',
          }}
          whileTap={isSelectable ? { scale: 0.95 } : undefined}
        >
          {card ? (
            <>
              <span className={`text-2xl font-bold leading-none ${getSuitColor(card.suit)}`}>
                {card.rank}
              </span>
              <span className={`text-3xl leading-none -mt-1 ${getSuitColor(card.suit)}`}>
                {getSuitSymbol(card.suit)}
              </span>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl" />
          )}

          {/* Inner border */}
          <div className="absolute inset-1 rounded-lg border border-gray-200/50 pointer-events-none" />
        </motion.button>
      ))}
    </div>
  );
}

// Helper functions for 4-color deck
function getSuitColor(suit) {
  const colors = {
    h: 'text-red-600',     // Hearts - Red
    d: 'text-blue-600',    // Diamonds - Blue
    c: 'text-green-600',   // Clubs - Green
    s: 'text-gray-900',    // Spades - Black
  };
  return colors[suit] || 'text-gray-900';
}

function getSuitSymbol(suit) {
  const symbols = {
    h: '♥',
    d: '♦',
    c: '♣',
    s: '♠',
  };
  return symbols[suit] || '?';
}

export default PortraitGameLayout;
