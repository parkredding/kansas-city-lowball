/**
 * GTOStrategyInsights - Personalized GTO adjustment recommendations
 * Analyzes the player's GTO performance records and leak patterns
 * to generate actionable advice for moving toward GTO-optimal play
 */

import { motion } from 'framer-motion';

/**
 * Map of mistake type keys to their insight templates.
 * Keys match the "{ACTION} instead of {GTO_ACTION}" format from GTOService.computeGTOSummary.
 */
const MISTAKE_HANDLERS = {
  'FOLD instead of CALL': {
    priority: 'high',
    title: 'Folding Too Much When Getting Odds',
    text: (count, avgLoss) =>
      `You folded ${count} times when calling was GTO-optimal (avg ${avgLoss} EV lost each). You're likely over-folding to bets when pot odds justify a call. Before folding, calculate your pot odds — if the bet is less than ~33% of the pot, you need very few outs to call profitably.`,
  },
  'FOLD instead of RAISE': {
    priority: 'high',
    title: 'Missing Value and Bluff Raises',
    text: (count, avgLoss) =>
      `You folded ${count} times when raising was optimal (avg ${avgLoss} EV lost each). Some of these spots call for value raises with strong hands, others for bluff raises with blockers. Look for spots where you can represent strength, especially in position.`,
  },
  'CALL instead of RAISE': {
    priority: 'medium',
    title: 'Flat-Calling Instead of Raising for Value',
    text: (count, avgLoss) =>
      `You called ${count} times when raising was optimal (avg ${avgLoss} EV lost each). When you have a strong hand, raising builds the pot and charges draws. Practice identifying spots where your hand is strong enough to raise for value rather than just calling.`,
  },
  'CALL instead of FOLD': {
    priority: 'high',
    title: 'Calling Too Light — Hero Calls Costing You',
    text: (count, avgLoss) =>
      `You called ${count} times when folding was optimal (avg ${avgLoss} EV lost each). These are likely hero calls against strong ranges or chasing draws without the right odds. Discipline your calling range — if you can't beat many value hands, fold.`,
  },
  'RAISE instead of FOLD': {
    priority: 'high',
    title: 'Over-Aggression — Raising Weak Hands',
    text: (count, avgLoss) =>
      `You raised ${count} times when folding was optimal (avg ${avgLoss} EV lost each). This suggests over-bluffing or aggressing with hands that have poor equity. Tighten your raising range and reserve aggression for hands with showdown value or strong bluff equity.`,
  },
  'RAISE instead of CALL': {
    priority: 'medium',
    title: 'Over-Raising Medium-Strength Hands',
    text: (count, avgLoss) =>
      `You raised ${count} times when calling was optimal (avg ${avgLoss} EV lost each). Medium-strength hands often play better as calls — raising turns your hand into a bluff and folds out worse hands while keeping in better ones.`,
  },
  'CHECK instead of BET': {
    priority: 'medium',
    title: 'Missing Bet Opportunities',
    text: (count, avgLoss) =>
      `You checked ${count} times when betting was optimal (avg ${avgLoss} EV lost each). You're likely missing thin value bets or leaving protection bets on the table. When you have a hand worth betting, fire — especially in position.`,
  },
  'BET instead of CHECK': {
    priority: 'low',
    title: 'Over-Betting — Turning Checks Into Bets',
    text: (count, avgLoss) =>
      `You bet ${count} times when checking was optimal (avg ${avgLoss} EV lost each). Some hands play better as checks — either for pot control with medium-strength holdings, or to trap with strong hands. Not every hand needs a bet.`,
  },
};

const PHASE_LABELS = {
  PREFLOP: 'Pre-Flop',
  BETTING_1: 'First Bet',
  DRAW_1: 'First Draw',
  BETTING_2: 'Second Bet',
  DRAW_2: 'Second Draw',
  BETTING_3: 'Third Bet',
  DRAW_3: 'Third Draw',
  BETTING_4: 'Final Bet',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
};

const POSITION_ADVICE = {
  UTG: 'From Under the Gun, play a tighter range. Only enter pots with premium hands and be prepared to face 3-bets.',
  HJ: 'From the Hijack, start widening slightly but respect raises from later positions. Your opening range should still be selective.',
  CO: 'The Cutoff is a steal position — but if you\'re leaking here, you may be opening too wide or not adjusting to aggressive players behind you.',
  BTN: 'The Button is your most profitable position. If you\'re making mistakes here, focus on your post-flop play — you should be betting and raising more aggressively with position advantage.',
  SB: 'The Small Blind is inherently losing. Minimize losses by either folding or 3-betting rather than just completing. Avoid calling — it plays poorly out of position.',
  BB: 'From the Big Blind, your main job is defense. Make sure you\'re not over-defending vs large raises, but also not giving up too easily to min-raises and small opens.',
};

/**
 * Generate GTO strategy adjustment recommendations from summary + leak data
 */
