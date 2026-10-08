import React from 'react';
import { motion } from 'motion/react';
import { X, Zap, ShieldCheck } from 'lucide-react';
import { DispatchSummary } from '../types';

interface ComparisonPanelProps {
  summary: DispatchSummary | null;
  onClose: () => void;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  summary,
  onClose,
}) => {
  const smartSec = summary?.etaSeconds ?? 178;
  const trafficSec = summary?.trafficEtaSeconds ?? 260;
  const baselineSec = summary?.baselineEtaSeconds ?? 330;

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const rows = [
    {
      metric: 'Estimated Transit Duration',
      baseline: formatMinSec(baselineSec),
      traffic: formatMinSec(trafficSec),
      smart: formatMinSec(smartSec),
      highlight: true,
    },
    {
      metric: 'Intersection Delay (Red Lights)',
      baseline: '112 seconds',
      traffic: '68 seconds',
      smart: '0 seconds (Green Corridor)',
      highlight: false,
    },
    {
      metric: 'V2X Signal Preemption',
      baseline: 'None (Regular cycle)',
      traffic: 'None (Regular cycle)',
      smart: `${summary?.signalsPreempted ?? 7} Green Waves Held`,
      highlight: false,
    },
    {
      metric: 'Dynamic Detour Efficiency',
      baseline: 'Static path',
      traffic: 'Fixed traffic model',
      smart: `${summary?.reroutes ?? 2} Adaptive bypasses`,
      highlight: false,
    },
    {
      metric: 'Average Transit Velocity',
      baseline: '29 km/h',
      traffic: '38 km/h',
      smart: '58 km/h',
      highlight: false,
    },
  ];

  const maxSec = Math.max(baselineSec, trafficSec, smartSec);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl bg-black border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Route Algorithm Comparison</h3>
              <p className="text-xs text-neutral-400">
                Evaluating Fast-Aid 108 green wave against conventional transit models in Ahmedabad
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

        {/* Visual Duration Bars */}
        <div className="p-5 border-b border-white/10 bg-white/[0.01] space-y-3">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Transit Duration Benchmark
          </div>

          {/* Baseline Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Baseline Direct Path</span>
              <span className="font-mono tabular-nums">{formatMinSec(baselineSec)}</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-neutral-600 rounded-full transition-all duration-500"
                style={{ width: `${(baselineSec / maxSec) * 100}%` }}
              />
            </div>
          </div>

          {/* Traffic Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Traffic-Aware Route</span>
              <span className="font-mono tabular-nums">{formatMinSec(trafficSec)}</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-neutral-400 rounded-full transition-all duration-500"
                style={{ width: `${(trafficSec / maxSec) * 100}%` }}
              />
            </div>
          </div>

          {/* Fast-Aid Smart Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white font-semibold">
              <span className="flex items-center gap-1.5 text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                Fast-Aid 108 Smart (AMC Green Wave)
              </span>
              <span className="font-mono text-white tabular-nums">
                {formatMinSec(smartSec)} (-{summary?.timeSavedPct ?? 46.2}%)
              </span>
            </div>
            <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-white/40 ring-2 ring-white/20">
              <div
                className="h-full bg-white shadow-[0_0_12px_#ffffff] rounded-full transition-all duration-500"
                style={{ width: `${(smartSec / maxSec) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="p-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400">
                <th className="pb-2 font-medium">Metric</th>
                <th className="pb-2 font-medium text-neutral-500">Baseline</th>
                <th className="pb-2 font-medium text-neutral-300">Traffic-Aware</th>
                <th className="pb-2 font-semibold text-white">Fast-Aid 108</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-sans">
              {rows.map((row, idx) => (
                <tr key={idx} className={row.highlight ? 'bg-white/[0.04]' : ''}>
                  <td className="py-2.5 text-neutral-300 font-medium">{row.metric}</td>
                  <td className="py-2.5 text-neutral-500 font-mono tabular-nums">{row.baseline}</td>
                  <td className="py-2.5 text-neutral-300 font-mono tabular-nums">{row.traffic}</td>
                  <td className="py-2.5 text-white font-mono font-bold tabular-nums">
                    {row.smart}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default ComparisonPanel;
