/**
 * TaleOfTheTape - Head-to-head comparison between Hero and Villain
 * Boxing-style "Tale of the Tape" stat comparison
 */

import { motion } from 'framer-motion';

function ComparisonRow({ label, heroValue, villainValue, suffix = '', higherIsBetter = true, delay = 0 }) {
  const heroNum = parseFloat(heroValue) || 0;
  const villainNum = parseFloat(villainValue) || 0;

  let heroWins, villainWins;
  if (higherIsBetter) {
    heroWins = heroNum > villainNum;
    villainWins = villainNum > heroNum;
  } else {
    heroWins = heroNum < villainNum;
    villainWins = villainNum < heroNum;
  }

  return (
    <motion.div
      className="grid grid-cols-3 items-center py-2 border-b border-slate-700/30 last:border-0"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.06 }}
    >
      {/* Hero value */}
      <div className="text-left">
        <span className={`text-sm font-bold ${heroWins ? 'text-green-400' : 'text-slate-300'}`}>
          {heroValue}{suffix}
          {heroWins && <span className="ml-1 text-xs text-green-500">*</span>}
        </span>
      </div>

      {/* Label */}
      <div className="text-center">
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>

      {/* Villain value */}
      <div className="text-right">
        <span className={`text-sm font-bold ${villainWins ? 'text-red-400' : 'text-slate-300'}`}>
          {villainValue}{suffix}
          {villainWins && <span className="ml-1 text-xs text-red-500">*</span>}
        </span>
      </div>
    </motion.div>
  );
}

export default function TaleOfTheTape({ heroName, villainName, hero, villain, insights = [] }) {
  if (!hero || !villain) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <p className="text-slate-500 text-sm">Select a rival to see head-to-head comparison.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-slate-800 to-red-600/20 p-4">
        <h3 className="text-center text-xs text-slate-400 uppercase tracking-widest mb-2">
          Tale of the Tape
        </h3>
        <div className="grid grid-cols-3 items-center">
          <div className="text-left">
            <p className="text-sm font-bold text-blue-400 truncate">{heroName || 'You'}</p>
            <p className="text-xs text-slate-500">{hero.totalHands} hands</p>
          </div>
          <div className="text-center">
            <span className="text-lg font-bold text-slate-400">VS</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-red-400 truncate">{villainName || 'Rival'}</p>
            <p className="text-xs text-slate-500">{villain.totalHands} hands</p>
          </div>
        </div>
      </div>

      {/* Stat Comparisons */}
      <div className="p-4">
        <ComparisonRow label="VPIP" heroValue={hero.vpip} villainValue={villain.vpip} suffix="%" delay={0} />
        <ComparisonRow label="PFR" heroValue={hero.pfr} villainValue={villain.pfr} suffix="%" delay={1} />
        <ComparisonRow label="Aggression" heroValue={hero.aggressionFrequency} villainValue={villain.aggressionFrequency} suffix="%" delay={2} />
        <ComparisonRow label="SD Win Rate" heroValue={hero.showdownWinRate} villainValue={villain.showdownWinRate} suffix="%" delay={3} />
        <ComparisonRow label="Bluff Success" heroValue={hero.bluffSuccessRate} villainValue={villain.bluffSuccessRate} suffix="%" delay={4} />
        <ComparisonRow label="3-Bet %" heroValue={hero.threeBetPct} villainValue={villain.threeBetPct} suffix="%" delay={5} />
        <ComparisonRow label="Fold to Steal" heroValue={hero.foldToSteal} villainValue={villain.foldToSteal} suffix="%" higherIsBetter={false} delay={6} />
        <ComparisonRow label="Avg Pot" heroValue={hero.avgPotSize} villainValue={villain.avgPotSize} delay={7} />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="border-t border-slate-700/50 p-4">
          <h4 className="text-xs text-amber-400 uppercase tracking-wide mb-2 font-semibold">
            Insights
          </h4>
          <ul className="space-y-1.5">
            {insights.map((insight, i) => (
              <motion.li
                key={i}
                className="text-xs text-slate-300 flex items-start gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <span className="text-amber-500 mt-0.5 flex-shrink-0">*</span>
                {insight}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
