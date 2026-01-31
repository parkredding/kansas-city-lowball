import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * Generate a consistent color from a string (UID or username)
 * Uses a simple hash function to map strings to HSL colors
 * @param {string} str - The string to hash (typically UID or username)
 * @returns {string} - HSL color string
 */
function generateColorFromString(str) {
  if (!str) return 'hsl(200, 70%, 60%)';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate hue from 0-360 (full color wheel)
  // Avoid very dark or very light colors by constraining saturation and lightness
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash >> 8) % 20); // 60-80%
  const lightness = 55 + (Math.abs(hash >> 16) % 15); // 55-70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get the color for activity log entries
 * - Chat messages: Full player color
 * - Game actions: Lighter hue (higher lightness) of player color to distinguish
 * - System events (no player): Default purple
 *
 * @param {string} playerUid - UID of the player (for generating base color)
 * @param {boolean} isSystemAction - True for game actions (lighter), false for chat (full color)
 * @returns {string} - HSL or rgba color string
 */
function getLogColor(playerUid, isSystemAction = false) {
  // Default purple for system events with no player
  if (!playerUid) {
    return isSystemAction ? 'rgba(167, 139, 250, 0.6)' : 'hsl(270, 70%, 65%)';
  }

  // Generate base color from player UID
  let hash = 0;
  for (let i = 0; i < playerUid.length; i++) {
    const char = playerUid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash >> 8) % 20);

  if (isSystemAction) {
    // For game actions: higher lightness (lighter shade) to distinguish from chat
    const lightness = 72 + (Math.abs(hash >> 16) % 8); // 72-80% (lighter)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else {
    // For chat: standard lightness (full color)
    const lightness = 55 + (Math.abs(hash >> 16) % 15); // 55-70%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
}

/**
 * Colored dot indicator for a user (for chat messages)
 */
