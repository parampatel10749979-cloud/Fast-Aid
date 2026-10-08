import React, { useState } from 'react';
import { Hospital, Coordinates, DispatchSummary } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Navigation,
  MapPin,
  Clock,
  Zap,
  Radio,
  CornerUpRight,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  Activity,
  Shield,
} from 'lucide-react';

interface LeftPanelProps {
  summary: DispatchSummary | null;
  destinationHospital?: Hospital | null;
  currentSpeedKmh: number;
  remainingSeconds: number;
  isComplete: boolean;

  // Dispatch Controls
  hospitals: Hospital[];
  selectedHospitalId: string;
  onSelectHospital: (id: string) => void;
  startCoords: Coordinates;
  onResetStartCoords: () => void;
  scenario: 'Light' | 'Moderate' | 'Heavy' | 'Gridlock';
  onSelectScenario: (s: 'Light' | 'Moderate' | 'Heavy' | 'Gridlock') => void;
  specialty: 'cardiac' | 'trauma' | 'stroke' | null;
  onSelectSpecialty: (s: 'cardiac' | 'trauma' | 'stroke' | null) => void;
  algorithm: 'dijkstra' | 'astar';
  onSelectAlgorithm: (algo: 'dijkstra' | 'astar') => void;
  preemption: boolean;
  onTogglePreemption: (v: boolean) => void;
  onDispatch: () => void;
  isDispatching: boolean;

  // Playback
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  playbackSpeed: number;
  onSetSpeed: (speed: number) => void;
  progressFraction: number;
  onSeek: (frac: number) => void;
  currentTimeSeconds: number;
  totalDurationSeconds: number;

