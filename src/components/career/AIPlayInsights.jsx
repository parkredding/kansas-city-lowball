/**
 * AIPlayInsights - AI-generated analysis of the player's overall tendencies
 * Analyzes stats to provide actionable strategy insights on the Overview tab
 */

import { motion } from 'framer-motion';

/**
 * Generate play style insights from player stats
 */
function generatePlayStyleInsights(stats) {
  if (!stats || stats.totalHands < 5) return [];

  const insights = [];

  // VPIP analysis
  if (stats.vpip > 40) {
    insights.push({
      category: 'Hand Selection',
      severity: 'warning',
      text: `Your VPIP of ${stats.vpip}% is very loose. You're voluntarily entering too many pots. Tighten your starting hand requirements — fold more marginal hands, especially from early position.`,
    });
  } else if (stats.vpip > 30) {
    insights.push({
      category: 'Hand Selection',
      severity: 'caution',
      text: `Your VPIP of ${stats.vpip}% is on the loose side. Consider being more selective with your starting hands in early and middle positions.`,
    });
  } else if (stats.vpip < 15) {
    insights.push({
      category: 'Hand Selection',
      severity: 'caution',
      text: `Your VPIP of ${stats.vpip}% is very tight. You're folding too many playable hands. Open up your range from late position and steal more blinds.`,
    });
  } else {
    insights.push({
      category: 'Hand Selection',
      severity: 'good',
      text: `Your VPIP of ${stats.vpip}% is in a solid range. You're picking reasonable spots to get involved.`,
    });
  }

  // PFR / VPIP gap analysis
  const pfrVpipGap = stats.vpip - stats.pfr;
  if (stats.pfr > 0 && pfrVpipGap > 15) {
    insights.push({
      category: 'Pre-Flop Aggression',
      severity: 'warning',
      text: `Your PFR (${stats.pfr}%) is much lower than your VPIP (${stats.vpip}%). You're cold-calling too often instead of raising. When you enter a pot, raise more frequently — limping and calling gives up initiative.`,
    });
  } else if (stats.pfr > 0 && pfrVpipGap < 5) {
    insights.push({
      category: 'Pre-Flop Aggression',
      severity: 'good',
      text: `Your PFR/VPIP gap is tight (${stats.pfr}% / ${stats.vpip}%). You're entering pots aggressively rather than passively — that's a strong habit.`,
    });
  }

  // Aggression Factor analysis
  if (stats.aggressionFactor !== undefined) {
    if (stats.aggressionFactor > 3.5) {
      insights.push({
        category: 'Post-Flop Aggression',
        severity: 'caution',
        text: `Your Aggression Factor of ${stats.aggressionFactor} is very high. While aggression is profitable, over-aggression leads to expensive bluffs. Make sure you're balancing your bets with enough strong hands.`,
      });
    } else if (stats.aggressionFactor < 1.0) {
      insights.push({
        category: 'Post-Flop Aggression',
        severity: 'warning',
        text: `Your Aggression Factor of ${stats.aggressionFactor} is passive. You're calling much more than you bet or raise. Increase your c-bet frequency and value bet thinner to extract more from your strong hands.`,
      });
    } else if (stats.aggressionFactor >= 1.5 && stats.aggressionFactor <= 3.0) {
      insights.push({
        category: 'Post-Flop Aggression',
        severity: 'good',
        text: `Your Aggression Factor of ${stats.aggressionFactor} is well-balanced. You're mixing calls with bets and raises effectively.`,
      });
    }
  }

  // Win rate analysis
  if (stats.winRate > 55) {
    insights.push({
      category: 'Results',
      severity: 'good',
      text: `Your ${stats.winRate}% win rate is strong. You're consistently finishing hands profitably.`,
    });
  } else if (stats.winRate < 40) {
    insights.push({
      category: 'Results',
      severity: 'warning',
      text: `Your ${stats.winRate}% win rate is below average. Review your hand selection and post-flop decisions — focus on reducing leaks rather than chasing big pots.`,
    });
  }

  // Position analysis
  if (stats.positionStats) {
    const positions = Object.entries(stats.positionStats);
    const earlyPositionLoss = positions
      .filter(([pos]) => ['UTG', 'HJ'].includes(pos))
      .reduce((sum, [, s]) => sum + (s.netResult || 0), 0);
    const latePositionWin = positions
      .filter(([pos]) => ['BTN', 'CO'].includes(pos))
      .reduce((sum, [, s]) => sum + (s.netResult || 0), 0);

    if (earlyPositionLoss < -100 && latePositionWin > 0) {
      insights.push({
        category: 'Positional Play',
        severity: 'caution',
        text: `You're losing chips from early position but profiting in late position. Tighten up your UTG and HJ ranges — you may be playing too loose when out of position.`,
      });
    } else if (latePositionWin < 0) {
      insights.push({
        category: 'Positional Play',
        severity: 'warning',
        text: `You're not capitalizing on late position (BTN/CO). These are your most profitable seats — steal more blinds and apply more pressure when you have position.`,
      });
    }

    // Blind defense
    const bbStats = stats.positionStats.BB;
    if (bbStats && bbStats.hands > 5) {
      const bbWinRate = bbStats.hands > 0 ? (bbStats.won / bbStats.hands) * 100 : 0;
      if (bbWinRate < 30) {
        insights.push({
          category: 'Blind Defense',
          severity: 'caution',
          text: `You're winning only ${bbWinRate.toFixed(0)}% of hands from the Big Blind. Consider defending your BB wider against late-position steals.`,
        });
      }
    }
  }

  // Net result trend
  if (stats.totalNetResult < -500) {
    insights.push({
      category: 'Bankroll',
      severity: 'warning',
      text: `You're down ${Math.abs(stats.totalNetResult).toLocaleString()} chips overall. Focus on plugging leaks rather than trying to win it back quickly — tilt-driven play accelerates losses.`,
    });
  }

  return insights;
}

const SEVERITY_STYLES = {
  good: {
    icon: '+',
    iconColor: 'text-green-400',
    borderColor: 'border-green-500/20',
    bgColor: 'bg-green-500/5',
  },
  caution: {
    icon: '!',
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/5',
  },
  warning: {
    icon: '!!',
    iconColor: 'text-red-400',
    borderColor: 'border-red-500/20',
    bgColor: 'bg-red-500/5',
  },
};

export default function AIPlayInsights({ stats }) {
  const insights = generatePlayStyleInsights(stats);

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <p className="text-slate-500 text-sm">
          Play at least 5 hands to unlock AI play analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          AI Play Analysis
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Personalized insights based on your {stats.totalHands} hand history
        </p>
      </div>
      <div className="p-4 space-y-3">
        {insights.map((insight, i) => {
          const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.caution;
          return (
            <motion.div
              key={i}
              className={`rounded-lg ${style.bgColor} ${style.borderColor} border p-3`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-start gap-2">
                <span className={`${style.iconColor} font-bold text-xs mt-0.5 flex-shrink-0 w-4`}>
                  {style.icon}
                </span>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {insight.category}
                  </span>
                  <p className="text-sm text-slate-200 mt-0.5 leading-relaxed">
                    {insight.text}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
