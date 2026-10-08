import React, { useState } from 'react';
import { Hospital, Coordinates } from '../types';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Navigation,
  MapPin,
  Route,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  theme: 'dark' | 'light';
  hospitals: Hospital[];
  selectedHospitalId: string;
  onSelectHospital: (id: string) => void;
  startCoords: Coordinates;
  onResetStartCoords: () => void;
  algorithm: 'dijkstra' | 'astar';
  onSelectAlgorithm: (algo: 'dijkstra' | 'astar') => void;
  mode: 'baseline' | 'traffic' | 'smart';
  onSelectMode: (m: 'baseline' | 'traffic' | 'smart') => void;
  preemption: boolean;
  onTogglePreemption: (v: boolean) => void;
  rerouting: boolean;
  onToggleRerouting: (v: boolean) => void;
  incidents: boolean;
  onToggleIncidents: (v: boolean) => void;
  onDispatch: () => void;
  isDispatching: boolean;

  // Layer toggles
  showSmart: boolean;
  setShowSmart: (v: boolean) => void;
  showTraffic: boolean;
  setShowTraffic: (v: boolean) => void;
  showBaseline: boolean;
  setShowBaseline: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  theme,
  hospitals,
  selectedHospitalId,
  onSelectHospital,
  startCoords,
  onResetStartCoords,
  algorithm,
  onSelectAlgorithm,
  mode,
  onSelectMode,
  preemption,
  onTogglePreemption,
  rerouting,
  onToggleRerouting,
  incidents,
  onToggleIncidents,
  onDispatch,
  isDispatching,
  showSmart,
  setShowSmart,
  showTraffic,
  setShowTraffic,
  showBaseline,
  setShowBaseline,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDark = theme === 'dark';

  return (
    <aside
      className={`w-76 sm:w-82 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/80 text-white shadow-black/80'
          : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-300/50'
      }`}
    >
      {/* Header bar */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          <h2 className="text-xs font-semibold tracking-wide uppercase">
            Mission Dispatch Controls
          </h2>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1 rounded-lg transition-colors ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Panel Content */}
      {!isCollapsed && (
        <div className="p-3.5 space-y-3 max-h-[calc(100vh-230px)] overflow-y-auto scrollbar-thin text-xs">
          {/* Dispatch CTA */}
          <button
            onClick={onDispatch}
            disabled={isDispatching}
            className="w-full py-2.5 px-3.5 rounded-xl font-semibold text-xs bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-950/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5 fill-white" />
            <span>{isDispatching ? 'Computing Optimal Corridor...' : 'Dispatch Fast-Aid 108'}</span>
          </button>

          {/* Destination Hospital */}
          <div className="space-y-1">
            <label
              className={`text-[11px] font-medium flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <MapPin className="w-3 h-3 text-red-500" />
              Target Hospital (Ahmedabad)
            </label>
            <select
              value={selectedHospitalId}
              onChange={(e) => onSelectHospital(e.target.value)}
              className={`w-full p-2 rounded-xl border text-xs focus:outline-hidden ${
                isDark
                  ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <option value="auto">Auto-Select (Fastest Emergency Bay)</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.availableBeds ?? 12} beds)
                </option>
              ))}
            </select>
          </div>

          {/* Routing Mode & Algorithm */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className={`text-[11px] font-medium block mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Routing Mode
              </label>
              <select
                value={mode}
                onChange={(e) => onSelectMode(e.target.value as 'baseline' | 'traffic' | 'smart')}
                className={`w-full p-1.5 rounded-xl border text-xs focus:outline-hidden ${
                  isDark
                    ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="smart">Fast-Aid Smart</option>
                <option value="traffic">Traffic-Aware</option>
                <option value="baseline">Baseline Direct</option>
              </select>
            </div>

            <div>
              <label
                className={`text-[11px] font-medium block mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => onSelectAlgorithm(e.target.value as 'dijkstra' | 'astar')}
                className={`w-full p-1.5 rounded-xl border text-xs focus:outline-hidden ${
                  isDark
                    ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="astar">A* Heuristic</option>
                <option value="dijkstra">Dijkstra Shortest</option>
              </select>
            </div>
          </div>

          {/* Feature Toggles */}
          <div
            className={`space-y-1.5 pt-2 border-t ${
              isDark ? 'border-slate-800/80' : 'border-slate-200'
            }`}
          >
            <div
              className={`text-[11px] font-medium ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Corridor Optimization
            </div>

            {/* Signal Preemption */}
            <label
              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800/60 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-medium text-xs">AMC Signal Preemption</div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Smart City Green Wave
                </div>
              </div>
              <input
                type="checkbox"
                checked={preemption}
                onChange={(e) => onTogglePreemption(e.target.checked)}
                className="w-4 h-4 accent-red-500 rounded cursor-pointer"
              />
            </label>

            {/* Dynamic Rerouting */}
            <label
              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800/60 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-medium text-xs">Dynamic Rerouting</div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Adaptive congestion detour
                </div>
              </div>
              <input
                type="checkbox"
                checked={rerouting}
                onChange={(e) => onToggleRerouting(e.target.checked)}
                className="w-4 h-4 accent-red-500 rounded cursor-pointer"
              />
            </label>

            {/* Incident Avoidance */}
            <label
              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800/60 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-medium text-xs">Incident Avoidance</div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Road blockade avoidance
                </div>
              </div>
              <input
                type="checkbox"
                checked={incidents}
                onChange={(e) => onToggleIncidents(e.target.checked)}
                className="w-4 h-4 accent-red-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Layer Visibility */}
          <div
            className={`pt-2 border-t space-y-1.5 ${
              isDark ? 'border-slate-800/80' : 'border-slate-200'
            }`}
          >
            <div
              className={`text-[11px] font-medium ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Route Polylines
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setShowSmart(!showSmart)}
                className={`p-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  showSmart
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : isDark
                    ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
              >
                {showSmart ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Smart
              </button>

              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`p-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  showTraffic
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : isDark
                    ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
              >
                {showTraffic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Traffic
              </button>

              <button
                onClick={() => setShowBaseline(!showBaseline)}
                className={`p-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  showBaseline
                    ? isDark
                      ? 'bg-slate-700/30 border-slate-600 text-slate-300'
                      : 'bg-slate-200 border-slate-300 text-slate-700'
                    : isDark
                    ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
              >
                {showBaseline ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Base
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
