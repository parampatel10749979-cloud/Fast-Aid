export interface Hospital {
  id: string;
  name: string;
  node: string;
  lat: number;
  lon: number;
  capacity: number;
  specialties: string[];
}

export interface Signal {
  node: string;
  lat: number;
  lon: number;
  phase_offset: number;
}

export interface NodeData {
  id: string;
  lat: number;
  lon: number;
  has_signal: boolean;
  label: string;
}

export interface CityData {
  center: [number, number];
  bounds: [[number, number], [number, number]];
  hospitals: Hospital[];
  signals: Signal[];
  nodes: NodeData[];
  stats: {
    node_count: number;
    edge_count: number;
    signal_count: number;
    hospital_count: number;
  };
}

export interface TrajectoryEvent {
  t: number;
  lat: number;
  lon: number;
  event: string;
  detail: string;
  speed_kmh: number;
  node: string;
}

export interface TripMetrics {
  mode: string;
  algorithm: string;
  preemption_on: boolean;
  total_time_s: number;
  total_distance_m: number;
  reroutes: number;
  signal_stops: number;
  signal_wait_s: number;
  path: string[];
  polyline: [number, number][];
  trajectory: TrajectoryEvent[];
}

export interface ComparisonBundle {
  baseline: TripMetrics;
  traffic: TripMetrics;
  smart: TripMetrics;
  time_saved_s: number;
  time_saved_pct: number;
}

export interface DispatchResponse {
  active_trip: TripMetrics;
  routes: {
    baseline: [number, number][];
    traffic: [number, number][];
    smart: [number, number][];
  };
  comparison: ComparisonBundle;
  destination: Hospital;
  start_node: string;
  scenario: string;
}

export interface BenchmarkSummaryItem {
  scenario: string;
  baseline_time_s: number;
  traffic_time_s: number;
  smart_time_s: number;
  time_saved_s: number;
  time_saved_pct: number;
  smart_reroutes: number;
  smart_signal_stops: number;
}

export interface BenchmarkData {
  trials_per_scenario: number;
  summary: BenchmarkSummaryItem[];
  raw_preview: Record<string, any>[];
  charts: Record<string, string>;
}