  // Layers & Heatmap
  showSmart: boolean;
  setShowSmart: (v: boolean) => void;
  showTraffic: boolean;
  setShowTraffic: (v: boolean) => void;
  showBaseline: boolean;
  setShowBaseline: (v: boolean) => void;
  showTrafficHeatmap: boolean;
  setShowTrafficHeatmap: (v: boolean) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  summary,
  destinationHospital,
  currentSpeedKmh,
  remainingSeconds,
  isComplete,
  hospitals,
  selectedHospitalId,
  onSelectHospital,
  scenario,
  onSelectScenario,
  specialty,
  onSelectSpecialty,
  algorithm,
  onSelectAlgorithm,
  preemption,
  onTogglePreemption,
  onDispatch,
  isDispatching,
  isPlaying,
  onTogglePlay,
  onReplay,
  playbackSpeed,
  onSetSpeed,
  progressFraction,
  onSeek,
  currentTimeSeconds,
  totalDurationSeconds,
  showSmart,
  setShowSmart,
  showTraffic,
  setShowTraffic,
  showBaseline,
  setShowBaseline,
  showTrafficHeatmap,
  setShowTrafficHeatmap,
}) => {
  const [showConfig, setShowConfig] = useState(false);

  const formatSec = (s: number) => {
    if (s <= 0) return '00:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const etaDisplay = isComplete
    ? 'DOCKED'
    : formatSec(remainingSeconds > 0 ? remainingSeconds : (summary?.etaSeconds ?? 82));

  return (
    <aside className="w-80 sm:w-92 h-full flex flex-col bg-black/92 backdrop-blur-2xl border border-white/12 rounded-2xl shadow-2xl overflow-hidden select-none">
      {/* 1. Brand Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_#ffffff] animate-pulse" />
          <div>
            <h1 className="text-sm font-black tracking-wider text-white font-mono flex items-center gap-1.5">
              FAST-AID
            </h1>
            <p className="text-[10px] text-neutral-400 tracking-wide">
              Autonomous V2X Green Wave Corridor
            </p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono text-white">
          FASTAPI · {scenario.toUpperCase()}
        </div>
      </div>

      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin">
        {/* 2. Hero Status & ETA */}
        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-white" />
              ESTIMATED TIME OF ARRIVAL
            </span>
            <span className="font-semibold text-white tracking-wider">
              {isComplete ? 'BAY DOCKED' : 'SMART V2X'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white tabular-nums">
              {etaDisplay}
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-white tabular-nums">
                {currentSpeedKmh} <span className="text-[10px] font-normal text-neutral-400">km/h</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">1.25x Siren Boost</div>
            </div>
          </div>

          {destinationHospital && (
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-neutral-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-white" /> Target Bay:
              </span>
              <span className="font-semibold text-white truncate max-w-[170px]">
                {destinationHospital.name}
              </span>
            </div>
          )}
        </div>

        {/* 3. Core Metrics Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-neutral-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-white" /> Saved
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
              +{summary?.timeSavedPct ?? 18.1}%
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-neutral-400 flex items-center gap-1">
              <Radio className="w-3 h-3 text-white" /> Preempted
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
              {summary?.signalsPreempted ?? 7} <span className="text-[10px] text-neutral-400 font-normal">signals</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-neutral-400 flex items-center gap-1">
              <CornerUpRight className="w-3 h-3 text-white" /> Reroutes
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
              {summary?.reroutes ?? 2} <span className="text-[10px] text-neutral-400 font-normal">bypasses</span>
            </div>
          </div>
        </div>

        {/* Quick Traffic Density Heatmap Switch */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className={`w-4 h-4 transition-colors ${showTrafficHeatmap ? 'text-amber-400' : 'text-neutral-500'}`} />
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  Traffic Density Heatmap
                  {showTrafficHeatmap && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-neutral-400">
                  Real-time network congestion
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTrafficHeatmap(!showTrafficHeatmap)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                showTrafficHeatmap ? 'bg-white' : 'bg-neutral-800'
              }`}
              role="switch"
              aria-checked={showTrafficHeatmap}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  showTrafficHeatmap ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Heatmap Congestion Color Scale */}
          {showTrafficHeatmap && (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <div className="flex justify-between text-[9px] font-mono text-neutral-400 uppercase">
                <span>Free Flow</span>
                <span>Moderate</span>
                <span>Heavy</span>
                <span className="text-red-400 font-bold">Gridlock</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-red-600 shadow-xs" />
            </div>
          )}
        </div>

        {/* 4. Timeline Playback & Scrubber */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-300">Corridor Playback</span>
            <div className="flex items-center gap-1">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onSetSpeed(spd)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-white text-black font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Scrub Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.002"
              value={progressFraction}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-400">
              <span>{formatSec(currentTimeSeconds)}</span>
              <span>{Math.round(progressFraction * 100)}%</span>
              <span>{formatSec(totalDurationSeconds)}</span>
            </div>
          </div>

          {/* Play/Pause Buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onTogglePlay}
              className="flex-1 py-1.5 px-3 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
              <span>{isPlaying ? 'Pause' : isComplete ? 'Resume' : 'Play'}</span>
            </button>
            <button
              onClick={onReplay}
              className="ml-2 p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Restart mission playback"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5. Dispatch Action Button */}
        <div>
          <button
            onClick={onDispatch}
            disabled={isDispatching}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-white text-black hover:bg-neutral-200 shadow-xl shadow-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-4 h-4 fill-black" />
            <span>{isDispatching ? 'Computing Backend Corridor...' : 'Dispatch Fast-Aid 108'}</span>
          </button>
        </div>

        {/* 6. Collapsible Parameters Accordion */}
        <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full px-3 py-2.5 flex items-center justify-between text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Backend Simulation Settings
            </span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showConfig && (
            <div className="p-3 border-t border-white/10 space-y-3 text-xs">
              {/* Destination Facility (Server Auto-Selection) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Target Hospital</span>
                  {selectedHospitalId === 'auto' && (
                    <span className="text-[10px] text-amber-400 font-mono font-medium">
                      Server Auto-Select
                    </span>
                  )}
                </div>
                <select
                  value={selectedHospitalId}
                  onChange={(e) => onSelectHospital(e.target.value)}
                  className="w-full p-2 rounded-lg bg-black border border-white/20 text-white text-xs focus:outline-hidden cursor-pointer"
                >
                  <option value="auto">
                    Auto-Select {destinationHospital && selectedHospitalId === 'auto' ? `(Dijkstra: ${destinationHospital.name})` : '(Fastest Emergency Bay)'}
                  </option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.capacity ?? 18} beds)
                    </option>
                  ))}
                </select>

                {selectedHospitalId === 'auto' && destinationHospital && (
                  <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      Resolved Hospital:
                    </span>
                    <span className="font-semibold text-white truncate max-w-[170px]">
                      {destinationHospital.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Traffic Scenario & Medical Specialty */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Traffic Scenario</label>
                  <select
                    value={scenario}
                    onChange={(e) => onSelectScenario(e.target.value as any)}
                    className="w-full p-1.5 rounded-lg bg-black border border-white/15 text-white text-xs focus:outline-hidden cursor-pointer"
                  >
                    <option value="Light">Light (10%)</option>
                    <option value="Moderate">Moderate (30%)</option>
                    <option value="Heavy">Heavy (60%)</option>
                    <option value="Gridlock">Gridlock (85%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Medical Specialty</label>
                  <select
                    value={specialty || 'all'}
                    onChange={(e) => onSelectSpecialty(e.target.value === 'all' ? null : (e.target.value as any))}
                    className="w-full p-1.5 rounded-lg bg-black border border-white/15 text-white text-xs focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">Any Specialty</option>
                    <option value="cardiac">Cardiac</option>
                    <option value="trauma">Trauma</option>
                    <option value="stroke">Stroke</option>
                  </select>
                </div>
              </div>

              {/* Routing Algorithm */}
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Routing Algorithm</label>
                <select
                  value={algorithm}
                  onChange={(e) => onSelectAlgorithm(e.target.value as 'dijkstra' | 'astar')}
                  className="w-full p-1.5 rounded-lg bg-black border border-white/15 text-white text-xs focus:outline-hidden cursor-pointer"
                >
                  <option value="dijkstra">Dijkstra Shortest Path</option>
                  <option value="astar">A* (Haversine Heuristic)</option>
                </select>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center justify-between p-2 rounded-lg bg-black/60 border border-white/10 hover:border-white/20 cursor-pointer">
                  <div>
                    <div className="font-medium text-white flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-white" />
                      V2X Signal Preemption
                    </div>
                    <div className="text-[10px] text-neutral-400">Green wave next 3 signals</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preemption}
                    onChange={(e) => onTogglePreemption(e.target.checked)}
                    className="w-4 h-4 accent-white rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Layer Visibility */}
              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] text-neutral-400 mb-1.5">Simulation Modes (All Computed)</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setShowSmart(!showSmart)}
                    className={`p-1.5 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      showSmart
                        ? 'bg-white text-black font-bold border-white'
                        : 'bg-black border-white/10 text-neutral-500'
                    }`}
                  >
                    {showSmart ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Smart
                  </button>
                  <button
                    onClick={() => setShowTraffic(!showTraffic)}
                    className={`p-1.5 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      showTraffic
                        ? 'bg-neutral-300 text-black font-bold border-neutral-300'
                        : 'bg-black border-white/10 text-neutral-500'
                    }`}
                  >
                    {showTraffic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Traffic
                  </button>
                  <button
                    onClick={() => setShowBaseline(!showBaseline)}
                    className={`p-1.5 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      showBaseline
                        ? 'bg-neutral-600 text-white font-bold border-neutral-600'
                        : 'bg-black border-white/10 text-neutral-500'
                    }`}
                  >
                    {showBaseline ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Baseline
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default LeftPanel;
