import { useState, useEffect, useRef, useMemo } from 'react';
import type {
  CityData,
  DispatchResponse,
  BenchmarkData,
} from './types';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { TopCards } from './components/TopCards';
import { EventLog } from './components/EventLog';
import { ComparisonPanel } from './components/ComparisonPanel';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import {
  Navigation2,
  SlidersHorizontal,
  BarChart2,
  Moon,
  Sun,
  AlertCircle,
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export function App() {
  // City Data & Config
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [selectedStartNode, setSelectedStartNode] = useState<string>('n_0_0');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('auto');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('any');
  const [scenario, setScenario] = useState<string>('Moderate');
  const [algorithm, setAlgorithm] = useState<'dijkstra' | 'astar'>('dijkstra');
  const [preemption, setPreemption] = useState<boolean>(true);
  const [isPickMode, setIsPickMode] = useState<boolean>(false);
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark');

  // Dispatch & Simulation State
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback & Animation State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);
  const lastFrameTimeRef = useRef<number | null>(null);

  // Benchmarks & UI Tabs
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'comparison' | 'benchmark'>('map');

  // Fetch initial city data and benchmark data
  useEffect(() => {
    async function initData() {
      try {
        const cityRes = await fetch(`${API_BASE}/city`);
        if (!cityRes.ok) throw new Error('Failed to load city data');
        const cityJson: CityData = await cityRes.json();
        setCityData(cityJson);
        if (cityJson.nodes.length > 0) {
          setSelectedStartNode(cityJson.nodes[0].id);
        }

        const benchRes = await fetch(`${API_BASE}/benchmark`);
        if (benchRes.ok) {
          const benchJson: BenchmarkData = await benchRes.json();
          setBenchmarkData(benchJson);
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Unable to connect to Fast-Aid backend. Ensure FastAPI server is running on :8000');
      }
    }
    initData();
  }, []);

  // Perform dispatch API call
  const handleDispatch = async () => {
    setIsDispatching(true);
    setErrorMsg(null);

    try {
      const payload = {
        start_node: selectedStartNode,
        hospital_id: selectedHospitalId,
        specialty: selectedSpecialty === 'any' ? null : selectedSpecialty,
        scenario: scenario,
        algorithm: algorithm,
        preemption: preemption,
      };

      const res = await fetch(`${API_BASE}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Dispatch failed: ${res.statusText}`);

      const data: DispatchResponse = await res.json();
      setDispatchResult(data);

      // Reset & auto-start playback
      setCurrentTime(0);
      setIsPlaying(true);
      lastFrameTimeRef.current = null;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Dispatch error occurred.');
    } finally {
      setIsDispatching(false);
      setIsPickMode(false);
    }
  };

  // Auto-dispatch on first load once cityData is available
  useEffect(() => {
    if (cityData && !dispatchResult && !isDispatching) {
      handleDispatch();
    }
  }, [cityData]);

  // RequestAnimationFrame Animation Loop for buttery-smooth vehicle movement
  const maxTime = dispatchResult?.active_trip.total_time_s || 0;

  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animationFrameId: number;

    const animate = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaSeconds = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      setCurrentTime((prev: number) => {
        const next = prev + deltaSeconds * playbackSpeed;
        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, maxTime, playbackSpeed]);

  // Determine which signals are currently preempted
  const activePreemptedSignals = useMemo(() => {
    if (!dispatchResult) return [];
    const traj = dispatchResult.active_trip.trajectory;
    // Find preemption events up to currentTime that haven't been passed
    const signals: string[] = [];
    for (const evt of traj) {
      if (evt.t <= currentTime && evt.event === 'preemption') {
        // extract signal ids or attach upcoming signals
        const upcomingNodes = dispatchResult.active_trip.path;
        const curIdx = upcomingNodes.indexOf(evt.node);
        if (curIdx >= 0) {
          for (let i = curIdx + 1; i <= Math.min(curIdx + 3, upcomingNodes.length - 1); i++) {
            signals.push(upcomingNodes[i]);
          }
        }
      }
    }
    return signals;
  }, [currentTime, dispatchResult]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Left Navigation & Controls Sidebar */}
      <Sidebar
        cityData={cityData}
        selectedStartNode={selectedStartNode}
        onSelectStartNode={(node) => {
          setSelectedStartNode(node);
          setIsPickMode(false);
        }}
        selectedHospitalId={selectedHospitalId}
        onSelectHospitalId={setSelectedHospitalId}
        selectedSpecialty={selectedSpecialty}
        onSelectSpecialty={setSelectedSpecialty}
        scenario={scenario}
        onSelectScenario={setScenario}
        algorithm={algorithm}
        onSelectAlgorithm={setAlgorithm}
        preemption={preemption}
        onTogglePreemption={setPreemption}
        isPickMode={isPickMode}
        onTogglePickMode={() => setIsPickMode(!isPickMode)}
        onDispatch={handleDispatch}
        isDispatching={isDispatching}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onResetPlayback={() => {
          setCurrentTime(0);
          setIsPlaying(true);
        }}
        playbackSpeed={playbackSpeed}
        onSetPlaybackSpeed={setPlaybackSpeed}
        currentTime={currentTime}
        maxTime={maxTime}
        onSeek={(t) => setCurrentTime(t)}
        hasActiveTrip={!!dispatchResult}
      />

      {/* Main Command Center Dashboard */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-950">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-5 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            {/* View Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700/80">
              <button
                onClick={() => setActiveTab('map')}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'map'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Navigation2 size={13} />
                <span>Live Emergency Map</span>
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'comparison'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>3-Mode Matrix</span>
              </button>
              <button
                onClick={() => setActiveTab('benchmark')}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'benchmark'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 size={13} />
                <span>Benchmark Suite</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setMapTheme(mapTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Toggle Street / Dark Map"
            >
              {mapTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Destination Hospital Pill */}
            {dispatchResult && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1 rounded-full text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                <span>Dest: <b className="text-white">{dispatchResult.destination.name}</b></span>
              </div>
            )}
          </div>
        </header>

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="bg-red-500/20 border-b border-red-500/40 text-red-200 px-4 py-2 text-xs flex items-center gap-2 z-30">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Area Based on Active Tab */}
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'map' && (
            <div className="w-full h-full relative">
              {/* Top Floating Telemetry Cards */}
              <div className="absolute top-4 left-4 right-4 z-[400] max-w-5xl pointer-events-none">
                <div className="pointer-events-auto">
                  <TopCards dispatchResult={dispatchResult} />
                </div>
              </div>

              {/* Bottom Right Floating Event Log */}
              <div className="absolute bottom-6 left-6 z-[400] w-80 md:w-96 pointer-events-none">
                <div className="pointer-events-auto">
                  <EventLog
                    events={dispatchResult?.active_trip.trajectory || []}
                    currentTime={currentTime}
                  />
                </div>
              </div>

              {/* Real Leaflet Map */}
              <MapView
                cityData={cityData}
                dispatchResult={dispatchResult}
                currentTime={currentTime}
                selectedStartNode={selectedStartNode}
                onSelectStartNode={(node) => {
                  setSelectedStartNode(node);
                  setIsPickMode(false);
                }}
                isPickMode={isPickMode}
                mapTheme={mapTheme}
                activePreemptedSignals={activePreemptedSignals}
              />
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="w-full h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
              <TopCards dispatchResult={dispatchResult} />
              <ComparisonPanel comparison={dispatchResult?.comparison || null} />
            </div>
          )}

          {activeTab === 'benchmark' && (
            <div className="w-full h-full overflow-y-auto p-6 max-w-6xl mx-auto space-y-6">
              <BenchmarkPanel benchmarkData={benchmarkData} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
