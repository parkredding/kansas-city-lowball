/**
 * RivalCard - Mini-dashboard for a rival player
 * Shows a radar chart comparing Hero vs Villain play styles
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from 'recharts';

function formatAmount(amount) {
  if (Math.abs(amount) >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount?.toLocaleString() || '0';
}

/**
 * Build radar chart data from hero and villain metrics
 */
function buildRadarData(heroMetrics, villainMetrics) {
  return [
    { stat: 'VPIP', hero: heroMetrics?.vpip || 0, villain: villainMetrics?.vpip || 0 },
    { stat: 'PFR', hero: heroMetrics?.pfr || 0, villain: villainMetrics?.pfr || 0 },
    { stat: 'Aggression', hero: heroMetrics?.aggressionFrequency || 0, villain: villainMetrics?.aggressionFrequency || 0 },
    { stat: 'SD Win%', hero: heroMetrics?.showdownWinRate || 0, villain: villainMetrics?.showdownWinRate || 0 },
    { stat: 'Non-SD%', hero: heroMetrics?.nonShowdownWinRate || 0, villain: villainMetrics?.nonShowdownWinRate || 0 },
    { stat: 'Fold2Stl', hero: heroMetrics?.foldToSteal || 0, villain: villainMetrics?.foldToSteal || 0 },
  ];
}

export default function RivalCard({
  rival,
  heroMetrics = null,
  villainMetrics = null,
  onSelect,
  isSelected = false,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showRadar = isHovered || isSelected;

  const isProfit = (rival.netResult || 0) >= 0;
  const winRate = rival.handsPlayed > 0
    ? ((rival.handsWon || 0) / rival.handsPlayed * 100).toFixed(1)
    : '0.0';

  const radarData = heroMetrics && villainMetrics
    ? buildRadarData(heroMetrics, villainMetrics)
    : null;

  return (
    <motion.div
      className={`
        rounded-xl border bg-slate-800/50 overflow-hidden cursor-pointer
        transition-all duration-200
        ${isSelected ? 'border-purple-500/60 ring-1 ring-purple-500/30' : 'border-slate-700/50 hover:border-slate-600'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.(rival)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Rival Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-slate-300">
              {(rival.villainDisplayName || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">
              {rival.villainDisplayName || 'Unknown'}
            </p>
            <p className="text-xs text-slate-500">{rival.handsPlayed} hands</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{formatAmount(rival.netResult || 0)}
          </p>
          <p className="text-xs text-blue-400">{winRate}% win</p>
        </div>
      </div>

      {/* Expandable Radar Chart */}
      <AnimatePresence>
        {showRadar && radarData && (
          <motion.div
            className="px-3 pb-3"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 180, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ResponsiveContainer width="100%" height={170}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis
                  dataKey="stat"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Radar
                  name="You"
                  dataKey="hero"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Radar
                  name="Rival"
                  dataKey="villain"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              <span className="text-blue-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> You
              </span>
              <span className="text-red-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Rival
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
