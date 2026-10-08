import React, { useState } from 'react';
import type { BenchmarkData } from '../types';
import { BarChart3, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface BenchmarkPanelProps {
  benchmarkData: BenchmarkData | null;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ benchmarkData }) => {
  const [selectedChart, setSelectedChart] = useState<string>('avg_time_by_mode');

  if (!benchmarkData) return null;

  const chartKeys = Object.keys(benchmarkData.charts);

  const chartTitles: Record<string, string> = {
    avg_time_by_mode: 'Average Transit Time by Routing Mode',
    time_saved_boxplot: 'Time Saved Distribution (Boxplot)',
    time_saved_vs_congestion: 'Time Saved vs. Congestion Density',
    algorithm_comparison: 'Dijkstra vs. A* Efficiency Comparison',
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-cyan-400" size={20} />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              100-Trial Monte Carlo Benchmark Analysis
            </h2>
            <p className="text-[11px] text-slate-400">Pre-computed rigorous experimental validation across 4 congestion scenarios</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full font-mono">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>400 Total Simulated Trips</span>
        </div>
      </div>

      {/* Aggregate Benchmark Summary Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold">
              <th className="pb-2.5">Scenario</th>
              <th className="pb-2.5 text-right">Baseline ETA</th>
              <th className="pb-2.5 text-right">Traffic ETA</th>
              <th className="pb-2.5 text-right">Smart ETA</th>
              <th className="pb-2.5 text-right">Time Saved (s)</th>
              <th className="pb-2.5 text-right">Time Saved (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {benchmarkData.summary.map((row) => (
              <tr key={row.scenario} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 font-sans font-bold text-slate-200">{row.scenario}</td>
                <td className="py-2.5 text-right text-blue-400">{row.baseline_time_s.toFixed(1)}s</td>
                <td className="py-2.5 text-right text-amber-400">{row.traffic_time_s.toFixed(1)}s</td>
                <td className="py-2.5 text-right text-emerald-400 font-bold">{row.smart_time_s.toFixed(1)}s</td>
                <td className="py-2.5 text-right text-emerald-400 font-bold">+{row.time_saved_s.toFixed(1)}s</td>
                <td className="py-2.5 text-right">
                  <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-black text-[11px]">
                    +{row.time_saved_pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart Viewer Tabs */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <ImageIcon size={14} /> Charts:
          </span>
          {chartKeys.map((key) => (
            <button
              key={key}
              onClick={() => setSelectedChart(key)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                selectedChart === key
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {chartTitles[key] || key}
            </button>
          ))}
        </div>

        {/* Selected Chart Image */}
        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 p-2 flex items-center justify-center min-h-[300px]">
          {benchmarkData.charts[selectedChart] ? (
            <img
              src={`http://localhost:8000${benchmarkData.charts[selectedChart]}`}
              alt={chartTitles[selectedChart]}
              className="max-h-[420px] object-contain rounded-lg shadow-lg hover:scale-[1.01] transition-transform"
            />
          ) : (
            <div className="text-slate-500 text-xs italic">Select a chart above</div>
          )}
        </div>
      </div>
    </div>
  );
};
