import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Siren,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface EventItem {
  id: string;
  t: number;
  event: string;
}

interface EventLogProps {
  theme: 'dark' | 'light';
  events: EventItem[];
  latestEvent: string | null;
}

export const EventLog: React.FC<EventLogProps> = ({
  theme,
  events,
  latestEvent,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDark = theme === 'dark';

  // Auto-scroll to latest revealed item
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

  const getEventIcon = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('preempt') || lower.includes('signal') || lower.includes('green wave')) {
      return <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    }
    if (lower.includes('rerout') || lower.includes('bypass')) {
      return <Navigation className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    }
    if (lower.includes('incident') || lower.includes('warning') || lower.includes('gridlock')) {
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    }
    if (lower.includes('docked') || lower.includes('arrived') || lower.includes('reached') || lower.includes('trauma')) {
      return <CheckCircle className="w-3.5 h-3.5 text-cyan-500 shrink-0" />;
    }
    return <Siren className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  };

  return (
    <aside
      className={`w-76 sm:w-82 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/80 text-white shadow-black/80'
          : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-300/50'
      }`}
    >
      {/* Feed Header */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide uppercase">
            Trajectory Event Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {events.length} logs
          </span>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={isCollapsed ? 'Expand event log' : 'Collapse event log'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Events List Container */}
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="max-h-72 overflow-y-auto p-2.5 space-y-2 scrollbar-thin text-xs"
        >
          {events.length === 0 ? (
            <div className={`py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Awaiting live corridor telemetry...
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
                    className={`p-2 rounded-xl border transition-colors flex items-start gap-2.5 ${
                      isNew
                        ? isDark
                          ? 'bg-slate-800 border-red-500/40 text-slate-100'
                          : 'bg-red-50 border-red-300 text-slate-900'
                        : isDark
                        ? 'bg-slate-950/50 border-slate-800/70 text-slate-300'
                        : 'bg-slate-50/80 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5">{getEventIcon(item.event)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`font-mono text-[10px] tabular-nums ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {formatTimestamp(item.t)}
                        </span>
                        {isNew && (
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {item.event}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}
    </aside>
  );
};

export default EventLog;
