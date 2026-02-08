/**
 * PerformanceGraph - Multi-line cumulative winnings chart
 * Shows Total (Green), Showdown (Blue), and Non-Showdown (Red) lines
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-2">Hand #{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="font-bold" style={{ color: entry.color }}>
            {entry.value >= 0 ? '+' : ''}
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PerformanceGraph({ cumulativeData = [] }) {
  const data = useMemo(() => {
    if (cumulativeData.length === 0) return [];
    // Sample data if too many points (keep max ~200 for performance)
    if (cumulativeData.length > 200) {
      const step = Math.ceil(cumulativeData.length / 200);
      return cumulativeData.filter((_, i) => i % step === 0 || i === cumulativeData.length - 1);
    }
    return cumulativeData;
  }, [cumulativeData]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
        <p className="text-slate-500 text-sm">No hand data available yet. Play some hands to see your performance graph.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
        Performance Over Time
      </h3>
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="hand"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total Winnings"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="showdown"
              name="Showdown (Blue Line)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="5 3"
            />
            <Line
              type="monotone"
              dataKey="nonShowdown"
              name="Non-Showdown (Red Line)"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="5 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span><span className="inline-block w-3 h-0.5 bg-green-500 mr-1 align-middle" /> Green = Total profit/loss</span>
        <span><span className="inline-block w-3 h-0.5 bg-blue-500 mr-1 align-middle" /> Blue = Won at showdown</span>
        <span><span className="inline-block w-3 h-0.5 bg-red-500 mr-1 align-middle" /> Red = Won without showdown</span>
      </div>
    </div>
  );
}
