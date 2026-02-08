/**
 * GameTypeStats - Performance breakdown by game type
 * Shows how the player performs in NLHE, PLO, Lowball, etc.
 */

import { motion } from 'framer-motion';

const GAME_TYPE_LABELS = {
  holdem: 'Texas Hold\'em',
  lowball_27: '2-7 Triple Draw',
  single_draw_27: '2-7 Single Draw',
};

const GAME_TYPE_ICONS = {
  holdem: 'TH',
  lowball_27: 'TD',
  single_draw_27: 'SD',
};

export default function GameTypeStats({ gameTypeStats = {}, onFilterGameType }) {
  const entries = Object.entries(gameTypeStats);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <p className="text-slate-500 text-sm">No game type data available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
        Performance by Game Type
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(([type, stats], i) => {
          const isProfit = stats.netResult >= 0;
          const winRate = stats.hands > 0 ? ((stats.won / stats.hands) * 100).toFixed(1) : '0.0';

          return (
            <motion.button
              key={type}
              type="button"
              className="rounded-lg bg-slate-700/30 border border-slate-600/30 p-3 text-left hover:border-slate-500 transition-colors"
              onClick={() => onFilterGameType?.(type)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-md bg-slate-600 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-300">
                    {GAME_TYPE_ICONS[type] || '??'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    {GAME_TYPE_LABELS[type] || type}
                  </p>
                  <p className="text-xs text-slate-500">{stats.hands} hands</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : ''}{stats.netResult.toLocaleString()}
                </span>
                <span className="text-xs text-blue-400">{winRate}% win</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
