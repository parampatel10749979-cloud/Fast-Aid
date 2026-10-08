import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, BarChart3 } from 'lucide-react';
import { BenchmarkRow, BenchmarkResponse } from '../types';
import { fetchBenchmarks } from '../api/client';

interface BenchmarkPanelProps {
  onClose: () => void;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ onClose }) => {
  const [data, setData] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchBenchmarks().then((res: BenchmarkResponse) => {
      if (mounted) {
        setData(res.rows);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-black border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Simulation Benchmarks</h3>
              <p className="text-xs text-neutral-400">
                100-trial cross-scenario performance of Fast-Aid V2X corridor vs baseline transit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 space-y-6 overflow-y-auto scrollbar-thin">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-neutral-400">Avg Time Saved</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5 tabular-nums">
                55.7%
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">Across 5 city stress tests</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-neutral-400">Peak Hour Gain</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5 tabular-nums">
                -14.7 min
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">Ashram Road &amp; SG Highway gridlock</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-neutral-400">Green Wave Clearance</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5 tabular-nums">
                98.4%
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">AMC ICCC corridor passage rate</div>
            </div>
          </div>

          {/* Clean Monochrome Bar Chart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">
                Transit Time by Scenario (Minutes)
              </span>
              <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-neutral-600 inline-block" />
                  Baseline
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-neutral-400 inline-block" />
                  Traffic-Aware
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-white inline-block" />
                  Fast-Aid 108
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-40 flex items-center justify-center text-xs text-neutral-500">
                Loading benchmark data...
              </div>
            ) : (
              <div className="space-y-3.5 bg-white/[0.02] p-4 rounded-xl border border-white/10">
                {data.map((row) => {
                  const maxVal = 35;
                  return (
                    <div key={row.scenario} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-200 font-medium">{row.scenario}</span>
                        <span className="text-white font-mono font-bold tabular-nums">
                          -{row.timeSavedPct}%
                        </span>
                      </div>

                      {/* Grouped Bar Row */}
                      <div className="space-y-1">
                        {/* Baseline */}
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="h-full bg-neutral-600 rounded-full"
                              style={{ width: `${(row.baseline / maxVal) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-neutral-500 w-10 text-right tabular-nums">
                            {row.baseline}m
                          </span>
                        </div>

                        {/* Traffic-Aware */}
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="h-full bg-neutral-400 rounded-full"
                              style={{ width: `${(row.trafficAware / maxVal) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400 w-10 text-right tabular-nums">
                            {row.trafficAware}m
                          </span>
                        </div>

                        {/* Smart */}
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-white/20">
                            <div
                              className="h-full bg-white shadow-[0_0_8px_#ffffff] rounded-full"
                              style={{ width: `${(row.smart / maxVal) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-white font-bold w-10 text-right tabular-nums">
                            {row.smart}m
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Benchmark Table */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-neutral-400 border-b border-white/10">
                <tr>
                  <th className="p-3 font-medium">Scenario</th>
                  <th className="p-3 font-medium text-neutral-500 text-right">Baseline</th>
                  <th className="p-3 font-medium text-neutral-300 text-right">Traffic-Aware</th>
                  <th className="p-3 font-medium text-white text-right">Fast-Aid 108</th>
                  <th className="p-3 font-medium text-white text-right">Time Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-mono tabular-nums">
                {data.map((row) => (
                  <tr key={row.scenario} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-sans text-neutral-200">{row.scenario}</td>
                    <td className="p-3 text-neutral-500 text-right">{row.baseline} min</td>
                    <td className="p-3 text-neutral-300 text-right">{row.trafficAware} min</td>
                    <td className="p-3 text-white font-bold text-right">{row.smart} min</td>
                    <td className="p-3 text-white font-bold text-right">
                      +{row.timeSavedPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end bg-white/[0.02]">
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BenchmarkPanel;
