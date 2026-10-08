import React from 'react';
import type { ComparisonBundle } from '../types';
import { ShieldCheck, TrendingDown, ArrowRight } from 'lucide-react';

interface ComparisonPanelProps {
  comparison: ComparisonBundle | null;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ comparison }) => {
  if (!comparison) return null;

  const { baseline, traffic, smart, time_saved_s, time_saved_pct } = comparison;

  const maxTime = Math.max(baseline.total_time_s, traffic.total_time_s, smart.total_time_s, 1);

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" size={20} />
          <h2 className="text-sm font-bold text-white tracking-wide">3-Mode Performance Matrix</h2>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 text-xs font-bold">
          <TrendingDown size={14} />
          <span>-{time_saved_pct.toFixed(1)}% ({time_saved_s.toFixed(0)}s saved)</span>
        </div>
      </div>

      {/* Visual Time Comparison Bars */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-blue-400">Baseline (Distance Only)</span>
            <span className="font-mono text-slate-300">{baseline.total_time_s.toFixed(1)}s</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(baseline.total_time_s / maxTime) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-amber-400">Traffic-Aware (Live Congestion)</span>
            <span className="font-mono text-slate-300">{traffic.total_time_s.toFixed(1)}s</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(traffic.total_time_s / maxTime) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span>Fast-Aid Smart (Green Corridor)</span>
              <span className="text-[10px] bg-emerald-500 text-slate-950 px-1 rounded font-black">FASTEST</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">{smart.total_time_s.toFixed(1)}s</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_#10b981]"
              style={{ width: `${(smart.total_time_s / maxTime) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-medium">
              <th className="pb-2">Routing Mode</th>
              <th className="pb-2 text-right">Total ETA</th>
              <th className="pb-2 text-right">Distance</th>
              <th className="pb-2 text-right">Signal Stops</th>
              <th className="pb-2 text-right">Signal Wait</th>
              <th className="pb-2 text-right">Reroutes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            <tr className="text-slate-300">
              <td className="py-2.5 font-sans font-semibold text-blue-400">Baseline</td>
              <td className="py-2.5 text-right">{baseline.total_time_s.toFixed(1)}s</td>
              <td className="py-2.5 text-right">{baseline.total_distance_m.toFixed(0)}m</td>
              <td className="py-2.5 text-right">{baseline.signal_stops}</td>
              <td className="py-2.5 text-right">{baseline.signal_wait_s.toFixed(1)}s</td>
              <td className="py-2.5 text-right">{baseline.reroutes}</td>
            </tr>
            <tr className="text-slate-300">
              <td className="py-2.5 font-sans font-semibold text-amber-400">Traffic-Aware</td>
              <td className="py-2.5 text-right">{traffic.total_time_s.toFixed(1)}s</td>
              <td className="py-2.5 text-right">{traffic.total_distance_m.toFixed(0)}m</td>
              <td className="py-2.5 text-right">{traffic.signal_stops}</td>
              <td className="py-2.5 text-right">{traffic.signal_wait_s.toFixed(1)}s</td>
              <td className="py-2.5 text-right">{traffic.reroutes}</td>
            </tr>
            <tr className="text-emerald-300 font-semibold bg-emerald-500/5">
              <td className="py-2.5 font-sans flex items-center gap-1.5 text-emerald-400">
                <ArrowRight size={12} /> Fast-Aid Smart
              </td>
              <td className="py-2.5 text-right font-bold text-emerald-400">{smart.total_time_s.toFixed(1)}s</td>
              <td className="py-2.5 text-right">{smart.total_distance_m.toFixed(0)}m</td>
              <td className="py-2.5 text-right text-emerald-400">{smart.signal_stops}</td>
              <td className="py-2.5 text-right text-emerald-400">{smart.signal_wait_s.toFixed(1)}s</td>
              <td className="py-2.5 text-right">{smart.reroutes}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
