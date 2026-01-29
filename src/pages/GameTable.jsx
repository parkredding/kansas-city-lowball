import { usePokerGame, PHASES, PHASE_DISPLAY_NAMES } from '../game/usePokerGame';

const SUIT_SYMBOLS = {
  h: { symbol: '\u2665', color: 'text-red-500' },
  d: { symbol: '\u2666', color: 'text-red-500' },
  c: { symbol: '\u2663', color: 'text-gray-900' },
  s: { symbol: '\u2660', color: 'text-gray-900' },
};

function Card({ card, isSelected, onClick, isSelectable }) {
  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <button
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

function formatHandName(categoryName) {
  if (!categoryName) return '';
  return categoryName
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function PhaseIndicator({ phase }) {
  const displayName = PHASE_DISPLAY_NAMES[phase] || phase;

  // Determine phase type for styling
  const isBetting = phase.startsWith('BETTING_');
  const isDraw = phase.startsWith('DRAW_');
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isIdle = phase === PHASES.IDLE;

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

function GameTable() {
  const {
    playerHand,
    handResult,
    phase,
    selectedCardIndices,
    pot,
    playerChips,
    isBettingPhase,
    isDrawPhase,
    startNewGame,
    submitDraw,
    submitBet,
    startNextHand,
    toggleCardSelection,
  } = usePokerGame();

  const isIdle = phase === PHASES.IDLE;
  const isShowdown = phase === PHASES.SHOWDOWN;

  return (
    <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center gap-6 p-4">
      {/* Phase Indicator */}
      <PhaseIndicator phase={phase} />

      {/* Title */}
      <h1 className="text-3xl font-bold text-white">Kansas City Lowball</h1>

      {/* Chip Displays */}
      <div className="flex gap-4">
        <ChipDisplay label="Your Chips" amount={playerChips} />
        <ChipDisplay label="Pot" amount={pot} variant="pot" />
      </div>

      {/* Game Table */}
      <div className="bg-green-700 rounded-3xl px-12 py-8 border-8 border-yellow-700 shadow-2xl">
        {playerHand.length > 0 ? (
          <div className="flex flex-col items-center gap-6">
            {/* Cards */}
            <div className="flex gap-3">
              {playerHand.map((card, index) => (
                <Card
                  key={`${index}-${card.rank}-${card.suit}`}
                  card={card}
                  isSelected={selectedCardIndices.has(index)}
                  isSelectable={isDrawPhase}
                  onClick={() => toggleCardSelection(index)}
                />
              ))}
            </div>

            {/* Draw phase hint */}
            {isDrawPhase && (
              <p className="text-gray-300 text-sm">
                Click cards to select them for discard ({selectedCardIndices.size} selected)
              </p>
            )}

            {/* Hand Result (shown at showdown) */}
            {handResult && isShowdown && (
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {formatHandName(handResult.categoryName)}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  {handResult.display}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-white text-xl font-semibold px-8 py-4">
            Click Deal to start
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {/* IDLE: Show Deal button */}
        {isIdle && (
          <button
            onClick={startNewGame}
            className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
          >
            Deal
          </button>
        )}

        {/* BETTING phases: Show Check/Call button */}
        {isBettingPhase && (
          <button
            onClick={() => submitBet(0)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
          >
            Check / Call
          </button>
        )}

        {/* DRAW phases: Show Discard button */}
        {isDrawPhase && (
          <button
            onClick={submitDraw}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
          >
            {selectedCardIndices.size > 0
              ? `Discard ${selectedCardIndices.size} Card${selectedCardIndices.size > 1 ? 's' : ''}`
              : 'Stand Pat'
            }
          </button>
        )}

        {/* SHOWDOWN: Show Next Hand button */}
        {isShowdown && (
          <button
            onClick={startNextHand}
            className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
          >
            Next Hand
          </button>
        )}
      </div>
    </div>
  );
}

export default GameTable;
