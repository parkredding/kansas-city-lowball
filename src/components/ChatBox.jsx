import { useState, useEffect, useRef } from 'react';

/**
 * Chat component for table communication and game activity log
 * Shows chat messages and game events (draws, bets, folds, wins)
 * Game events are displayed in italics with a different color
 */
function ChatBox({ messages = [], onSendMessage, currentUsername, disabled }) {
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

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

  // Count unread messages (only chat messages, not game events)
  const chatCount = messages.filter(m => !isGameEvent(m)).length;
  const eventCount = messages.filter(m => isGameEvent(m)).length;

  // Collapsed view - just show toggle button with activity indicator
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 left-4 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg border border-gray-600 flex items-center gap-2 transition-colors z-40"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-sm font-medium">Activity</span>
        {messages.length > 0 && (
          <span className="bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  // Expanded view
  return (
    <div className="fixed bottom-4 left-4 w-80 bg-gray-800 rounded-lg shadow-2xl border border-gray-600 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <h3 className="text-white font-medium text-sm">Activity Log</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No activity yet. Game events and chat will appear here.
          </p>
        ) : (
          messages.map((msg, index) => {
            // Render game events differently
            if (isGameEvent(msg)) {
              return (
                <div
                  key={`${msg.timestamp}-${index}`}
                  className="flex items-center gap-2 py-1"
                >
                  <span className="text-purple-400 text-xs">●</span>
                  <span className="text-gray-400 text-xs italic flex-1">
                    {msg.text}
                  </span>
                  <span className="text-gray-600 text-xs">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              );
            }

            // Render chat messages
            const isOwnMessage = msg.sender === currentUsername;
            return (
              <div
                key={`${msg.timestamp}-${index}`}
                className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-xs font-medium ${isOwnMessage ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {msg.sender}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`rounded-lg px-3 py-1.5 max-w-[85%] break-words text-sm ${
                    isOwnMessage
                      ? 'bg-yellow-600/30 text-yellow-100'
                      : 'bg-gray-700 text-gray-200'
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
      <form onSubmit={handleSubmit} className="p-2 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={disabled ? 'Set username to chat' : 'Type a message...'}
            disabled={disabled}
            maxLength={200}
            className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || !inputText.trim()}
            className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatBox;
