import { usePokerGame } from '../game/usePokerGame';

const SUIT_SYMBOLS = {
  h: { symbol: '\u2665', color: 'text-red-500' },
  d: { symbol: '\u2666', color: 'text-red-500' },
  c: { symbol: '\u2663', color: 'text-gray-900' },
  s: { symbol: '\u2660', color: 'text-gray-900' },
};

function Card({ card }) {
  const suit = SUIT_SYMBOLS[card.suit];
  return (
    <div className="bg-white rounded-lg shadow-lg w-16 h-24 flex flex-col items-center justify-center border-2 border-gray-300">
      <span className={`text-xl font-bold ${suit.color}`}>
        {card.rank}
      </span>
      <span className={`text-2xl ${suit.color}`}>
        {suit.symbol}
      </span>
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

function GameTable() {
  const { playerHand, handResult, startNewHand } = usePokerGame();

  return (
    <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center gap-8">
      <h1 className="text-3xl font-bold text-white">Kansas City Lowball</h1>

      <div className="bg-green-700 rounded-3xl px-12 py-8 border-8 border-yellow-700 shadow-2xl">
        {playerHand.length > 0 ? (
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-3">
              {playerHand.map((card) => (
                <Card key={`${card.rank}-${card.suit}`} card={card} />
              ))}
            </div>

            {handResult && (
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

      <button
        onClick={startNewHand}
        className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg"
      >
        Deal
      </button>
    </div>
  );
}

export default GameTable;
