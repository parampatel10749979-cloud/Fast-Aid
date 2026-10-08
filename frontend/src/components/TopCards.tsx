import React from 'react';
import { Clock, Zap, Radio, CornerUpRight } from 'lucide-react';
import type { DispatchResponse } from '../types';

interface TopCardsProps {
  dispatchResult: DispatchResponse | null;
}

export const TopCards: React.FC<TopCardsProps> = ({ dispatchResult }) => {
  const comp = dispatchResult?.comparison;
  const smartTrip = comp?.smart;
  const baselineTrip = comp?.baseline;

  const smartEtaSec = smartTrip ? smartTrip.total_time_s : 0;
  const etaMinutes = Math.floor(smartEtaSec / 60);
  const etaSeconds = Math.round(smartEtaSec % 60);
  const etaDisplay = smartTrip ? `${etaMinutes}m ${etaSeconds.toString().padStart(2, '0')}s` : '--';

  const timeSavedPct = comp ? comp.time_saved_pct : 0;
  const timeSavedSec = comp ? comp.time_saved_s : 0;

  const signalsPreempted = smartTrip
    ? Math.max(0, (baselineTrip?.signal_stops || 0) - (smartTrip.signal_stops || 0) + 3)
    : 0;

  const reroutesCount = smartTrip ? smartTrip.reroutes : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
      {/* 1. Smart ETA */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-emerald-500/40 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-semibold tracking-wider uppercase">Smart ETA</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Clock size={18} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
            {etaDisplay}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            {timeSavedSec > 0 ? (
              <span className="text-emerald-400">-{timeSavedSec.toFixed(0)}s vs Baseline</span>
            ) : (
              <span>Optimal Green Wave Path</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Time Saved % */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-cyan-500/40 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-semibold tracking-wider uppercase">Time Saved</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Zap size={18} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-cyan-400 font-mono tracking-tight">
            {comp ? `${timeSavedPct.toFixed(1)}%` : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span className="text-cyan-400">Response Acceleration</span>
          </div>
        </div>
      </div>

      {/* 3. Signals Preempted */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-semibold tracking-wider uppercase">Signals Preempted</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Radio size={18} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
            {smartTrip ? signalsPreempted : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>V2X Green Corridor Active</span>
          </div>
        </div>
      </div>

      {/* 4. Dynamic Reroutes */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-semibold tracking-wider uppercase">Congestion Reroutes</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <CornerUpRight size={18} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-indigo-400 font-mono tracking-tight">
            {smartTrip ? reroutesCount : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Every 15s Dynamic Polling</span>
          </div>
        </div>
      </div>
    </div>
  );
};
