/**
 * GTOPerformance - GTO accuracy stats and Leak Finder
 * Displays GTO grade, accuracy percentage, mistake log,
 * and identifies the top situations where the player loses EV
 */

import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

const GRADE_COLORS = {
  'A+': 'text-green-400',
  'A': 'text-green-400',
  'B+': 'text-blue-400',
  'B': 'text-blue-400',
  'C': 'text-amber-400',
  'D': 'text-orange-400',
  'F': 'text-red-400',
  'N/A': 'text-slate-500',
};

const GRADE_BG = {
  'A+': 'from-green-500/20 to-green-600/5 border-green-500/30',
  'A': 'from-green-500/20 to-green-600/5 border-green-500/30',
  'B+': 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  'B': 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  'C': 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  'D': 'from-orange-500/20 to-orange-600/5 border-orange-500/30',
  'F': 'from-red-500/20 to-red-600/5 border-red-500/30',
  'N/A': 'from-slate-500/20 to-slate-600/5 border-slate-500/30',
};

function GradeCard({ grade, accuracy, totalDecisions }) {
  return (
    <motion.div
      className={`rounded-xl border bg-gradient-to-br ${GRADE_BG[grade] || GRADE_BG['N/A']} p-6 text-center`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">GTO Grade</p>
      <p className={`text-5xl font-black ${GRADE_COLORS[grade] || 'text-slate-500'}`}>
        {grade}
      </p>
      <p className="text-sm text-slate-300 mt-2">
        {accuracy}% accuracy
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {totalDecisions} decisions analyzed
      </p>
    </motion.div>
  );
}

function MistakeLog({ mistakes }) {
  if (!mistakes || mistakes.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-slate-500">No mistakes recorded yet. Play against the AI bot.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mistakes.map((mistake, i) => (
        <motion.div
          key={i}
          className="rounded-lg bg-slate-700/30 p-3 border border-slate-600/30"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-200 font-medium">
              {mistake.description}
            </span>
            <span className="text-xs text-red-400 font-bold">
              -{mistake.totalEVLoss.toFixed(1)} EV
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{mistake.count}x occurrences</span>
            <span>Avg: -{(mistake.totalEVLoss / mistake.count).toFixed(2)} EV each</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function LeakFinderChart({ leaks }) {
  if (!leaks || leaks.length === 0) return null;

  const data = leaks.map((l) => ({
    name: `${l.position || '?'} / ${l.phase || '?'}`,
    evLoss: l.totalEVLoss,
    errors: l.occurrences,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#475569' }}
            tickFormatter={(v) => `-${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#475569' }}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => [`-${value.toFixed(1)} EV`, 'Total EV Loss']}
          />
          <Bar dataKey="evLoss" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#eab308'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function GTOPerformance({ gtoSummary }) {
  if (!gtoSummary || gtoSummary.totalDecisions === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
          GTO Performance
        </h3>
        <p className="text-slate-500 text-sm">
          Play against the AI bot to see your GTO accuracy analysis.
        </p>
        <p className="text-slate-600 text-xs mt-2">
          The system will track how closely your decisions match optimal (GTO) play.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grade and Accuracy */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GradeCard
          grade={gtoSummary.gtoGrade}
          accuracy={gtoSummary.accuracyPct}
          totalDecisions={gtoSummary.totalDecisions}
        />
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:col-span-2">
          <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-1">EV Analysis</h4>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-slate-500">Total EV Lost</p>
              <p className="text-xl font-bold text-red-400">
                -{gtoSummary.totalEVLoss.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg EV Loss / Hand</p>
              <p className="text-xl font-bold text-amber-400">
                -{gtoSummary.avgEVLossPerHand.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Correct Decisions</p>
              <p className="text-xl font-bold text-green-400">
                {gtoSummary.correctDecisions}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Mistakes</p>
              <p className="text-xl font-bold text-slate-300">
                {gtoSummary.totalDecisions - gtoSummary.correctDecisions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leak Finder */}
      {gtoSummary.leaks && gtoSummary.leaks.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
            Leak Finder
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Situations where you lose the most expected value against GTO play.
          </p>
          <LeakFinderChart leaks={gtoSummary.leaks} />
        </div>
      )}

      {/* Top 5 Mistake Log */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
          Top 5 Most Expensive Errors
        </h3>
        <MistakeLog mistakes={gtoSummary.topMistakes} />
      </div>
    </div>
  );
}
