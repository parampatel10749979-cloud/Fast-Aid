export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Hospital {
  id: string; // "hosp_n_5_7"
  name: string;
  node?: string;
  lat: number;
  lon?: number;
  lng: number;
  capacity: number;
  availableBeds?: number;
  specialties?: string[];
  specialty?: string;
}

export interface TrafficSignal {
  id?: string;
  node: string; // "n_2_4"
  lat: number;
  lon?: number;
  lng: number;
  name?: string;
  phase_offset?: number;
  state?: 'green' | 'yellow' | 'red' | 'preempted';
}

export interface NodeData {
  id: string; // "n_row_col"
  lat: number;
  lon: number;
  lng?: number;
  has_signal: boolean;
  label: string;
}

export interface CityData {
  center: [number, number]; // [lat, lon]
  bounds: [[number, number], [number, number]]; // [[lat_min, lon_min], [lat_max, lon_max]]
  hospitals: Hospital[];
  signals: TrafficSignal[];
  nodes: NodeData[];
  stats?: {
    node_count: number;
    edge_count: number;
    signal_count: number;
    hospital_count: number;
  };
}

export interface TrajectoryPoint {
  t: number; // elapsed seconds
  lat: number;
  lng: number;
  lon?: number;
  speedKmh?: number;
  speed_kmh?: number;
  heading?: number;
  event: string | null;
  detail?: string;
  node?: string;
  signalId?: string;
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id?: string | number;
    properties: Record<string, any>;
    geometry: {
      type: string;
      coordinates: any;
    };
  }>;
}

export interface DispatchRoutes {
  baseline: GeoJSONLineString;
  traffic: GeoJSONLineString;
  smart: GeoJSONLineString;
}

export interface DispatchSummary {
  etaSeconds: number;
  timeSavedPct: number;
  signalsPreempted: number;
  reroutes: number;
  baselineEtaSeconds?: number;
  trafficEtaSeconds?: number;
  distanceKm?: number;
}

export interface DispatchRequest {
  start: Coordinates;
  start_node?: string;
  hospitalId: string | 'auto';
  specialty?: 'cardiac' | 'trauma' | 'stroke' | null;
  scenario?: 'Light' | 'Moderate' | 'Heavy' | 'Gridlock';
  mode?: 'baseline' | 'traffic' | 'smart';
  algorithm: 'dijkstra' | 'astar';
  preemption: boolean;
  rerouting: boolean;
  incidents?: boolean;
  reroute_interval?: number;
}

export interface TripMetrics {
  mode: 'distance' | 'traffic' | 'smart';
  algorithm: 'dijkstra' | 'astar';
  preemption_on: boolean;
  total_time_s: number;
  total_distance_m: number;
  reroutes: number;
  signal_stops: number;
  signal_wait_s: number;
  path: string[];
  polyline: [number, number][]; // [lat, lon]
  trajectory: Array<{
    t: number;
    lat: number;
    lon: number;
    event: string;
    detail: string;
    speed_kmh: number;
    node: string;
  }>;
}

export interface BackendDispatchResponse {
  active_trip: TripMetrics;
  routes: {
    baseline: [number, number][]; // [lat, lon]
    traffic: [number, number][];
    smart: [number, number][];
  };
  comparison: {
    baseline: TripMetrics;
    traffic: TripMetrics;
    smart: TripMetrics;
    time_saved_s: number;
    time_saved_pct: number;
  };
  destination: Hospital;
  start_node: string;
  scenario: string;
}

export interface DispatchResponse {
  routes: DispatchRoutes;
  trajectory: TrajectoryPoint[];
  summary: DispatchSummary;
  destinationHospital?: Hospital;
  comparison?: {
    baseline: any;
    traffic: any;
    smart: any;
    time_saved_s: number;
    time_saved_pct: number;
  };
}

export interface BenchmarkRow {
  scenario: string;
  baseline: number;
  trafficAware: number;
  smart: number;
  timeSavedPct: number;
}

export interface BenchmarkResponse {
  trials_per_scenario?: number;
  rows: BenchmarkRow[];
  charts?: Record<string, string>;
  chartImageUrls?: string[];
}
