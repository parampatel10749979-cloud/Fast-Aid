import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Siren,
  GitCompare,
  BarChart2,
  Crosshair,
  Compass,
  MapPin,
} from 'lucide-react';
import { Coordinates } from '../types';

export interface EventItem {
  id: string;
  t: number;
  event: string;
}

interface RightPanelProps {
  events: EventItem[];
  latestEvent: string | null;
  currentLat: number;
  currentLng: number;
  currentHeading: number;
  currentSpeedKmh: number;
  followAmbulance: boolean;
  onToggleFollow: () => void;
  onFitRoute: () => void;
  onResetOrigin: () => void;
  onOpenComparison: () => void;
  onOpenBenchmarks: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  events,
  latestEvent,
  currentLat,
  currentLng,
  currentHeading,
  currentSpeedKmh,
  followAmbulance,
  onToggleFollow,
  onFitRoute,
  onResetOrigin,
  onOpenComparison,
  onOpenBenchmarks,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const formatTimestamp = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getHeadingDirection = (deg: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((deg % 360) / 45)) % 8;
    return dirs[idx];
  };

  const getEventIcon = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('preempt') || lower.includes('signal') || lower.includes('green wave')) {
      return <Radio className="w-3.5 h-3.5 text-white shrink-0" />;
    }
    if (lower.includes('rerout') || lower.includes('bypass')) {
      return <Navigation className="w-3.5 h-3.5 text-neutral-300 shrink-0" />;
    }
    if (lower.includes('incident') || lower.includes('warning') || lower.includes('congestion')) {
      return <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />;
    }
    if (lower.includes('docked') || lower.includes('arrived') || lower.includes('trauma')) {
      return <CheckCircle className="w-3.5 h-3.5 text-white shrink-0" />;
    }
    return <Siren className="w-3.5 h-3.5 text-white shrink-0" />;
  };

  return (
    <aside className="w-80 sm:w-88 h-full flex flex-col bg-black/92 backdrop-blur-2xl border border-white/12 rounded-2xl shadow-2xl overflow-hidden select-none">
      {/* 1. Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-white" />
          <h2 className="text-xs font-bold tracking-wider text-white uppercase font-mono">
            Live Telemetry &amp; Logs
          </h2>
        </div>
        <div className="text-[10px] font-mono text-neutral-400">
          {events.length} events
        </div>
      </div>

      {/* 2. Live Telemetry Readout */}
      <div className="p-3 border-b border-white/10 bg-white/[0.02] grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="text-[10px] text-neutral-400 font-mono">COORDINATES</div>
          <div className="text-[11px] font-mono text-white mt-0.5 tabular-nums">
            {currentLat.toFixed(4)}°N
          </div>
          <div className="text-[11px] font-mono text-white tabular-nums">
            {currentLng.toFixed(4)}°E
          </div>
        </div>

        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="text-[10px] text-neutral-400 font-mono">HEADING &amp; SPEED</div>
          <div className="text-[11px] font-mono font-bold text-white mt-0.5 tabular-nums">
            {Math.round(currentHeading)}° {getHeadingDirection(currentHeading)}
          </div>
          <div className="text-[11px] font-mono text-white tabular-nums">
            {currentSpeedKmh} km/h
          </div>
        </div>
      </div>

      {/* Corridor Traffic Status Ribbon */}
      <div className="px-3 py-1.5 border-b border-white/10 bg-white/[0.01] flex items-center justify-between text-[10px] font-mono">
        <span className="text-neutral-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          ICCC Congestion Index:
        </span>
        <span className="text-white font-semibold">
          High (Ashram Rd &amp; SG Hwy)
        </span>
      </div>

      {/* 3. Camera / Map Action Strip */}
      <div className="p-2.5 border-b border-white/10 flex items-center justify-between gap-1.5 text-xs">
        <button
          onClick={onToggleFollow}
          className={`flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            followAmbulance
              ? 'bg-white text-black font-semibold border-white'
              : 'bg-black/60 border-white/15 text-neutral-300 hover:text-white'
          }`}
          title="Toggle camera following unit"
        >
          <Navigation className={`w-3.5 h-3.5 ${followAmbulance ? 'fill-black' : ''}`} />
          <span>{followAmbulance ? 'Tracking Unit' : 'Free Camera'}</span>
        </button>

        <button
          onClick={onFitRoute}
          className="p-1.5 rounded-lg border border-white/15 hover:border-white/30 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Fit entire corridor into view"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onResetOrigin}
          className="p-1.5 rounded-lg border border-white/15 hover:border-white/30 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Reset origin to Shivranjani Circle"
        >
          <MapPin className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4. Live Event Log List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin text-xs"
      >
        <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
          Corridor Event Sequence
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs">
            Awaiting corridor dispatch telemetry...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((item) => {
              const isNew = item.event === latestEvent;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`p-2.5 rounded-xl border transition-colors flex items-start gap-2.5 ${
                    isNew
                      ? 'bg-white/10 border-white text-white shadow-lg'
                      : 'bg-black/60 border-white/10 text-neutral-300'
                  }`}
                >
                  <div className="mt-0.5">{getEventIcon(item.event)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
                        {formatTimestamp(item.t)}
                      </span>
                      {isNew && (
                        <span className="text-[9px] font-bold text-white uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/20">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-neutral-200">
                      {item.event}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* 5. Modals Shortcut Footer */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02] grid grid-cols-2 gap-2">
        <button
          onClick={onOpenComparison}
          className="py-2 px-3 rounded-xl border border-white/15 hover:border-white/40 text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 transition-all text-xs font-medium cursor-pointer"
        >
          <GitCompare className="w-3.5 h-3.5 text-white" />
          <span>Compare Routes</span>
        </button>

        <button
          onClick={onOpenBenchmarks}
          className="py-2 px-3 rounded-xl border border-white/15 hover:border-white/40 text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 transition-all text-xs font-medium cursor-pointer"
        >
          <BarChart2 className="w-3.5 h-3.5 text-white" />
          <span>Benchmarks</span>
        </button>
      </div>
    </aside>
  );
};

export default RightPanel;
