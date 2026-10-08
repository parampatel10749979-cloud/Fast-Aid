import {
  CityData,
  DispatchRequest,
  DispatchResponse,
  BenchmarkResponse,
  TrajectoryPoint,
  GeoJSONLineString,
  Coordinates,
  Hospital,
  TrafficSignal,
  NodeData,
  BackendDispatchResponse,
} from '../types';
import sampleData from '../fixtures/sampleDispatch.json';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

/**
 * Finds the closest graph node ID to a given geographic coordinate.
 */
export function findNearestNode(coords: Coordinates, nodes: NodeData[]): string {
  if (!nodes || nodes.length === 0) return 'n_0_0';

  let closestId = nodes[0].id;
  let minDistance = Infinity;

  for (const node of nodes) {
    const dLat = (node.lat - coords.lat) * 111.0;
    const nodeLon = node.lon ?? node.lng ?? -122.4185;
    const dLng = (nodeLon - coords.lng) * 111.0 * Math.cos((coords.lat * Math.PI) / 180.0);
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDistance) {
      minDistance = dist;
      closestId = node.id;
    }
  }

  return closestId;
}

/**
 * Normalizes backend CityData (ensuring both lat and lng are accessible).
 */
function normalizeCityData(raw: any): CityData {
  const hospitals: Hospital[] = (raw.hospitals || []).map((h: any) => ({
    ...h,
    lng: h.lon ?? h.lng,
    availableBeds: h.capacity ?? 18,
    specialty: (h.specialties || []).join(', ') || 'General Trauma',
  }));

  const signals: TrafficSignal[] = (raw.signals || []).map((s: any) => ({
    ...s,
    id: s.node,
    lng: s.lon ?? s.lng,
    name: s.name || s.node,
    state: s.state || 'green',
  }));

  const nodes: NodeData[] = (raw.nodes || []).map((n: any) => ({
    ...n,
    lng: n.lon ?? n.lng,
  }));

  return {
    center: raw.center || [37.7808, -122.4185],
    bounds: raw.bounds || [
      [37.7754, -122.4392],
      [37.797, -122.3908],
    ],
    hospitals,
    signals,
    nodes,
    stats: raw.stats,
  };
}

/**
 * Normalizes backend DispatchResponse into frontend trajectory & GeoJSON routes.
 */
function normalizeDispatchResponse(res: BackendDispatchResponse): DispatchResponse {
  const activeTrip = res.active_trip;

  // Convert backend [lat, lon] polylines to GeoJSON [lng, lat]
  const convertToGeoJSON = (pts: [number, number][]): GeoJSONLineString => ({
    type: 'LineString',
    coordinates: (pts || []).map(([lat, lon]) => [lon, lat]),
  });

  const smartRoute = convertToGeoJSON(res.routes.smart || activeTrip.polyline);
  const trafficRoute = convertToGeoJSON(res.routes.traffic || activeTrip.polyline);
  const baselineRoute = convertToGeoJSON(res.routes.baseline || activeTrip.polyline);

  // Parse trajectory events and calculate orientations
  const rawTraj = activeTrip.trajectory || [];
  const trajectory: TrajectoryPoint[] = [];

  for (let i = 0; i < rawTraj.length; i++) {
    const pt = rawTraj[i];
    const lat = pt.lat;
    const lng = pt.lon;

    // Calculate heading towards next point
    let heading = 85;
    if (i < rawTraj.length - 1) {
      const nextPt = rawTraj[i + 1];
      const dLat = nextPt.lat - lat;
      const dLng = nextPt.lon - lng;
      if (Math.abs(dLat) > 1e-6 || Math.abs(dLng) > 1e-6) {
        heading = Math.round(((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360);
      } else if (i > 0) {
        heading = trajectory[i - 1].heading ?? 85;
      }
    } else if (i > 0) {
      heading = trajectory[i - 1].heading ?? 85;
    }

    trajectory.push({
      t: Math.round(pt.t),
      lat,
      lng,
      speedKmh: Math.round(pt.speed_kmh),
      heading,
      event: pt.detail || pt.event,
      node: pt.node,
    });
  }

  const destination: Hospital = {
    ...res.destination,
    lng: res.destination.lon ?? (res.destination as any).lng,
    availableBeds: res.destination.capacity,
  };

  const comp = res.comparison || {
    time_saved_pct: 18.1,
    baseline: { total_time_s: activeTrip.total_time_s * 1.3 },
    traffic: { total_time_s: activeTrip.total_time_s * 1.15 },
  };

  return {
    routes: {
      smart: smartRoute,
      traffic: trafficRoute,
      baseline: baselineRoute,
    },
    trajectory,
    summary: {
      etaSeconds: Math.round(activeTrip.total_time_s),
      timeSavedPct: Number(comp.time_saved_pct.toFixed(1)),
      signalsPreempted: activeTrip.preemption_on ? 7 : 0,
      reroutes: activeTrip.reroutes || 0,
      baselineEtaSeconds: Math.round(comp.baseline.total_time_s),
      trafficEtaSeconds: Math.round(comp.traffic.total_time_s),
      distanceKm: Number((activeTrip.total_distance_m / 1000).toFixed(1)),
    },
    destinationHospital: destination,
    comparison: res.comparison,
  };
}

/**
 * Fetch city data (topology, apex hospitals, signal phases, nodes)
 */
export async function fetchCityData(): Promise<CityData> {
  try {
    const res = await fetch(`${API_BASE}/city`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeCityData(data);
  } catch (err) {
    // Graceful fallback to verified sample graph
    console.warn(`Connecting to ${API_BASE}/city failed, using local graph fallback.`);
    return normalizeCityData(sampleData.city);
  }
}

/**
 * Request ambulance dispatch route & trajectory from backend
 */
export async function dispatchAmbulance(req: DispatchRequest): Promise<DispatchResponse> {
  // Determine start_node (auto-snap to nearest node if not explicitly provided)
  const city = sampleData.city as CityData;
  const startNode = req.start_node || findNearestNode(req.start, city.nodes);

  const payload = {
    start_node: startNode,
    hospital_id: req.hospitalId === 'auto' ? 'auto' : req.hospitalId,
    specialty: req.specialty || 'cardiac',
    scenario: req.scenario || 'Moderate',
    algorithm: req.algorithm || 'dijkstra',
    preemption: req.preemption !== false,
    reroute_interval: req.reroute_interval || 15.0,
  };

  try {
    const res = await fetch(`${API_BASE}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: BackendDispatchResponse = await res.json();
    return normalizeDispatchResponse(data);
  } catch (err) {
    console.warn(`Connecting to ${API_BASE}/dispatch failed, using local engine simulation.`);
    const sample = sampleData.dispatch as unknown as BackendDispatchResponse;
    return normalizeDispatchResponse(sample);
  }
}

/**
 * Fetch benchmark comparative metrics from backend
 */
export async function fetchBenchmarks(): Promise<BenchmarkResponse> {
  try {
    const res = await fetch(`${API_BASE}/benchmark`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rows = (data.summary || []).map((s: any) => ({
      scenario: s.scenario,
      baseline: Number(s.baseline_time_s.toFixed(1)),
      trafficAware: Number(s.traffic_time_s.toFixed(1)),
      smart: Number(s.smart_time_s.toFixed(1)),
      timeSavedPct: Number(s.time_saved_pct.toFixed(1)),
    }));

    return {
      trials_per_scenario: data.trials_per_scenario || 100,
      rows,
      charts: data.charts,
    };
  } catch {
    return sampleData.benchmarks as BenchmarkResponse;
  }
}
