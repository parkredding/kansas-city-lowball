/**
 * StartingHandHeatmap - 13x13 grid visualizing Hold'em starting hand profitability
 * Upper-right = suited, lower-left = offsuit, diagonal = pairs
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildHeatmapData, RANKS } from '../../services/StatsService';

function getHeatColor(avgResult, maxAbsResult) {
  if (maxAbsResult === 0) return 'bg-slate-700';
  const normalized = avgResult / maxAbsResult; // -1 to 1

  if (normalized > 0.5) return 'bg-green-500';
  if (normalized > 0.2) return 'bg-green-600/80';
  if (normalized > 0.05) return 'bg-green-700/60';
  if (normalized > -0.05) return 'bg-slate-600';
  if (normalized > -0.2) return 'bg-red-700/60';
  if (normalized > -0.5) return 'bg-red-600/80';
  return 'bg-red-500';
}

function CellTooltip({ cell }) {
  if (!cell) return null;

  return (
    <motion.div
      className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl pointer-events-none"
      style={{ top: '-80px', left: '50%', transform: 'translateX(-50%)' }}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <p className="text-sm font-bold text-slate-200 mb-1">{cell.label}</p>
      <div className="space-y-0.5 text-xs">
        <p className="text-slate-400">Hands: <span className="text-slate-200">{cell.hands}</span></p>
        <p className="text-slate-400">
          Net: <span className={cell.netResult >= 0 ? 'text-green-400' : 'text-red-400'}>
            {cell.netResult >= 0 ? '+' : ''}{cell.netResult.toLocaleString()}
          </span>
        </p>
        <p className="text-slate-400">
          Win%: <span className="text-blue-400">{cell.winPct.toFixed(1)}%</span>
        </p>
        <p className="text-slate-400">
          Avg: <span className={cell.avgResult >= 0 ? 'text-green-400' : 'text-red-400'}>
            {cell.avgResult >= 0 ? '+' : ''}{cell.avgResult.toFixed(0)}
          </span>
        </p>
      </div>
      {cell.isPair && <p className="text-xs text-amber-400 mt-1">Pocket Pair</p>}
      {cell.isSuited && <p className="text-xs text-blue-400 mt-1">Suited</p>}
      {!cell.isPair && !cell.isSuited && <p className="text-xs text-slate-500 mt-1">Offsuit</p>}
    </motion.div>
  );
}

export default function StartingHandHeatmap({ startingHandStats = {} }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const { grid, maxAbsResult } = useMemo(() => {
    const g = buildHeatmapData(startingHandStats);
    let maxAbs = 0;
    for (const row of g) {
      for (const cell of row) {
        if (cell.hands > 0) {
          maxAbs = Math.max(maxAbs, Math.abs(cell.avgResult));
        }
      }
    }
    return { grid: g, maxAbsResult: maxAbs || 1 };
  }, [startingHandStats]);

  const hasData = Object.keys(startingHandStats).length > 0;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <p className="text-slate-500 text-sm">
          Play Hold'em hands to see your starting hand heatmap.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
        Starting Hand Profitability
      </h3>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-px" style={{ gridTemplateColumns: `24px repeat(13, minmax(28px, 1fr))` }}>
          {/* Header row */}
          <div />
          {RANKS.map((r) => (
            <div key={`h-${r}`} className="text-center text-xs text-slate-500 font-mono py-1">
              {r}
            </div>
          ))}

          {/* Grid rows */}
          {grid.map((row, rowIdx) => (
            <React.Fragment key={`row-${rowIdx}`}>
              <div className="text-center text-xs text-slate-500 font-mono flex items-center justify-center">
                {RANKS[rowIdx]}
              </div>
              {row.map((cell) => (
                <div
                  key={cell.label}
                  className={`
                    relative cursor-pointer text-center py-1.5 rounded-sm
                    text-xs font-mono transition-all
                    ${cell.hands > 0 ? getHeatColor(cell.avgResult, maxAbsResult) : 'bg-slate-800'}
                    ${cell.isPair ? 'ring-1 ring-amber-500/30' : ''}
                    hover:ring-2 hover:ring-white/40 hover:z-10
                  `}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <span className={`${cell.hands > 0 ? 'text-white/90' : 'text-slate-600'} text-[10px] sm:text-xs`}>
                    {cell.label}
                  </span>
                  <AnimatePresence>
                    {hoveredCell?.label === cell.label && (
                      <CellTooltip cell={cell} />
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span>Loss</span>
        <div className="flex gap-px">
          <div className="w-4 h-3 rounded-sm bg-red-500" />
          <div className="w-4 h-3 rounded-sm bg-red-600/80" />
          <div className="w-4 h-3 rounded-sm bg-red-700/60" />
          <div className="w-4 h-3 rounded-sm bg-slate-600" />
          <div className="w-4 h-3 rounded-sm bg-green-700/60" />
          <div className="w-4 h-3 rounded-sm bg-green-600/80" />
          <div className="w-4 h-3 rounded-sm bg-green-500" />
        </div>
        <span>Profit</span>
      </div>
    </div>
  );
}
