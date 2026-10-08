import React, { useState, useEffect, useCallback } from 'react';
import {
  CityData,
  DispatchResponse,
  DispatchRequest,
  Coordinates,
} from './types';
import { fetchCityData, dispatchAmbulance, findNearestNode } from './api/client';
import { useTrajectoryAnimation } from './hooks/useTrajectoryAnimation';
import MapView from './components/MapView';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import ComparisonPanel from './components/ComparisonPanel';
import BenchmarkPanel from './components/BenchmarkPanel';

export default function App() {
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchResponse | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // Settings & Parameters matching backend Fast-Aid spec
  const [startCoords, setStartCoords] = useState<Coordinates>({
    lat: 37.7808,
    lng: -122.4185,
  });
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('auto');
  const [scenario, setScenario] = useState<'Light' | 'Moderate' | 'Heavy' | 'Gridlock'>('Moderate');
  const [specialty, setSpecialty] = useState<'cardiac' | 'trauma' | 'stroke' | null>('cardiac');
  const [algorithm, setAlgorithm] = useState<'dijkstra' | 'astar'>('dijkstra');
  const [preemption, setPreemption] = useState(true);

  // Camera tracking
  const [followAmbulance, setFollowAmbulance] = useState(true);

  // Playback control
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Layer visibility
  const [showSmart, setShowSmart] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showTrafficHeatmap, setShowTrafficHeatmap] = useState(true);

  // Modals
  const [showComparison, setShowComparison] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  // Initial load
  useEffect(() => {
    let active = true;

    async function init() {
      const city = await fetchCityData();
      if (!active) return;
      setCityData(city);

      const initialCoords = { lat: city.center[0], lng: city.center[1] };
      setStartCoords(initialCoords);

      const initialReq: DispatchRequest = {
        start: initialCoords,
        start_node: 'n_0_0',
        hospitalId: 'auto',
        scenario: 'Moderate',
        specialty: 'cardiac',
        algorithm: 'dijkstra',
        preemption: true,
        rerouting: true,
      };

      const dispatch = await dispatchAmbulance(initialReq);
      if (!active) return;
      setDispatchData(dispatch);
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  // Dispatch runner with dynamic parameters
  const runDispatchWithParams = useCallback(
    async (
      coords: Coordinates,
      hospId: string,
      scen = scenario,
      spec = specialty,
      algo = algorithm,
      preempt = preemption,
      nodeId?: string
    ) => {
      setIsDispatching(true);
      try {
        const startNode = nodeId || (cityData?.nodes ? findNearestNode(coords, cityData.nodes) : 'n_0_0');
        const req: DispatchRequest = {
          start: coords,
          start_node: startNode,
          hospitalId: hospId,
          scenario: scen,
          specialty: spec,
          algorithm: algo,
          preemption: preempt,
          rerouting: true,
        };

        const res = await dispatchAmbulance(req);
        setDispatchData(res);
        setIsPlaying(true);
        setFollowAmbulance(true);
      } finally {
        setIsDispatching(false);
      }
    },
    [scenario, specialty, algorithm, preemption, cityData]
  );

  const handleDispatch = useCallback(() => {
    runDispatchWithParams(startCoords, selectedHospitalId);
  }, [runDispatchWithParams, startCoords, selectedHospitalId]);

  const handleSelectHospital = useCallback(
    (id: string) => {
      setSelectedHospitalId(id);
      runDispatchWithParams(startCoords, id);
    },
    [runDispatchWithParams, startCoords]
  );

  const handleSelectScenario = useCallback(
    (s: 'Light' | 'Moderate' | 'Heavy' | 'Gridlock') => {
      setScenario(s);
      runDispatchWithParams(startCoords, selectedHospitalId, s);
    },
    [runDispatchWithParams, startCoords, selectedHospitalId]
  );

  const handleSelectSpecialty = useCallback(
    (spec: 'cardiac' | 'trauma' | 'stroke' | null) => {
      setSpecialty(spec);
      runDispatchWithParams(startCoords, selectedHospitalId, scenario, spec);
    },
    [runDispatchWithParams, startCoords, selectedHospitalId, scenario]
  );

  const handleSelectAlgorithm = useCallback(
    (algo: 'dijkstra' | 'astar') => {
      setAlgorithm(algo);
      runDispatchWithParams(startCoords, selectedHospitalId, scenario, specialty, algo);
    },
    [runDispatchWithParams, startCoords, selectedHospitalId, scenario, specialty]
  );

  const handleTogglePreemption = useCallback(
    (p: boolean) => {
      setPreemption(p);
      runDispatchWithParams(startCoords, selectedHospitalId, scenario, specialty, algorithm, p);
    },
    [runDispatchWithParams, startCoords, selectedHospitalId, scenario, specialty, algorithm]
  );

  // Trajectory animation
  const trajectory = dispatchData?.trajectory ?? [];
  const {
    currentLat,
    currentLng,
    currentHeading,
    currentSpeedKmh,
    currentTimeSeconds,
    totalDurationSeconds,
    progressFraction,
    isComplete,
    activeEvents,
    latestEvent,
    seek,
    reset,
  } = useTrajectoryAnimation(trajectory, isPlaying, playbackSpeed, () => {
    setIsPlaying(false);
  });

  const remainingSeconds = Math.max(0, totalDurationSeconds - currentTimeSeconds);

  const handleMapClick = (coords: Coordinates) => {
    setStartCoords(coords);
    runDispatchWithParams(coords, selectedHospitalId);
  };

  const handleResetStartCoords = () => {
    const defaultCoords = {
      lat: cityData?.center[0] || 37.7808,
      lng: cityData?.center[1] || -122.4185,
    };
    setStartCoords(defaultCoords);
    runDispatchWithParams(defaultCoords, selectedHospitalId);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#E7EAEB] text-white font-sans select-none">
      {/* 1. Base Layer: Full Viewport Dull White Map with Dark Black Routes */}
      <div className="absolute inset-0 z-0">
        <MapView
          currentLat={currentLat}
          currentLng={currentLng}
          currentHeading={currentHeading}
          currentSpeedKmh={currentSpeedKmh}
          routes={dispatchData?.routes ?? null}
          hospitals={cityData?.hospitals ?? []}
          signals={cityData?.signals ?? []}
          destinationHospital={dispatchData?.destinationHospital}
          showBaseline={showBaseline}
          showTraffic={showTraffic}
          showSmart={showSmart}
          showTrafficHeatmap={showTrafficHeatmap}
          currentTimeSeconds={currentTimeSeconds}
          onMapClick={handleMapClick}
          startCoords={startCoords}
          followAmbulance={followAmbulance}
          onToggleFollow={() => setFollowAmbulance(!followAmbulance)}
          onSelectHospital={handleSelectHospital}
        />
      </div>

      {/* 2. Interactive Map Hint (Centered pill) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:block">
        <div className="px-3.5 py-1.5 rounded-full bg-black/90 border border-black/40 backdrop-blur-md text-[11px] font-mono text-white shadow-2xl">
          Click any intersection to set origin · Auto-snaps to nearest node
        </div>
      </div>

      {/* 3. Left Panel: Mission Command & Dispatch Controls */}
      <div className="absolute top-4 bottom-4 left-4 z-20 pointer-events-auto">
        <LeftPanel
          summary={dispatchData?.summary ?? null}
          destinationHospital={dispatchData?.destinationHospital}
          currentSpeedKmh={currentSpeedKmh}
          remainingSeconds={remainingSeconds}
          isComplete={isComplete}
          hospitals={cityData?.hospitals ?? []}
          selectedHospitalId={selectedHospitalId}
          onSelectHospital={handleSelectHospital}
          startCoords={startCoords}
          onResetStartCoords={handleResetStartCoords}
          scenario={scenario}
          onSelectScenario={handleSelectScenario}
          specialty={specialty}
          onSelectSpecialty={handleSelectSpecialty}
          algorithm={algorithm}
          onSelectAlgorithm={handleSelectAlgorithm}
          preemption={preemption}
          onTogglePreemption={handleTogglePreemption}
          onDispatch={handleDispatch}
          isDispatching={isDispatching}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onReplay={() => {
            reset();
            setIsPlaying(true);
            setFollowAmbulance(true);
          }}
          playbackSpeed={playbackSpeed}
          onSetSpeed={setPlaybackSpeed}
          progressFraction={progressFraction}
          onSeek={seek}
          currentTimeSeconds={currentTimeSeconds}
          totalDurationSeconds={totalDurationSeconds}
          showSmart={showSmart}
          setShowSmart={setShowSmart}
          showTraffic={showTraffic}
          setShowTraffic={setShowTraffic}
          showBaseline={showBaseline}
          setShowBaseline={setShowBaseline}
          showTrafficHeatmap={showTrafficHeatmap}
          setShowTrafficHeatmap={setShowTrafficHeatmap}
        />
      </div>

      {/* 4. Right Panel: Telemetry, Logs & Actions */}
      <div className="absolute top-4 bottom-4 right-4 z-20 pointer-events-auto hidden md:block">
        <RightPanel
          events={activeEvents}
          latestEvent={latestEvent}
          currentLat={currentLat}
          currentLng={currentLng}
          currentHeading={currentHeading}
          currentSpeedKmh={currentSpeedKmh}
          followAmbulance={followAmbulance}
          onToggleFollow={() => setFollowAmbulance(!followAmbulance)}
          onFitRoute={() => setFollowAmbulance(false)}
          onResetOrigin={handleResetStartCoords}
          onOpenComparison={() => setShowComparison(true)}
          onOpenBenchmarks={() => setShowBenchmarks(true)}
        />
      </div>

      {/* 5. Modals */}
      {showComparison && (
        <ComparisonPanel
          summary={dispatchData?.summary ?? null}
          onClose={() => setShowComparison(false)}
        />
      )}

      {showBenchmarks && (
        <BenchmarkPanel
          onClose={() => setShowBenchmarks(false)}
        />
      )}
    </div>
  );
}