function generateGTOInsights(gtoSummary) {
  if (!gtoSummary || gtoSummary.totalDecisions === 0) return [];

  const insights = [];
  const { accuracyPct, topMistakes, leaks, avgEVLossPerHand } = gtoSummary;

  // Overall grade-based framing
  if (accuracyPct >= 80) {
    insights.push({
      priority: 'low',
      title: 'Strong GTO Foundation',
      text: `Your ${accuracyPct}% accuracy shows solid fundamentals. The recommendations below target the remaining edge cases where small adjustments can compound into significant EV gains.`,
    });
  } else if (accuracyPct >= 60) {
    insights.push({
      priority: 'medium',
      title: 'Room for Improvement',
      text: `At ${accuracyPct}% accuracy, you understand core concepts but deviate in key spots. Focus on the highest-EV corrections below — fixing your top 2-3 leaks will have the biggest impact on your results.`,
    });
  } else {
    insights.push({
      priority: 'high',
      title: 'Significant GTO Gaps',
      text: `Your ${accuracyPct}% accuracy indicates frequent deviations from optimal play. Start with the fundamentals: tighten pre-flop ranges, respect pot odds, and avoid hero calls. Focus on one leak at a time.`,
    });
  }

  // Analyze top mistake patterns using the handler map
  if (topMistakes && topMistakes.length > 0) {
    for (const mistake of topMistakes.slice(0, 3)) {
      const desc = mistake.description || '';
      const avgLoss = mistake.count > 0 ? (mistake.totalEVLoss / mistake.count).toFixed(1) : '0';

      const handlerKey = Object.keys(MISTAKE_HANDLERS).find((key) => desc.includes(key));
      if (handlerKey) {
        const handler = MISTAKE_HANDLERS[handlerKey];
        insights.push({
          priority: handler.priority,
          title: handler.title,
          text: handler.text(mistake.count, avgLoss),
        });
      }
    }
  }

  // Analyze positional leaks
  if (leaks && leaks.length > 0) {
    const worstLeak = leaks[0];
    const posName = worstLeak.position || 'Unknown';
    const phaseName = formatPhase(worstLeak.phase);

    insights.push({
      priority: worstLeak.totalEVLoss > 50 ? 'high' : 'medium',
      title: `Biggest Positional Leak: ${posName} during ${phaseName}`,
      text: `Your worst leak is in ${posName} during the ${phaseName} phase (${worstLeak.occurrences} mistakes, ${worstLeak.totalEVLoss.toFixed(1)} total EV lost). ${getPositionAdvice(posName)}`,
    });

    // If there's a second significant leak, mention it
    if (leaks.length > 1 && leaks[1].totalEVLoss > 20) {
      const second = leaks[1];
      insights.push({
        priority: 'low',
        title: `Secondary Leak: ${second.position || '?'} / ${formatPhase(second.phase)}`,
        text: `Also watch for mistakes from ${second.position || '?'} during ${formatPhase(second.phase)} — ${second.occurrences} errors costing ${second.totalEVLoss.toFixed(1)} EV total.`,
      });
    }
  }

  // EV loss rate insight
  if (avgEVLossPerHand > 5) {
    insights.push({
      priority: 'high',
      title: 'High EV Bleed Rate',
      text: `You're losing an average of ${avgEVLossPerHand.toFixed(1)} EV per decision. At this rate, GTO deviations are a major source of chip loss. Focus on eliminating the most expensive mistake pattern first — even fixing one leak can cut this significantly.`,
    });
  } else if (avgEVLossPerHand > 2) {
    insights.push({
      priority: 'medium',
      title: 'Moderate EV Leakage',
      text: `You're losing ${avgEVLossPerHand.toFixed(1)} EV per decision on average. This is manageable but adds up over sessions. Target the top mistake pattern to tighten this up.`,
    });
  }

  return insights;
}

function formatPhase(phase) {
  if (!phase) return 'Unknown';
  return PHASE_LABELS[phase] || phase;
}

function getPositionAdvice(position) {
  return POSITION_ADVICE[position] || 'Focus on tightening your range and making more disciplined decisions in this spot.';
}

const PRIORITY_STYLES = {
  high: {
    tag: 'HIGH PRIORITY',
    tagColor: 'text-red-400 bg-red-500/15 border-red-500/30',
    borderColor: 'border-red-500/20',
    bgColor: 'bg-red-500/5',
  },
  medium: {
    tag: 'MEDIUM',
    tagColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/5',
  },
  low: {
    tag: 'FINE-TUNING',
    tagColor: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/5',
  },
};

export default function GTOStrategyInsights({ gtoSummary }) {
  const insights = generateGTOInsights(gtoSummary);

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          GTO Strategy Adjustments
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Personalized recommendations to move your play closer to GTO based on your {gtoSummary.totalDecisions} analyzed decisions
        </p>
      </div>
      <div className="p-4 space-y-3">
        {insights.map((insight, i) => {
          const style = PRIORITY_STYLES[insight.priority] || PRIORITY_STYLES.medium;
          return (
            <motion.div
              key={insight.title}
              className={`rounded-lg ${style.bgColor} ${style.borderColor} border p-3`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.tagColor}`}>
                  {style.tag}
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {insight.title}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {insight.text}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