function UserColorDot({ username, size = 'sm' }) {
  const color = useMemo(() => generateColorFromString(username), [username]);
  const sizeClasses = size === 'xs' ? 'w-1.5 h-1.5' : size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <span
      className={`${sizeClasses} rounded-full inline-block flex-shrink-0`}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Colored dot indicator for game events
 * Uses lighter shade of player color to distinguish from chat messages
 */
function GameEventDot({ playerUid, size = 'xs' }) {
  const color = useMemo(() => getLogColor(playerUid, true), [playerUid]);
  const sizeClasses = size === 'xs' ? 'w-1.5 h-1.5' : size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <span
      className={`${sizeClasses} rounded-full inline-block flex-shrink-0`}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Filter tabs component for switching between All, Chat, and Activity views
 */
function FilterTabs({ filter, onFilterChange }) {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'chat', label: 'Chat' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="flex gap-0.5 bg-slate-800/50 rounded p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onFilterChange(tab.id)}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            filter === tab.id
              ? 'bg-amber-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Chat component for table communication and game activity log
 * Shows chat messages and game events (draws, bets, folds, wins)
 * Game events are displayed in italics with a different color
 *
 * Features:
 * - Filter tabs: All, Chat Only, Activity Only
 * - Mute toggle for notifications
 * - Resizable height (desktop only)
 */
function ChatBox({ messages = [], onSendMessage, currentUsername, disabled, expanded = false, onMuteChange }) {
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [filter, setFilter] = useState('all'); // 'all', 'chat', 'activity'
  const [isMuted, setIsMuted] = useState(false);
  const [panelHeight, setPanelHeight] = useState(224); // Default height in pixels (h-56 = 14rem = 224px)
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const resizeRef = useRef(null);
  const isDragging = useRef(false);

  // Sync internal state with expanded prop
  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Notify parent of mute state changes
  useEffect(() => {
    onMuteChange?.(isMuted);
  }, [isMuted, onMuteChange]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;

    onSendMessage(inputText.trim());
    setInputText('');
    inputRef.current?.focus();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if a message is a game event (vs regular chat)
  const isGameEvent = (msg) => {
    return msg.type === 'game_event';
  };

  // Filter messages based on current filter
  const filteredMessages = useMemo(() => {
    switch (filter) {
      case 'chat':
        return messages.filter(m => !isGameEvent(m));
      case 'activity':
        return messages.filter(m => isGameEvent(m));
      default:
        return messages;
    }
  }, [messages, filter]);

  // Count unread messages
  const chatCount = messages.filter(m => !isGameEvent(m)).length;
  const eventCount = messages.filter(m => isGameEvent(m)).length;

  // Handle resize drag for floating panel
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY || e.touches?.[0]?.clientY;
    const startHeight = panelHeight;

    const handleMove = (moveEvent) => {
      if (!isDragging.current) return;
      const currentY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const delta = startY - currentY;
      const newHeight = Math.max(150, Math.min(500, startHeight + delta));
      setPanelHeight(newHeight);
    };

    const handleEnd = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  }, [panelHeight]);

  // Collapsed view - just show toggle button with activity indicator
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 left-4 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 px-3 py-1.5 rounded-lg shadow-lg border border-slate-700/50 flex items-center gap-2 transition-colors z-40 backdrop-blur-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-xs font-medium">Activity</span>
        {messages.length > 0 && (
          <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {messages.length}
          </span>
        )}
        {isMuted && (
          <span className="text-slate-500" title="Muted">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </span>
        )}
      </button>
    );
  }

  // Expanded view
  // If expanded prop is true, use full height (for desktop sidebar), otherwise fixed height (for floating modal)
  const containerClasses = expanded
    ? 'w-full h-full flex flex-col bg-transparent'
    : 'fixed bottom-4 left-4 w-80 bg-slate-900/95 rounded-lg shadow-2xl border border-slate-700/50 flex flex-col z-40 backdrop-blur-sm';

  return (
    <div
      className={containerClasses}
      style={!expanded ? { height: `${panelHeight + 80}px` } : undefined}
    >
      {/* Resize handle (floating panel only) */}
      {!expanded && (
        <div
          ref={resizeRef}
          className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center hover:bg-slate-700/30 rounded-t-lg"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <div className="w-8 h-1 bg-slate-600 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/40 flex-shrink-0 mt-2">
        <div className="flex items-center gap-2">
          <h3 className="text-slate-300 font-medium text-xs">Activity Log</h3>
          <FilterTabs filter={filter} onFilterChange={setFilter} />
        </div>
        <div className="flex items-center gap-1">
          {/* Mute toggle */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1 rounded transition-colors ${
              isMuted ? 'text-red-400 bg-red-900/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
            title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {isMuted ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          {/* Collapse button (floating panel only) */}
          {!expanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1"
        style={!expanded ? { height: `${panelHeight}px` } : undefined}
      >
        {filteredMessages.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-3">
            {filter === 'chat' ? 'No chat messages yet.' :
             filter === 'activity' ? 'No game events yet.' :
             'Game events and chat will appear here.'}
          </p>
        ) : (
          filteredMessages.map((msg, index) => {
            // Render game events differently - with dynamic player color coding
            if (isGameEvent(msg)) {
              return (
                <div
                  key={`${msg.timestamp}-${index}`}
                  className="flex items-start gap-1.5 py-0.5"
                >
                  <span className="mt-0.5">
                    <GameEventDot playerUid={msg.playerUid} size="xs" />
                  </span>
                  <span className="text-slate-400 text-[11px] italic flex-1 leading-tight">
                    {msg.text}
                  </span>
                  <span className="text-slate-600 text-[10px] flex-shrink-0">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              );
            }

            // Render chat messages
            const isOwnMessage = msg.sender === currentUsername;
            const senderColor = generateColorFromString(msg.sender);
            return (
              <div
                key={`${msg.timestamp}-${index}`}
                className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <UserColorDot username={msg.sender} size="xs" />
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: senderColor }}
                  >
                    {msg.sender}
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`rounded px-2 py-1 max-w-[90%] break-words text-[11px] leading-tight ${
                    isOwnMessage
                      ? 'bg-amber-600/25 text-amber-100'
                      : 'bg-slate-700/60 text-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-1.5 border-t border-slate-700/40 flex-shrink-0">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={disabled ? 'Set username' : 'Message...'}
            disabled={disabled}
            maxLength={200}
            className="flex-1 bg-slate-800/80 border border-slate-700/50 text-slate-100 text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={disabled || !inputText.trim()}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatBox;
