import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  GitCompare,
  BarChart2,
  Gauge,
} from 'lucide-react';

interface BottomPlaybackBarProps {
  theme: 'dark' | 'light';
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  playbackSpeed: number;
  onSetSpeed: (speed: number) => void;
  progressFraction: number;
  onSeek: (frac: number) => void;
  currentTimeSeconds: number;
  totalDurationSeconds: number;
  currentSpeedKmh: number;
  isComplete: boolean;
  onOpenComparison: () => void;
  onOpenBenchmarks: () => void;
}

export const BottomPlaybackBar: React.FC<BottomPlaybackBarProps> = ({
  theme,
  isPlaying,
  onTogglePlay,
  onReplay,
  playbackSpeed,
  onSetSpeed,
  progressFraction,
  onSeek,
  currentTimeSeconds,
  totalDurationSeconds,
  currentSpeedKmh,
  isComplete,
  onOpenComparison,
  onOpenBenchmarks,
}) => {
  const isDark = theme === 'dark';

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`w-full max-w-3xl mx-auto px-4 py-2.5 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-200 ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/80 text-white shadow-black/80'
          : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-300/60'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Playback Controls & Speed */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTogglePlay}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-medium shadow-md transition-all active:scale-95 ${
              isDark
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/40'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/30'
            }`}
            title={isPlaying ? 'Pause simulation' : 'Start / resume simulation'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={onReplay}
            className={`p-2 rounded-xl transition-colors ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
            title="Restart from beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Selector */}
          <div
            className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => onSetSpeed(spd)}
                className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded transition-all ${
                  playbackSpeed === spd
                    ? isDark
                      ? 'bg-red-500/25 text-red-400 font-bold'
                      : 'bg-white text-red-600 font-bold shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Interactive Scrubber Slider */}
        <div className="flex-1 w-full flex items-center gap-2.5 min-w-0">
          <span
            className={`text-[11px] font-mono tabular-nums shrink-0 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {formatSec(currentTimeSeconds)}
          </span>

          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.002"
              value={progressFraction}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-red-500 bg-slate-700/50 hover:bg-slate-700"
            />
          </div>

          <span
            className={`text-[11px] font-mono tabular-nums shrink-0 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {formatSec(totalDurationSeconds)}
          </span>
        </div>

        {/* Right: Telemetry Tag & Action Modals */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Speed */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums ${
              isDark
                ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-red-500" />
            <span className="font-semibold text-red-500">{currentSpeedKmh}</span>
            <span className="text-[10px] text-slate-400">km/h</span>
          </div>

          {/* Compare Modal Button */}
          <button
            onClick={onOpenComparison}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            }`}
            title="Compare algorithm routes"
          >
            <GitCompare className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden sm:inline">Compare</span>
          </button>

          {/* Benchmarks Modal Button */}
          <button
            onClick={onOpenBenchmarks}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            }`}
            title="City benchmark stress tests"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Benchmarks</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomPlaybackBar;
