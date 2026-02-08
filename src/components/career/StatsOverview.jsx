/**
 * StatsOverview - Key stat cards for the Career Dashboard
 * Displays VPIP, PFR, Win Rate, Aggression Factor, BB/100, and totals
 */

import { motion } from 'framer-motion';

function StatCard({ label, value, suffix = '', description, color = 'slate', delay = 0 }) {
  const colorMap = {
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    slate: 'from-slate-500/20 to-slate-600/10 border-slate-500/30',
  };

  const valueColorMap = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    slate: 'text-slate-300',
  };

  return (
    <motion.div
      className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-4`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColorMap[color]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="text-sm ml-1 opacity-70">{suffix}</span>}
      </p>
      {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
    </motion.div>
  );
}

export default function StatsOverview({ stats, rivalFilter = null }) {
  if (!stats) return null;

  const netColor = stats.totalNetResult >= 0 ? 'green' : 'red';
  const netPrefix = stats.totalNetResult >= 0 ? '+' : '';

  return (
    <div>
      {rivalFilter && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <p className="text-xs text-purple-400">
            Filtered: Stats vs <span className="font-bold">{rivalFilter}</span>
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Hands Played"
          value={stats.totalHands}
          color="slate"
          delay={0}
        />
        <StatCard
          label="Net Result"
          value={`${netPrefix}${stats.totalNetResult.toLocaleString()}`}
          color={netColor}
          delay={1}
        />
        <StatCard
          label="Win Rate"
          value={stats.winRate}
          suffix="%"
          color="blue"
          description="Hands won"
          delay={2}
        />
        <StatCard
          label="VPIP"
          value={stats.vpip}
          suffix="%"
          color="amber"
          description="Voluntarily Put In Pot"
          delay={3}
        />
        <StatCard
          label="PFR"
          value={stats.pfr}
          suffix="%"
          color="purple"
          description="Pre-Flop Raise"
          delay={4}
        />
        <StatCard
          label="Aggression"
          value={stats.aggressionFactor}
          suffix="AF"
          color="red"
          description="Bet+Raise / Call ratio"
          delay={5}
        />
      </div>
    </div>
  );
}

export { StatCard };
