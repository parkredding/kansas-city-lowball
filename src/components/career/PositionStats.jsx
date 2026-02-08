/**
 * PositionStats - Performance breakdown by table position
 * Shows win rate, net result, and hands played for each position
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const POSITION_ORDER = ['BTN', 'CO', 'HJ', 'UTG', 'SB', 'BB'];
const POSITION_DESCRIPTIONS = {
  BTN: 'Button - Best position, acts last post-flop',
  CO: 'Cutoff - Second best position',
  HJ: 'Hijack - Middle position',
  UTG: 'Under the Gun - First to act',
  SB: 'Small Blind - Worst position post-flop',
  BB: 'Big Blind - Forced bet, defends often',
};

function PositionBar({ position, stats, maxHands, delay }) {
  const winRate = stats.hands > 0 ? (stats.won / stats.hands) * 100 : 0;
  const barWidth = maxHands > 0 ? (stats.hands / maxHands) * 100 : 0;
  const isProfit = stats.netResult >= 0;

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay * 0.08 }}
    >
      {/* Position label */}
      <div className="w-10 flex-shrink-0">
        <span className="text-sm font-bold text-slate-200 font-mono">{position}</span>
      </div>

      {/* Bar */}
      <div className="flex-1">
        <div className="h-7 bg-slate-700/30 rounded-md overflow-hidden relative">
          <motion.div
            className={`h-full rounded-md ${isProfit ? 'bg-green-500/40' : 'bg-red-500/40'}`}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ delay: delay * 0.08 + 0.2, duration: 0.5 }}
          />
          <div className="absolute inset-0 flex items-center px-2 justify-between">
            <span className="text-xs text-slate-300">{stats.hands} hands</span>
            <span className={`text-xs font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}{stats.netResult.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Win rate */}
      <div className="w-16 text-right flex-shrink-0">
        <span className="text-sm text-blue-400 font-medium">{winRate.toFixed(1)}%</span>
      </div>
    </motion.div>
  );
}

export default function PositionStats({ positionStats = {} }) {
  const { positions, maxHands } = useMemo(() => {
    const pos = POSITION_ORDER
      .filter((p) => positionStats[p])
      .map((p) => ({ position: p, ...positionStats[p] }));

    const max = pos.reduce((m, p) => Math.max(m, p.hands), 0);
    return { positions: pos, maxHands: max };
  }, [positionStats]);

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <p className="text-slate-500 text-sm">No position data available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
        Performance by Position
      </h3>

      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-slate-500 w-10">Pos</span>
        <span className="text-xs text-slate-500 flex-1 text-center">Hands & Net Result</span>
        <span className="text-xs text-slate-500 w-16 text-right">Win %</span>
      </div>

      <div className="space-y-2">
        {positions.map((pos, i) => (
          <div key={pos.position} title={POSITION_DESCRIPTIONS[pos.position]}>
            <PositionBar
              position={pos.position}
              stats={pos}
              maxHands={maxHands}
              delay={i}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
