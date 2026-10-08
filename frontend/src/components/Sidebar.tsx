import React from 'react';
import {
  Siren,
  MapPin,
  Building2,
  Activity,
  Cpu,
  Radio,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Navigation
} from 'lucide-react';
import type { CityData } from '../types';

interface SidebarProps {
  cityData: CityData | null;
  selectedStartNode: string;
  onSelectStartNode: (node: string) => void;
  selectedHospitalId: string;
  onSelectHospitalId: (hospId: string) => void;
  selectedSpecialty: string;
  onSelectSpecialty: (spec: string) => void;
  scenario: string;
  onSelectScenario: (scen: string) => void;
  algorithm: 'dijkstra' | 'astar';
  onSelectAlgorithm: (alg: 'dijkstra' | 'astar') => void;
  preemption: boolean;
  onTogglePreemption: (val: boolean) => void;
  isPickMode: boolean;
  onTogglePickMode: () => void;
  onDispatch: () => void;
  isDispatching: boolean;
  // Playback
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetPlayback: () => void;
  playbackSpeed: number;
  onSetPlaybackSpeed: (speed: number) => void;
  currentTime: number;
  maxTime: number;
  onSeek: (time: number) => void;
  hasActiveTrip: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  cityData,
  selectedStartNode,
  onSelectStartNode,
  selectedHospitalId,
  onSelectHospitalId,
  selectedSpecialty,
  onSelectSpecialty,
  scenario,
  onSelectScenario,
  algorithm,
  onSelectAlgorithm,
  preemption,
  onTogglePreemption,
  isPickMode,
  onTogglePickMode,
  onDispatch,
  isDispatching,
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  playbackSpeed,
  onSetPlaybackSpeed,
  currentTime,
  maxTime,
  onSeek,
  hasActiveTrip,
}) => {
  const scenarios = ['Light', 'Moderate', 'Heavy', 'Gridlock'];
  const specialties = ['any', 'cardiac', 'trauma', 'stroke'];

  return (
    <aside className="w-80 md:w-96 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              <Siren size={22} className="text-slate-950 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                FAST-AID <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">PRO</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Smart V2X Emergency Dispatch</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">READY</span>
          </div>
        </div>
      </div>

      {/* Main Configuration Form */}
      <div className="p-4 space-y-4 flex-1">
        {/* 1. Origin Node */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MapPin size={14} className="text-sky-400" /> Ambulance Origin
            </label>
            <button
              onClick={onTogglePickMode}
              className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                isPickMode
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isPickMode ? 'Cancel Picking' : 'Pick on Map'}
            </button>
          </div>
          <select
            value={selectedStartNode}
            onChange={(e) => onSelectStartNode(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
          >
            {cityData?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} ({n.id})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Destination Hospital & Specialty Filter */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Building2 size={14} className="text-red-400" /> Destination Hospital
          </label>
          <select
            value={selectedHospitalId}
            onChange={(e) => onSelectHospitalId(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500 font-medium"
          >
            <option value="auto">⚡ Auto-Select Best Hospital (By Route & Beds)</option>
            {cityData?.hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} — {h.capacity} beds ({h.specialties.join(', ')})
              </option>
            ))}
          </select>

          {/* Specialty Filter */}
          <div className="flex items-center gap-1 pt-1">
            {specialties.map((spec) => (
              <button
                key={spec}
                onClick={() => onSelectSpecialty(spec)}
                className={`flex-1 text-[10px] py-1 rounded-lg capitalize font-bold transition-all ${
                  selectedSpecialty === spec
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Traffic Scenario */}
        <div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <Activity size={14} className="text-amber-400" /> Traffic Congestion Scenario
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {scenarios.map((scen) => (
              <button
                key={scen}
                onClick={() => onSelectScenario(scen)}
                className={`text-[11px] py-1.5 rounded-xl font-bold transition-all ${
                  scenario === scen
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                {scen}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Routing Algorithm & Preemption Toggle */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu size={14} className="text-indigo-400" /> Algorithm
            </span>
            <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => onSelectAlgorithm('dijkstra')}
                className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-all ${
                  algorithm === 'dijkstra' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'
                }`}
              >
                Dijkstra
              </button>
              <button
                onClick={() => onSelectAlgorithm('astar')}
                className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-all ${
                  algorithm === 'astar' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'
                }`}
              >
                A* (Fast)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center gap-2">
              <Radio size={16} className={preemption ? 'text-emerald-400' : 'text-slate-500'} />
              <div>
                <div className="text-xs font-bold text-slate-200">Green Corridor V2X</div>
                <div className="text-[10px] text-slate-400">Preempt next 3 signals</div>
              </div>
            </div>
            <button
              onClick={() => onTogglePreemption(!preemption)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                preemption ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                  preemption ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 5. Dispatch Primary Button */}
        <button
          onClick={onDispatch}
          disabled={isDispatching}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {isDispatching ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>SIMULATING TRANSIT...</span>
            </>
          ) : (
            <>
              <Navigation size={18} className="fill-slate-950" />
              <span>DISPATCH AMBULANCE</span>
            </>
          )}
        </button>

        {/* 6. Playback Controller Section */}
        {hasActiveTrip && (
          <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span>Trajectory Replay</span>
              <span className="font-mono text-emerald-400 text-[11px]">
                {currentTime.toFixed(1)}s / {maxTime.toFixed(1)}s
              </span>
            </div>

            {/* Scrubber slider */}
            <input
              type="range"
              min={0}
              max={maxTime || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />

            {/* Playback action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onTogglePlay}
                  className="w-8 h-8 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <button
                  onClick={onResetPlayback}
                  className="w-8 h-8 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                  title="Reset to Start"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Speed Buttons */}
              <div className="flex items-center gap-1">
                {[1, 2, 5, 10].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSetPlaybackSpeed(spd)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-mono font-bold transition-all ${
                      playbackSpeed === spd
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Fast-Aid Demo Build • v1.0</span>
        <span className="text-emerald-500 font-mono">100% Deterministic</span>
      </div>
    </aside>
  );
};
