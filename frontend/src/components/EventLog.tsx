import React, { useEffect, useRef } from 'react';
import type { TrajectoryEvent } from '../types';
import {
  Siren,
  Radio,
  CornerUpRight,
  Clock,
  CheckCircle2,
  Navigation,
} from 'lucide-react';

interface EventLogProps {
  events: TrajectoryEvent[];
  currentTime: number;
}

export const EventLog: React.FC<EventLogProps> = ({ events, currentTime }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter events that have happened up to currentTime
  const pastEvents = events.filter((e) => e.t <= currentTime);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [pastEvents.length]);

  const getEventBadge = (event: string) => {
    switch (event) {
      case 'dispatch':
        return {
          icon: <Siren size={14} className="text-emerald-400" />,
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          title: 'Emergency Dispatched',
        };
      case 'preemption':
        return {
          icon: <Radio size={14} className="text-teal-400" />,
          bg: 'bg-teal-500/10 border-teal-500/30 text-teal-300',
          title: 'Green Corridor V2X',
        };
      case 'reroute':
        return {
          icon: <CornerUpRight size={14} className="text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          title: 'Congestion Reroute',
        };
      case 'signal_wait':
        return {
          icon: <Clock size={14} className="text-red-400" />,
          bg: 'bg-red-500/10 border-red-500/30 text-red-300',
          title: 'Red Signal Delay',
        };
      case 'arrive':
        return {
          icon: <CheckCircle2 size={14} className="text-cyan-400" />,
          bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
          title: 'Arrived at Hospital',
        };
      default:
        return {
          icon: <Navigation size={14} className="text-slate-400" />,
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          title: 'En Route',
        };
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col h-full max-h-[380px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Telemetry Event Feed
        </h3>
        <span className="text-[10px] font-mono text-slate-400">
          {pastEvents.length} of {events.length} events
        </span>
      </div>

      <div ref={containerRef} className="space-y-2 overflow-y-auto flex-1 pr-1">
        {pastEvents.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 italic">
            Waiting for ambulance dispatch...
          </div>
        ) : (
          pastEvents.map((evt, idx) => {
            const badge = getEventBadge(evt.event);
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${badge.bg}`}
              >
                <div className="mt-0.5">{badge.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px]">{badge.title}</span>
                    <span className="font-mono text-[10px] text-slate-400">+{evt.t.toFixed(1)}s</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 truncate">{evt.detail}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
