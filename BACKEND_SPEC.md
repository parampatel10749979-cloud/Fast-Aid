# Fast-Aid — Backend Architecture & API Specification

> **Audience:** React / Vite frontend engineering team.
> **Source of truth:** `backend/main.py`, `backend/city.py`, `backend/simulation.py`, `backend/traffic.py`, `backend/routing.py`, `backend/hospitals.py`, `backend/preemption.py`, `backend/metrics.py`, and `frontend/vite.config.ts`.
> **Last analysed:** 2026-10-08

---

## Table of Contents

1. [Service Runtime & Environment](#1-service-runtime--environment)
2. [Coordinate & Geospatial Standards](#2-coordinate--geospatial-standards)
3. [Endpoints & API Contracts](#3-endpoints--api-contracts)
4. [Real-time / Streaming](#4-real-time--streaming)
5. [Data Models Reference](#5-data-models-reference)
6. [Hospital Selection Logic](#6-hospital-selection-logic)
7. [Routing Modes Explained](#7-routing-modes-explained)
8. [Traffic & Congestion Model](#8-traffic--congestion-model)
9. [Sample Full JSON Payloads](#9-sample-full-json-payloads)

---

## 1. Service Runtime & Environment

| Property | Value |
|---|---|
| **Framework** | Python **FastAPI** 0.110+ |
| **Language** | Python 3.10+ |
| **Entry module** | `backend/main.py` |
| **Run command** | `uvicorn backend.main:app --host 127.0.0.1 --port 8000` |
| **Default host** | `http://localhost:8000` |
| **API base prefix** | `/` (root — no `/api/v1` prefix) |
| **Interactive docs** | `http://localhost:8000/docs` (Swagger UI, auto-generated) |
| **Alt docs** | `http://localhost:8000/redoc` |
| **Static files** | `http://localhost:8000/results/{filename}` |

### CORS Configuration

CORS is **wide-open** — all origins, methods, and headers are permitted.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Authentication

**None.** No API keys, tokens, or session cookies required.

### Frontend Proxy (Vite)

The Vite dev server (port 5173) proxies:

| Frontend call | Resolved backend URL |
|---|---|
| `fetch('/api/city')` | `http://localhost:8000/city` |
| `fetch('/api/dispatch', ...)` | `http://localhost:8000/dispatch` |
| `fetch('/api/benchmark')` | `http://localhost:8000/benchmark` |
| `fetch('/results/*.png')` | `http://localhost:8000/results/*.png` |

> **Current state:** `App.tsx` uses `const API_BASE = 'http://localhost:8000'` directly,
> bypassing the proxy. Both approaches work.

### Environment Variables

No environment variables required. The backend loads `backend/data/city_graph.graphml`
and falls back to a synthetic 12x12 grid (`seed=42`) if the file is missing.

---

## 2. Coordinate & Geospatial Standards

### Coordinate Order: `[latitude, longitude]` — Leaflet convention

> **WARNING:** This is NOT GeoJSON order (which is `[lon, lat]`).
> Leaflet's `<Polyline positions={...}>` expects `[lat, lon]`.

| Field | Format | Example |
|---|---|---|
| `center` | `[lat, lon]` | `[37.7808, -122.4185]` |
| `bounds` | `[[lat_min, lon_min], [lat_max, lon_max]]` | `[[37.7754, -122.4392], [37.7970, -122.3908]]` |
| `polyline` items | `[lat, lon]` | `[37.7826, -122.4162]` |
| Trajectory events | `{ lat, lon }` | separate number fields |
| Hospital / Signal / Node | `{ lat, lon }` | separate number fields |

### Base Coordinate Reference

Downtown San Francisco. Node IDs use format `n_row_col` (e.g. `n_0_0`, `n_5_7`).

Synthetic fallback formula:
```
lat = 37.7808 + row * 0.0018
lon = -122.4185 + col * 0.0023
```

### Routing Engine

| Component | Details |
|---|---|
| Road graph | NetworkX `DiGraph` (directed, bidirectional streets) |
| Dijkstra | Custom heap implementation (`heapq`), no NetworkX `shortest_path` |
| A* | Custom with haversine straight-line heuristic |
| External engine | None (no OSRM, GraphHopper, Google Maps) |
| Grid | 12x12 = 144 nodes, ~264 directed edges, 200 m blocks |
| Speed limits | 30 / 40 / 60 km/h per edge |
| Ambulance boost | 1.25x siren speed multiplier |

---

## 3. Endpoints & API Contracts

### `GET /city`

Returns the static city topology. Called once on app load.

**Request:** No parameters.

**Response 200 OK:**

```json
{
  "center": [37.780800, -122.418500],
  "bounds": [[37.775400, -122.439200], [37.797000, -122.390800]],
  "hospitals": [
    {
      "id": "hosp_n_5_7",
      "name": "Emergency Hospital n_5_7",
      "node": "n_5_7",
      "lat": 37.7898,
      "lon": -122.4024,
      "capacity": 18,
      "specialties": ["cardiac", "trauma"]
    }
  ],
  "signals": [
    { "node": "n_2_4", "lat": 37.7844, "lon": -122.4093, "phase_offset": 12.5 }
  ],
  "nodes": [
    { "id": "n_0_0", "lat": 37.7808, "lon": -122.4185, "has_signal": false, "label": "n_0_0" },
    { "id": "n_0_1", "lat": 37.7808, "lon": -122.4162, "has_signal": true,  "label": "n_0_1" }
  ],
  "stats": {
    "node_count": 144,
    "edge_count": 264,
    "signal_count": 57,
    "hospital_count": 4
  }
}
```

**Key field notes:**

- `hospitals[].specialties` — subset of `["cardiac", "trauma", "stroke"]`
- `signals[].phase_offset` — seconds into the 30s cycle at t=0; green when `(t + phase_offset) % 30 < 15`
- `nodes[].id` — use this string as `start_node` in `POST /dispatch`

**Errors:** `500` if the graph fails to load.

---

### `POST /dispatch`

The primary action endpoint. Runs the ambulance simulation synchronously across all three
routing modes (Baseline, Traffic-Aware, Smart) and returns the full comparison bundle.

> This is a **blocking synchronous** call (~< 200 ms). The entire trajectory is returned at once.
> There is no streaming.

**Request Headers:**

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |

**Request Body (`DispatchRequest` Pydantic model):**

```json
{
  "start_node":       "n_0_0",
  "hospital_id":      "auto",
  "specialty":        "cardiac",
  "scenario":         "Moderate",
  "algorithm":        "dijkstra",
  "preemption":       true,
  "reroute_interval": 15.0
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `start_node` | `string\|null` | `null` → `"n_0_0"` | Ambulance origin node ID |
| `hospital_id` | `string\|null` | `"auto"` | Hospital ID or `"auto"` for backend auto-select |
| `specialty` | `string\|null` | `null` | `"cardiac"` / `"trauma"` / `"stroke"` / `null` |
| `scenario` | `string` | `"Moderate"` | `"Light"` / `"Moderate"` / `"Heavy"` / `"Gridlock"` |
| `algorithm` | `string` | `"dijkstra"` | `"dijkstra"` or `"astar"` |
| `preemption` | `boolean` | `true` | Enable V2X green wave |
| `reroute_interval` | `number` | `15.0` | Seconds between dynamic reroute checks |

**Response 200 OK (top-level structure):**

```json
{
  "active_trip":  { ... },
  "routes":       { "baseline": [...], "traffic": [...], "smart": [...] },
  "comparison":   { "baseline": {...}, "traffic": {...}, "smart": {...}, "time_saved_s": 18.2, "time_saved_pct": 18.1 },
  "destination":  { "id": "hosp_n_5_7", "name": "...", "node": "n_5_7", "lat": 37.7898, "lon": -122.4024, "capacity": 18, "specialties": ["cardiac","trauma"] },
  "start_node":   "n_0_0",
  "scenario":     "Moderate"
}
```

**`active_trip` (TripMetrics) — always the Smart mode run:**

```json
{
  "mode":             "smart",
  "algorithm":        "dijkstra",
  "preemption_on":    true,
  "total_time_s":     82.34,
  "total_distance_m": 2400.0,
  "reroutes":         2,
  "signal_stops":     0,
  "signal_wait_s":    0.0,
  "path":    ["n_0_0", "n_0_1", "n_1_1", "n_2_1", "n_3_1", "n_4_2", "n_5_7"],
  "polyline": [[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7880,-122.4093],[37.7898,-122.4024]],
  "trajectory": [
    { "t": 0.0,   "lat": 37.7808, "lon": -122.4185, "event": "dispatch",   "detail": "Dispatched via smart mode",                    "speed_kmh": 0.0,  "node": "n_0_0" },
    { "t": 0.0,   "lat": 37.7808, "lon": -122.4185, "event": "preemption", "detail": "Green Wave activated for 3 upcoming signals",   "speed_kmh": 0.0,  "node": "n_0_0" },
    { "t": 8.47,  "lat": 37.7808, "lon": -122.4162, "event": "move",       "detail": "En route to n_0_1 (56.3 km/h)",                "speed_kmh": 56.3, "node": "n_0_1" },
    { "t": 17.21, "lat": 37.7826, "lon": -122.4162, "event": "reroute",    "detail": "Dynamic reroute #1 around congestion",          "speed_kmh": 0.0,  "node": "n_1_1" },
    { "t": 82.34, "lat": 37.7898, "lon": -122.4024, "event": "arrive",     "detail": "Arrived safely at destination hospital",        "speed_kmh": 0.0,  "node": "n_5_7" }
  ]
}
```

**`routes` — three polylines for simultaneous map overlay:**

```json
{
  "baseline": [[37.7808,-122.4185], [37.7808,-122.4162], [37.7826,-122.4162], [37.7844,-122.4162], [37.7862,-122.4162], [37.7898,-122.4024]],
  "traffic":  [[37.7808,-122.4185], [37.7808,-122.4162], [37.7826,-122.4162], [37.7844,-122.4162], [37.7862,-122.4162], [37.7880,-122.4093], [37.7898,-122.4024]],
  "smart":    [[37.7808,-122.4185], [37.7808,-122.4162], [37.7826,-122.4162], [37.7844,-122.4162], [37.7862,-122.4162], [37.7880,-122.4093], [37.7898,-122.4024]]
}
```

**Trajectory Event Types:**

| `event` value | When | Notes |
|---|---|---|
| `"dispatch"` | First event, t=0 | `speed_kmh: 0` |
| `"preemption"` | Green wave activated | `detail` names signal count |
| `"move"` | Each edge traversal | `speed_kmh > 0`; renders ambulance position |
| `"signal_wait"` | Red light stop (preemption off) | `detail` shows wait seconds |
| `"reroute"` | New path computed mid-trip | `detail` shows reroute count |
| `"arrive"` | Last event | `speed_kmh: 0` |

**Errors:**

| Code | Scenario |
|---|---|
| `422 Unprocessable Entity` | Invalid request body (bad `scenario` string, wrong type) |
| `500 Internal Server Error` | No reachable hospital; disconnected graph routing error |

---

### `GET /benchmark`

Returns pre-generated 100-trial benchmark stats from `results/benchmark_results.csv`.

**Response 200 OK:**

```json
{
  "trials_per_scenario": 100,
  "summary": [
    { "scenario": "Light",    "baseline_time_s": 75.9,  "traffic_time_s": 65.9,  "smart_time_s": 70.4,  "time_saved_s": 5.5,  "time_saved_pct": 7.3,  "smart_reroutes": 1.4, "smart_signal_stops": 0.0 },
    { "scenario": "Moderate", "baseline_time_s": 88.5,  "traffic_time_s": 80.0,  "smart_time_s": 80.0,  "time_saved_s": 8.5,  "time_saved_pct": 9.6,  "smart_reroutes": 1.8, "smart_signal_stops": 0.0 },
    { "scenario": "Heavy",    "baseline_time_s": 117.2, "traffic_time_s": 102.2, "smart_time_s": 102.2, "time_saved_s": 15.0, "time_saved_pct": 12.8, "smart_reroutes": 2.1, "smart_signal_stops": 0.0 },
    { "scenario": "Gridlock", "baseline_time_s": 220.1, "traffic_time_s": 178.6, "smart_time_s": 178.6, "time_saved_s": 41.5, "time_saved_pct": 18.9, "smart_reroutes": 3.2, "smart_signal_stops": 0.0 }
  ],
  "raw_preview": [ { "scenario": "Light", "trial": 0, "start": "n_0_0", "hospital": "n_5_7", "...": "..." } ],
  "charts": {
    "avg_time_by_mode":         "/results/avg_time_by_mode.png",
    "time_saved_boxplot":       "/results/time_saved_boxplot.png",
    "time_saved_vs_congestion": "/results/time_saved_vs_congestion.png",
    "algorithm_comparison":     "/results/algorithm_comparison.png"
  }
}
```

**Errors:** `404` if `results/benchmark_results.csv` does not exist.

---

### `GET /results/{filename}`

Serves static PNG chart files and the benchmark CSV.

```
GET http://localhost:8000/results/avg_time_by_mode.png
GET http://localhost:8000/results/time_saved_boxplot.png
GET http://localhost:8000/results/time_saved_vs_congestion.png
GET http://localhost:8000/results/algorithm_comparison.png
GET http://localhost:8000/results/benchmark_results.csv
```

Returns `404` if the file does not exist.

---

## 4. Real-time / Streaming

**There are no WebSockets, SSE, or streaming endpoints.**

`POST /dispatch` runs synchronously (~< 200 ms) and returns the entire pre-computed
trajectory in one response. All animation is client-side:

```
POST /dispatch → Returns complete trajectory[]
  → React advances currentTime via requestAnimationFrame
    → Interpolates ambulance [lat, lon] between trajectory events
      → Re-renders Leaflet marker every frame
```

No repeated backend calls are needed during playback.

---

## 5. Data Models Reference

```typescript
interface Hospital {
  id:          string;    // "hosp_n_5_7"
  name:        string;    // "Emergency Hospital n_5_7"
  node:        string;    // "n_5_7"
  lat:         number;
  lon:         number;
  capacity:    number;    // free beds (int >= 0)
  specialties: string[];  // subset of ["cardiac","trauma","stroke"]
}

interface Signal {
  node:         string;   // "n_2_4"
  lat:          number;
  lon:          number;
  phase_offset: number;   // seconds into 30s cycle at t=0
  // Green when: (currentTime + phase_offset) % 30 < 15
}

interface NodeData {
  id:         string;     // "n_row_col"
  lat:        number;
  lon:        number;
  has_signal: boolean;
  label:      string;
}

interface TrajectoryEvent {
  t:         number;  // sim time (seconds) when event fired
  lat:       number;
  lon:       number;
  event:     "dispatch" | "preemption" | "move" | "signal_wait" | "reroute" | "arrive";
  detail:    string;  // human-readable description
  speed_kmh: number;  // 0 for non-move events
  node:      string;  // current node ID
}

interface TripMetrics {
  mode:              "distance" | "traffic" | "smart";
  algorithm:         "dijkstra" | "astar";
  preemption_on:     boolean;
  total_time_s:      number;
  total_distance_m:  number;
  reroutes:          number;
  signal_stops:      number;
  signal_wait_s:     number;
  path:              string[];             // ordered node IDs
  polyline:          [number, number][];   // [lat, lon] pairs
  trajectory:        TrajectoryEvent[];
}

interface DispatchResponse {
  active_trip: TripMetrics;             // always Smart mode
  routes: {
    baseline: [number, number][];       // distance-mode polyline
    traffic:  [number, number][];       // traffic-aware polyline
    smart:    [number, number][];       // smart polyline (= active_trip.polyline)
  };
  comparison: {
    baseline:       TripMetrics;
    traffic:        TripMetrics;
    smart:          TripMetrics;
    time_saved_s:   number;
    time_saved_pct: number;
  };
  destination:  Hospital;
  start_node:   string;
  scenario:     string;
}

interface CityData {
  center:    [number, number];
  bounds:    [[number, number], [number, number]];
  hospitals: Hospital[];
  signals:   Signal[];
  nodes:     NodeData[];
  stats: { node_count: number; edge_count: number; signal_count: number; hospital_count: number; };
}
```

---

## 6. Hospital Selection Logic

Backend-side auto-selection runs when `hospital_id == "auto"` (or the specified ID is not found).

**Algorithm (`backend/hospitals.py`):**

1. **Capacity filter** — drop hospitals with `capacity == 0`.
2. **Specialty filter** — prefer hospitals matching requested specialty; fall back to all with capacity.
3. **Route-cost ranking** — Dijkstra in `"traffic"` mode from `start_node` to each candidate; pick lowest cost.

**To pin a specific hospital:** send its `id` (e.g. `"hosp_n_5_7"`) or `node` (e.g. `"n_5_7"`).
Falls back to auto-select if ID is not found.

The resolved hospital is always returned in `response.destination`.

---

## 7. Routing Modes Explained

The frontend does NOT select a mode. `POST /dispatch` always runs **all three internally**:

| Mode | Cost function | Rerouting | Preemption |
|---|---|---|---|
| `distance` (Baseline) | Edge length (metres) | Never | No |
| `traffic` (Traffic-Aware) | Ambulance travel time (seconds) | Every `reroute_interval` s | No |
| `smart` (Fast-Aid) | Travel time + expected signal wait | Every `reroute_interval` s | Yes — next 3 signals |

**Travel time formula:**

```
speed_kmh = max(3.0, speed_limit_kmh * (1 - 0.85 * congestion))
travel_time_s = (length_m / (speed_kmh / 3.6)) / 1.25
```

**Signal preemption:** Next 3 signalised nodes on route are set to green (`preempted=True`).
Restored as ambulance passes. Only active in Smart mode with `preemption=true`.

**Dynamic rerouting:** New Dijkstra/A* from current position every `reroute_interval` seconds.
Applied only if new path differs. Capped at 50 reroutes per trip.

---

## 8. Traffic & Congestion Model

Congestion is a `float [0.0, 1.0]` on each directed edge, applied once at dispatch.

### Scenario Presets

| Scenario | Base congestion | Drift | Incident prob |
|---|---|---|---|
| `"Light"` | 0.10 | ±0.02/step | 0.005/s |
| `"Moderate"` | 0.30 | ±0.04/step | 0.015/s |
| `"Heavy"` | 0.60 | ±0.06/step | 0.030/s |
| `"Gridlock"` | 0.85 | ±0.03/step | 0.050/s |

### Live Congestion / Heatmap

**No live congestion endpoint exists.** To approximate congestion for rendering:
- Compare `trajectory[].speed_kmh` against the edge speed limit from `GET /city` stats.
- Low `speed_kmh` vs speed limit = high congestion on that segment.

Signal state at time `t`:
- GREEN when `(t + signal.phase_offset) % 30 < 15`
- PREEMPTED (forced green) during active ambulance approach — check `"preemption"` trajectory events

---

## 9. Sample Full JSON Payloads

### Sample curl Request

```bash
curl -X POST http://localhost:8000/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "start_node": "n_0_0",
    "hospital_id": "auto",
    "specialty": "cardiac",
    "scenario": "Moderate",
    "algorithm": "dijkstra",
    "preemption": true,
    "reroute_interval": 15.0
  }'
```

### Complete Realistic Response

```json
{
  "active_trip": {
    "mode": "smart",
    "algorithm": "dijkstra",
    "preemption_on": true,
    "total_time_s": 82.34,
    "total_distance_m": 2400.0,
    "reroutes": 2,
    "signal_stops": 0,
    "signal_wait_s": 0.0,
    "path": ["n_0_0","n_0_1","n_1_1","n_2_1","n_3_1","n_4_2","n_5_7"],
    "polyline": [
      [37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],
      [37.7844,-122.4162],[37.7862,-122.4162],[37.7880,-122.4093],[37.7898,-122.4024]
    ],
    "trajectory": [
      {"t":0.00,"lat":37.7808,"lon":-122.4185,"event":"dispatch","detail":"Dispatched via smart mode","speed_kmh":0.0,"node":"n_0_0"},
      {"t":0.00,"lat":37.7808,"lon":-122.4185,"event":"preemption","detail":"Green Wave activated for 3 upcoming signals","speed_kmh":0.0,"node":"n_0_0"},
      {"t":8.47,"lat":37.7808,"lon":-122.4162,"event":"move","detail":"En route to n_0_1 (56.3 km/h)","speed_kmh":56.3,"node":"n_0_1"},
      {"t":17.21,"lat":37.7826,"lon":-122.4162,"event":"move","detail":"En route to n_1_1 (55.8 km/h)","speed_kmh":55.8,"node":"n_1_1"},
      {"t":17.21,"lat":37.7826,"lon":-122.4162,"event":"reroute","detail":"Dynamic reroute #1 around congestion","speed_kmh":0.0,"node":"n_1_1"},
      {"t":25.80,"lat":37.7844,"lon":-122.4162,"event":"move","detail":"En route to n_2_1 (57.2 km/h)","speed_kmh":57.2,"node":"n_2_1"},
      {"t":34.25,"lat":37.7862,"lon":-122.4162,"event":"move","detail":"En route to n_3_1 (58.1 km/h)","speed_kmh":58.1,"node":"n_3_1"},
      {"t":34.25,"lat":37.7862,"lon":-122.4162,"event":"preemption","detail":"Green Wave activated for 3 upcoming signals","speed_kmh":0.0,"node":"n_3_1"},
      {"t":34.25,"lat":37.7862,"lon":-122.4162,"event":"reroute","detail":"Dynamic reroute #2 around congestion","speed_kmh":0.0,"node":"n_3_1"},
      {"t":46.80,"lat":37.7880,"lon":-122.4093,"event":"move","detail":"En route to n_4_2 (54.9 km/h)","speed_kmh":54.9,"node":"n_4_2"},
      {"t":82.34,"lat":37.7898,"lon":-122.4024,"event":"arrive","detail":"Arrived safely at destination hospital","speed_kmh":0.0,"node":"n_5_7"}
    ]
  },
  "routes": {
    "baseline": [[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7898,-122.4024]],
    "traffic":  [[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7880,-122.4093],[37.7898,-122.4024]],
    "smart":    [[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7880,-122.4093],[37.7898,-122.4024]]
  },
  "comparison": {
    "baseline": {
      "mode":"distance","algorithm":"dijkstra","preemption_on":false,
      "total_time_s":100.54,"total_distance_m":2200.0,"reroutes":0,"signal_stops":3,"signal_wait_s":28.6,
      "path":["n_0_0","n_0_1","n_1_1","n_2_1","n_3_1","n_5_7"],
      "polyline":[[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7898,-122.4024]],
      "trajectory":["...see trajectory schema above..."]
    },
    "traffic": {
      "mode":"traffic","algorithm":"dijkstra","preemption_on":false,
      "total_time_s":91.12,"total_distance_m":2400.0,"reroutes":1,"signal_stops":2,"signal_wait_s":14.3,
      "path":["n_0_0","n_0_1","n_1_1","n_2_1","n_3_1","n_4_2","n_5_7"],
      "polyline":[[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7880,-122.4093],[37.7898,-122.4024]],
      "trajectory":["..."]
    },
    "smart": {
      "mode":"smart","algorithm":"dijkstra","preemption_on":true,
      "total_time_s":82.34,"total_distance_m":2400.0,"reroutes":2,"signal_stops":0,"signal_wait_s":0.0,
      "path":["n_0_0","n_0_1","n_1_1","n_2_1","n_3_1","n_4_2","n_5_7"],
      "polyline":[[37.7808,-122.4185],[37.7808,-122.4162],[37.7826,-122.4162],[37.7844,-122.4162],[37.7862,-122.4162],[37.7880,-122.4093],[37.7898,-122.4024]],
      "trajectory":["...same as active_trip.trajectory..."]
    },
    "time_saved_s": 18.20,
    "time_saved_pct": 18.1
  },
  "destination": {
    "id":"hosp_n_5_7","name":"Emergency Hospital n_5_7","node":"n_5_7",
    "lat":37.7898,"lon":-122.4024,"capacity":18,"specialties":["cardiac","trauma"]
  },
  "start_node": "n_0_0",
  "scenario": "Moderate"
}
```

---

## Quick-Reference Cheat Sheet

| What | Value |
|---|---|
| Backend URL | `http://localhost:8000` |
| Start backend | `uvicorn backend.main:app --host 127.0.0.1 --port 8000` |
| OpenAPI docs | `http://localhost:8000/docs` |
| City topology | `GET /city` |
| Ambulance dispatch | `POST /dispatch` with JSON body |
| Benchmark stats | `GET /benchmark` |
| Chart images | `GET /results/{filename}.png` |
| Authentication | None |
| CORS | Wide open (`allow_origins=["*"]`) |
| Coordinate order | **`[lat, lon]`** — Leaflet, NOT GeoJSON |
| Routing engine | Custom Dijkstra / A* on NetworkX DiGraph |
| Traffic scenarios | `Light` / `Moderate` / `Heavy` / `Gridlock` |
| Routing algorithms | `dijkstra` / `astar` |
| Hospital auto-select | Server-side — send `hospital_id: "auto"` |
| Specialties | `"cardiac"` / `"trauma"` / `"stroke"` / `null` |
| Modes simulated | Baseline + Traffic-Aware + Smart (always all 3) |
| Real-time streaming | None — full trajectory returned synchronously |
| WebSocket endpoint | Not implemented |
| Signal cycle | 30 s total: 15 s green, 15 s red |
| Green wave lookahead | 3 signals ahead of ambulance |
| Reroute interval | 15 s (configurable via `reroute_interval`) |
| Max reroutes/trip | 50 (hard cap) |
| Ambulance speed boost | 1.25x siren multiplier |
