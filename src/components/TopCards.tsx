import React, { useEffect, useState } from 'react';
import { DispatchSummary, Hospital } from '../types';
import { Clock, Zap, Radio, CornerUpRight, ShieldAlert } from 'lucide-react';

interface TopCardsProps {
  theme: 'dark' | 'light';
  summary: DispatchSummary | null;
  destinationHospital?: Hospital | null;
  currentSpeedKmh: number;
  remainingSeconds: number;
  isComplete: boolean;
}

export const TopCards: React.FC<TopCardsProps> = ({
  theme,
  summary,
  destinationHospital,
  currentSpeedKmh,
  remainingSeconds,
  isComplete,
}) => {
  const isDark = theme === 'dark';

  // Animated counting up for numbers
  const [displaySavedPct, setDisplaySavedPct] = useState(0);
  const [displaySignals, setDisplaySignals] = useState(0);
  const [displayReroutes, setDisplayReroutes] = useState(0);

  const targetSavedPct = summary?.timeSavedPct ?? 46.2;
  const targetSignals = summary?.signalsPreempted ?? 7;
  const targetReroutes = summary?.reroutes ?? 2;

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 600; // ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setDisplaySavedPct(Math.round(targetSavedPct * easeOut * 10) / 10);
      setDisplaySignals(Math.round(targetSignals * easeOut));
      setDisplayReroutes(Math.round(targetReroutes * easeOut));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [targetSavedPct, targetSignals, targetReroutes]);

  // Format remaining time
  const formatTime = (totalSec: number) => {
    if (totalSec <= 0) return '00:00';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const etaDisplay = isComplete
    ? 'DOCKED'
    : formatTime(remainingSeconds > 0 ? remainingSeconds : (summary?.etaSeconds ?? 178));

  const cardBase = `px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-md flex items-center gap-2.5 transition-all ${
    isDark
      ? 'bg-slate-900/85 border-slate-800/80 text-white shadow-black/40'
      : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-200/60'
  }`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
      {/* Primary Hero Card: ETA & Live Status */}
      <div className={cardBase}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 text-red-500 shrink-0">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium leading-none">
            <span>LIVE ETA</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-red-500 font-bold tracking-wide">
              {isComplete ? 'TRAUMA BAY' : 'CODE 3'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-bold font-mono tracking-tight tabular-nums">
              {etaDisplay}
            </span>
            {!isComplete && (
              <span className="text-[10px] text-slate-400 tabular-nums">
                ({currentSpeedKmh} km/h)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metric 2: Time Saved vs Baseline */}
      <div className={cardBase}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 shrink-0">
          <Zap className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-medium leading-none">Time Saved</div>
          <div className="text-sm font-bold font-mono text-emerald-500 tabular-nums mt-0.5">
            +{displaySavedPct}%
          </div>
        </div>
      </div>

      {/* Metric 3: Green Wave Signals Preempted */}
      <div className={cardBase}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-500 shrink-0">
          <Radio className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-medium leading-none">Green Waves</div>
          <div className="text-sm font-bold font-mono tabular-nums mt-0.5">
            {displaySignals} <span className="text-[10px] font-normal text-slate-400">held</span>
          </div>
        </div>
      </div>

      {/* Metric 4: Dynamic Reroutes */}
      <div className={cardBase}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 shrink-0">
          <CornerUpRight className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-medium leading-none">Detours</div>
          <div className="text-sm font-bold font-mono tabular-nums mt-0.5">
            {displayReroutes} <span className="text-[10px] font-normal text-slate-400">bypasses</span>
          </div>
        </div>
      </div>

      {/* Destination Hospital Summary */}
      {destinationHospital && (
        <div className={`${cardBase} hidden xl:flex`}>
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-500 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div className="max-w-[140px]">
            <div className="text-[10px] text-slate-400 font-medium leading-none">Destination</div>
            <div className="text-xs font-semibold truncate mt-0.5">
              {destinationHospital.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopCards;
